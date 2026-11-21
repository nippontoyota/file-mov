import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

const client = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let checks = 0;
const check = (ok, label) => { assert.ok(ok, label); checks++; };
const ok = r => { assert.ifError(r.error); return r.data; };

async function login(email) {
  const c = client();
  ok(await c.auth.signInWithPassword({ email, password: 'Local-demo-only-2026!' }));
  return c;
}

const scope = 'd4000000-0000-0000-0000-000000000002'; // so2 in team3/branch1

try {
  const so = await login('so2@example.test');
  const tl = await login('tl3@example.test');
  const sm = await login('sm4@example.test');
  const cashier = await login('cashier8@example.test');
  const other = await login('so13@example.test');
  const admin = await login('admin1@example.test');
  const bo = await login('bo5@example.test');

  // 1. Create a booking and advance it to TL review
  const data = {
    customer_code: `APP-${randomUUID()}`,
    customer_name: 'Approval Test Customer',
    booking_number: 'APP-TEST-01',
    booking_date: '2026-11-20',
    enquiry_number: 'ENQ-APP-01',
    communication_address: 'Kalamassery Showroom Test Address',
    contact_person: 'Approval Test Customer',
    pin: '682024',
    model: 'Innova HyCross',
    suffix_1: 'ZX',
    colour_1: 'Super White',
    registration_same: 'yes',
    registration_name: 'Approval Test Customer',
    registration_address: 'Kalamassery Showroom Test Address',
    registration_pin: '682024',
    registration_model: 'Innova HyCross',
    registration_suffix: 'ZX',
    registration_colour: 'Super White',
  };
  const save = { p_operation: randomUUID(), p_membership: scope, p_data: data, p_confirmed: true };
  const id = ok(await so.rpc('save_booking_draft', save));
  let revision = 1;

  // Add dummy KYC documents for send
  const pdf = Buffer.from('%PDF-1.4\n% Dummy\n%%EOF\n');
  const { createHash, createHmac } = await import('node:crypto');
  const hash = createHash('sha256').update(pdf).digest('hex');
  const secret = (await pool.query('select secret from private.document_verifier')).rows[0].secret;
  const proof = docId => createHmac('sha256', secret).update(`${docId}:${hash}`).digest('hex');

  for (const kind of ['aadhaar', 'pan']) {
    const docId = ok(await so.rpc('reserve_booking_document', {
      p_operation: randomUUID(), p_booking: id, p_revision: revision,
      p_kind: kind, p_filename: `${kind}.pdf`, p_mime: 'application/pdf',
      p_size: pdf.length, p_sha256: hash,
    }));
    ok(await so.storage.from('booking-documents').upload(docId, pdf, { contentType: 'application/pdf' }));
    ok(await so.rpc('finalize_booking_document', { p_document: docId, p_revision: revision, p_attestation: proof(docId) }));
    revision++;
  }

  // SO sends to TL
  ok(await so.rpc('send_booking_to_tl', { p_operation: randomUUID(), p_booking: id, p_revision: revision }));
  revision++;
  check(ok(await so.from('bookings').select('state').eq('id', id).single()).state === 'tl_review', 'File is in tl_review');

  // TL must receive before approving
  const tlOp = randomUUID();
  check((await tl.rpc('approve_booking_tl', { p_operation: tlOp, p_booking: id, p_revision: revision })).error?.code === '22023', 'Cannot approve before receipt');

  // TL receives
  ok(await tl.rpc('receive_sales_file', { p_booking: id, p_revision: revision }));

  // Non-TL cannot return file
  check((await so.rpc('return_booking_tl', { p_operation: randomUUID(), p_booking: id, p_revision: revision, p_reason: 'Return reason' })).error?.code === '42501', 'Non-TL cannot return file');

  // Return requires valid reason
  check((await tl.rpc('return_booking_tl', { p_operation: randomUUID(), p_booking: id, p_revision: revision, p_reason: '  ' })).error?.code === '22023', 'Blank return reason rejected');

  // Stale revision for return rejected
  check((await tl.rpc('return_booking_tl', { p_operation: randomUUID(), p_booking: id, p_revision: revision - 1, p_reason: 'Valid reason' })).error?.code === '40001', 'Stale revision for return rejected');

  // TL returns file to SO for correction
  const returnOp = randomUUID();
  const returnReason = 'Customer PAN card scan is blurry. Please re-upload a clear copy.';
  const returnedId = ok(await tl.rpc('return_booking_tl', { p_operation: returnOp, p_booking: id, p_revision: revision, p_reason: returnReason }));
  check(returnedId === id, 'TL successfully returned file to SO');
  revision++;

  // Verify booking reverted to draft
  const draftState = ok(await so.from('bookings').select('state, revision').eq('id', id).single());
  check(draftState.state === 'draft', 'File reverted to draft state');
  check(draftState.revision === revision, 'Revision incremented on return');

  // Verify return audit event
  const returnAudit = (await pool.query("select * from public.audit_events where target_id=$1 and action='booking.returned_by_tl'", [id])).rows;
  check(returnAudit.length === 1 && returnAudit[0].reason === returnReason, 'Return audit event logged with reason');

  // SO re-submits file to TL
  ok(await so.rpc('send_booking_to_tl', { p_operation: randomUUID(), p_booking: id, p_revision: revision }));
  revision++;
  check(ok(await so.from('bookings').select('state').eq('id', id).single()).state === 'tl_review', 'File re-submitted to tl_review');

  // TL receives again
  ok(await tl.rpc('receive_sales_file', { p_booking: id, p_revision: revision }));

  // Non-TL cannot approve
  for (const c of [so, sm, other, admin, bo, client()]) {
    check((await c.rpc('approve_booking_tl', { p_operation: randomUUID(), p_booking: id, p_revision: revision })).error?.code === '42501', 'Non-TL cannot approve TL step');
  }

  // Stale revision rejected
  check((await tl.rpc('approve_booking_tl', { p_operation: randomUUID(), p_booking: id, p_revision: revision - 1 })).error?.code === '40001', 'Stale TL approval rejected');

  // TL approves
  ok(await tl.rpc('approve_booking_tl', { p_operation: tlOp, p_booking: id, p_revision: revision }));
  revision++;

  // TL approval deduplication
  check(ok(await tl.rpc('approve_booking_tl', { p_operation: tlOp, p_booking: id, p_revision: revision - 1 })) === id, 'TL approval retry is idempotent');

  // Check state and submission evidence
  const smState = ok(await sm.from('bookings').select('state, revision').eq('id', id).single());
  check(smState.state === 'sm_review', 'File transitions to sm_review');
  check(smState.revision === revision, 'Revision incremented');

  const subEvidence = ok(await sm.from('sales_submissions').select('*').eq('booking_id', id).single());
  check(subEvidence.tl_approved_by !== null && subEvidence.tl_approved_at !== null && subEvidence.tl_approver_name === 'Demo TL 3', 'TL approval recorded in submission record');

  // SM step: Non-SM cannot allocate
  for (const c of [so, tl, other, admin, bo, client()]) {
    check((await c.rpc('allocate_vehicle_sm', { p_operation: randomUUID(), p_booking: id, p_revision: revision, p_allocation_ref: 'MBJ11ZX2026TEST' })).error?.code === '42501', 'Non-SM cannot allocate vehicle');
  }

  // Empty allocation rejected
  check((await sm.rpc('allocate_vehicle_sm', { p_operation: randomUUID(), p_booking: id, p_revision: revision, p_allocation_ref: '   ' })).error?.code === '22023', 'Empty allocation rejected');

  // Stale revision rejected
  check((await sm.rpc('allocate_vehicle_sm', { p_operation: randomUUID(), p_booking: id, p_revision: revision - 1, p_allocation_ref: 'MBJ11ZX2026TEST' })).error?.code === '40001', 'Stale allocation rejected');

  // Valid SM allocation
  const smOp = randomUUID();
  ok(await sm.rpc('allocate_vehicle_sm', { p_operation: smOp, p_booking: id, p_revision: revision, p_allocation_ref: 'MBJ11ZX2026TEST' }));
  revision++;

  // SM retry deduplication
  check(ok(await sm.rpc('allocate_vehicle_sm', { p_operation: smOp, p_booking: id, p_revision: revision - 1, p_allocation_ref: 'MBJ11ZX2026TEST' })) === id, 'SM allocation retry is idempotent');

  // State is now 'allocated'
  const allocState = ok(await sm.from('bookings').select('state, revision').eq('id', id).single());
  check(allocState.state === 'allocated', 'File transitions to allocated state');

  // Step 2: SO Customer Intimation Call
  // Non-SO cannot record customer intimation
  check((await other.rpc('record_customer_intimation', { p_operation: randomUUID(), p_booking: id, p_revision: revision, p_notes: 'Customer contacted' })).error?.code === '42501', 'Unauthorized user cannot record intimation');

  // Blank notes rejected
  check((await so.rpc('record_customer_intimation', { p_operation: randomUUID(), p_booking: id, p_revision: revision, p_notes: '   ' })).error?.code === '22023', 'Blank intimation notes rejected');

  // SO records customer intimation
  const intimationNotes = 'Called customer. Informed of VIN allocation. Customer transferring full amount via RTGS.';
  ok(await so.rpc('record_customer_intimation', { p_operation: randomUUID(), p_booking: id, p_revision: revision, p_notes: intimationNotes }));
  revision++;

  // Step 3: Vehicle Balance Payment & Cashier Verification
  // Cannot hand over to BO before balance payment is verified
  check((await sm.rpc('handover_to_bo_sm', { p_operation: randomUUID(), p_booking: id, p_revision: revision })).error?.code === '22023', 'Cannot hand over to BO without balance payment');

  // SO records balance payment without proof
  const unverifiedPayId = ok(await so.rpc('record_booking_payment', {
    p_operation: randomUUID(),
    p_booking: id,
    p_amount: 1850000,
    p_method: 'upi',
    p_reference: 'RTGS-982189201',
    p_payment_type: 'balance_payment',
  }));

  // Cashier cannot verify without proof slip attached
  check((await cashier.rpc('verify_booking_payment', {
    p_operation: randomUUID(),
    p_payment_id: unverifiedPayId,
    p_receipt_no: 'RCP-BAL-00921',
  })).error?.code === '22023', 'Cashier verification rejected when proof is missing');

  // Upload proof document
  const payDocId = ok(await so.rpc('reserve_booking_document', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_kind: 'payment_receipt', p_filename: 'balance_receipt.pdf', p_mime: 'application/pdf',
    p_size: pdf.length, p_sha256: hash,
  }));
  ok(await so.storage.from('booking-documents').upload(payDocId, pdf, { contentType: 'application/pdf' }));
  ok(await so.rpc('finalize_booking_document', { p_document: payDocId, p_revision: revision, p_attestation: proof(payDocId) }));
  revision++;

  // Cashier verifies with attached proof slip
  ok(await cashier.rpc('verify_booking_payment', {
    p_operation: randomUUID(),
    p_payment_id: unverifiedPayId,
    p_receipt_no: 'RCP-BAL-00921',
    p_proof_document: payDocId,
  }));

  // Step 4: SM Hands Over to Back Office
  const handoverOp = randomUUID();
  ok(await sm.rpc('handover_to_bo_sm', { p_operation: handoverOp, p_booking: id, p_revision: revision }));
  revision++;

  // SM handover retry deduplication
  check(ok(await sm.rpc('handover_to_bo_sm', { p_operation: handoverOp, p_booking: id, p_revision: revision - 1 })) === id, 'SM handover retry is idempotent');

  // State is now bo_review
  const boState = ok(await sm.from('bookings').select('state, revision').eq('id', id).single());
  check(boState.state === 'bo_review', 'File transitions to bo_review');

  const smSubEvidence = ok(await sm.from('sales_submissions').select('*').eq('booking_id', id).single());
  check(smSubEvidence.sm_approved_by !== null && smSubEvidence.sm_approved_at !== null && smSubEvidence.sm_approver_name === 'Demo SM 4' && smSubEvidence.allocation_ref === 'MBJ11ZX2026TEST', 'SM approval & allocation recorded');

  // Check audit events
  const tlAudit = (await pool.query("select * from public.audit_events where target_id=$1 and action='booking.approved_by_tl'", [id])).rows;
  check(tlAudit.length === 1, 'TL approval audit event recorded');

  const smAudit = (await pool.query("select * from public.audit_events where target_id=$1 and action='booking.approved_by_sm'", [id])).rows;
  check(smAudit.length === 1 && smAudit[0].reason === 'MBJ11ZX2026TEST', 'SM approval audit event recorded with allocation ref');

  // BO visibility check: BO in branch 1 can now read this booking!
  const boView = ok(await bo.from('bookings').select('id, state').eq('id', id));
  check(boView.length === 1 && boView[0].state === 'bo_review', 'BO can view booking in bo_review');

  // Staff from branch 2 (other) STILL cannot view!
  const otherView = ok(await other.from('bookings').select('id').eq('id', id));
  check(otherView.length === 0, 'Cross-branch staff cannot view booking');

  console.log(`Passed ${checks} sales approval, allocation, state transition and RLS checks.`);
} finally {
  await pool.end();
}
