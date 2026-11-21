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
  const bo = await login('bo5@example.test');
  const ins = await login('insurance6@example.test');
  const acc = await login('accounts7@example.test');
  const accs = await login('accessories9@example.test');
  const otherBranch = await login('so13@example.test');

  // 1. Create a booking and advance it all the way through SO -> TL -> SM -> bo_review
  const data = {
    customer_code: `BO-TEST-${randomUUID()}`,
    customer_name: 'BackOffice Prep Customer',
    booking_number: 'BO-PREP-01',
    booking_date: '2026-11-20',
    enquiry_number: 'ENQ-BO-01',
    communication_address: 'Kalamassery Showroom Test Address',
    contact_person: 'BackOffice Prep Customer',
    pin: '682024',
    model: 'Innova HyCross',
    suffix_1: 'ZX',
    colour_1: 'Blackish Ageha',
    registration_same: 'yes',
    registration_name: 'BackOffice Prep Customer',
    registration_address: 'Kalamassery Showroom Test Address',
    registration_pin: '682024',
    registration_model: 'Innova HyCross',
    registration_suffix: 'ZX',
    registration_colour: 'Blackish Ageha',
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
    await so.storage.from('booking-documents').upload(docId, pdf, { contentType: 'application/pdf' });
    ok(await so.rpc('finalize_booking_document', {
      p_document: docId, p_revision: revision, p_attestation: proof(docId),
    }));
    revision++;
  }

  // SO sends to TL
  ok(await so.rpc('send_booking_to_tl', { p_operation: randomUUID(), p_booking: id, p_revision: revision }));
  revision++;

  // TL receives and approves
  ok(await tl.rpc('receive_sales_file', { p_booking: id, p_revision: revision }));
  ok(await tl.rpc('approve_booking_tl', { p_operation: randomUUID(), p_booking: id, p_revision: revision }));
  revision++;

  // SM allocates vehicle
  ok(await sm.rpc('allocate_vehicle_sm', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision, p_allocation_ref: 'MBJ11ZX202699881',
  }));
  revision++;

  // SO records customer intimation
  ok(await so.rpc('record_customer_intimation', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision, p_notes: 'Customer notified of VIN allocation',
  }));
  revision++;

  // Upload proof and record balance payment
  const payDocId = ok(await so.rpc('reserve_booking_document', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_kind: 'payment_receipt', p_filename: 'receipt.pdf', p_mime: 'application/pdf',
    p_size: pdf.length, p_sha256: hash,
  }));
  await so.storage.from('booking-documents').upload(payDocId, pdf, { contentType: 'application/pdf' });
  ok(await so.rpc('finalize_booking_document', { p_document: payDocId, p_revision: revision, p_attestation: proof(payDocId) }));
  revision++;

  const payId = ok(await so.rpc('record_booking_payment', {
    p_operation: randomUUID(), p_booking: id, p_amount: 1800000, p_method: 'upi', p_reference: 'RTGS-001', p_payment_type: 'balance_payment', p_proof_document: payDocId,
  }));

  const cashier = await login('cashier8@example.test');
  ok(await cashier.rpc('verify_booking_payment', {
    p_operation: randomUUID(), p_payment_id: payId, p_receipt_no: 'RCP-BAL-001',
  }));

  // SM hands over to Back Office
  ok(await sm.rpc('handover_to_bo_sm', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
  }));
  revision++;

  // State is now bo_review
  const boBooking = ok(await bo.from('bookings').select('id,state,revision').eq('id', id).single());
  check(boBooking.state === 'bo_review', 'Booking is now in bo_review');
  check(boBooking.revision === revision, 'Revision matches after SM approval');

  // Verify bo_preparations row was automatically initialized
  const initialPrep = ok(await bo.from('bo_preparations').select('*').eq('booking_id', id).single());
  check(initialPrep.pdi_status === 'pending', 'Initial PDI status is pending');
  check(initialPrep.form20_signed === false, 'Initial Form 20 signed is false');
  check(initialPrep.insurance_dispatched_at === null, 'Initial Insurance dispatched is null');

  // 2. Access Control Tests
  // Non-BO users (SO, TL, otherBranch) cannot call BO commands
  const nonBoPdi = await so.rpc('record_bo_pdi', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_status: 'passed', p_inspector: 'Inspector Saju', p_notes: 'All checks passed',
  });
  check(nonBoPdi.error?.code === '42501', 'SO cannot record PDI');

  const otherBranchPdi = await otherBranch.rpc('record_bo_pdi', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_status: 'passed', p_inspector: 'Inspector Saju', p_notes: 'All checks passed',
  });
  check(otherBranchPdi.error?.code === '42501', 'Cross-branch staff cannot record PDI');

  // 3. PDI Verification Tests
  // Invalid PDI status fails
  const invalidPdi = await bo.rpc('record_bo_pdi', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_status: 'unknown_status', p_inspector: 'Saju', p_notes: 'Test',
  });
  check(invalidPdi.error?.code === '22023', 'Invalid PDI status rejected');

  // Valid PDI recording succeeds
  const pdiOp = randomUUID();
  ok(await bo.rpc('record_bo_pdi', {
    p_operation: pdiOp, p_booking: id, p_revision: revision,
    p_status: 'passed', p_inspector: 'Kalamassery Stockyard - Saju K.', p_notes: 'Clean exterior, toolkit verified, battery test passed.',
  }));
  revision++;

  const postPdiPrep = ok(await bo.from('bo_preparations').select('*').eq('booking_id', id).single());
  check(postPdiPrep.pdi_status === 'passed', 'PDI status updated to passed');
  check(postPdiPrep.pdi_inspector_name === 'Kalamassery Stockyard - Saju K.', 'Inspector name recorded');
  check(postPdiPrep.pdi_notes.includes('battery test passed'), 'Inspector notes recorded');
  check(postPdiPrep.pdi_completed_by !== null, 'PDI completion attributed to BO staff');

  // Idempotency: retry with same operation returns without error or duplicate revision increment
  const pdiRetry = ok(await bo.rpc('record_bo_pdi', {
    p_operation: pdiOp, p_booking: id, p_revision: revision - 1,
    p_status: 'passed', p_inspector: 'Kalamassery Stockyard - Saju K.', p_notes: 'Clean exterior, toolkit verified, battery test passed.',
  }));
  check(pdiRetry === id, 'PDI retry with same operation ID returns previous result');

  // Stale revision rejected
  const stalePdi = await bo.rpc('record_bo_pdi', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision - 1,
    p_status: 'rework', p_inspector: 'Saju', p_notes: 'Stale attempt',
  });
  check(stalePdi.error?.code === '40001', 'Stale revision rejected on PDI recording');

  // 4. VAHAN & Statutory Signatures Tracking Tests
  const vahanOp = randomUUID();
  ok(await bo.rpc('record_bo_vahan_and_statutory', {
    p_operation: vahanOp, p_booking: id, p_revision: revision,
    p_vahan_app_no: 'KL-07-2026-AP-00918',
    p_form20_signed: true,
    p_disclaimer_signed: true,
  }));
  revision++;

  const postVahanPrep = ok(await bo.from('bo_preparations').select('*').eq('booking_id', id).single());
  check(postVahanPrep.vahan_app_no === 'KL-07-2026-AP-00918', 'VAHAN application number recorded');
  check(postVahanPrep.form20_signed === true, 'Form 20 physical ink signature recorded');
  check(postVahanPrep.disclaimer_signed === true, 'Customer disclaimer ink signature recorded');
  check(postVahanPrep.documents_completed_by !== null, 'Statutory verification attributed');

  // 5. Scoped Access & Departmental Dispatches Tests
  // Before dispatch: Insurance, Accounts, Accessories cannot see the booking
  const preIns = ok(await ins.from('bookings').select('id').eq('id', id));
  check(preIns.length === 0, 'Insurance cannot view booking before insurance dispatch');

  const preAcc = ok(await acc.from('bookings').select('id').eq('id', id));
  check(preAcc.length === 0, 'Accounts cannot view booking before accounts dispatch');

  const preAccs = ok(await accs.from('bookings').select('id').eq('id', id));
  check(preAccs.length === 0, 'Accessories cannot view booking before accessories dispatch');

  // Invalid target department fails
  const invalidDept = await bo.rpc('dispatch_bo_department', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision, p_target_dept: 'invalid_dept',
  });
  check(invalidDept.error?.code === '22023', 'Invalid target department rejected');

  // BO dispatches to Insurance
  ok(await bo.rpc('dispatch_bo_department', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision, p_target_dept: 'insurance',
  }));
  revision++;

  // Insurance can NOW view the booking!
  const postIns = ok(await ins.from('bookings').select('id').eq('id', id));
  check(postIns.length === 1 && postIns[0].id === id, 'Insurance can view booking after dispatch');

  // Accounts still cannot see it
  const stillNoAcc = ok(await acc.from('bookings').select('id').eq('id', id));
  check(stillNoAcc.length === 0, 'Accounts still cannot view booking');

  // BO dispatches to Accounts
  ok(await bo.rpc('dispatch_bo_department', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision, p_target_dept: 'accounts',
  }));
  revision++;

  // Accounts can NOW view the booking!
  const postAcc = ok(await acc.from('bookings').select('id').eq('id', id));
  check(postAcc.length === 1 && postAcc[0].id === id, 'Accounts can view booking after dispatch');

  // BO dispatches to Accessories
  ok(await bo.rpc('dispatch_bo_department', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision, p_target_dept: 'accessories',
  }));
  revision++;

  // Accessories can NOW view the booking!
  const postAccs = ok(await accs.from('bookings').select('id').eq('id', id));
  check(postAccs.length === 1 && postAccs[0].id === id, 'Accessories can view booking after dispatch');

  // Verify timestamps in bo_preparations
  const finalPrep = ok(await bo.from('bo_preparations').select('*').eq('booking_id', id).single());
  check(finalPrep.insurance_dispatched_at !== null, 'Insurance dispatch timestamp recorded');
  check(finalPrep.accounts_dispatched_at !== null, 'Accounts dispatch timestamp recorded');
  check(finalPrep.accessories_dispatched_at !== null, 'Accessories dispatch timestamp recorded');

  // 6. BO Document Upload Tests (Form 20 & Disclaimer PDFs)
  for (const boKind of ['form20', 'disclaimer']) {
    const boDocId = ok(await bo.rpc('reserve_booking_document', {
      p_operation: randomUUID(), p_booking: id, p_revision: revision,
      p_kind: boKind, p_filename: `${boKind}_signed.pdf`, p_mime: 'application/pdf',
      p_size: pdf.length, p_sha256: hash,
    }));
    await bo.storage.from('booking-documents').upload(boDocId, pdf, { contentType: 'application/pdf' });
    ok(await bo.rpc('finalize_booking_document', {
      p_document: boDocId, p_revision: revision, p_attestation: proof(boDocId),
    }));
    revision++;
  }

  const boDocs = ok(await bo.from('booking_documents').select('kind,status').eq('booking_id', id));
  check(boDocs.some(d => d.kind === 'form20' && d.status === 'ready'), 'Form 20 ready in document vault');
  check(boDocs.some(d => d.kind === 'disclaimer' && d.status === 'ready'), 'Disclaimer ready in document vault');

  // Verify Audit Events
  const audit = (await pool.query(
    "select action from public.audit_events where target_id=$1 order by occurred_at asc",
    [id]
  )).rows.map(r => r.action);
  check(audit.includes('bo.pdi_recorded'), 'Audit event bo.pdi_recorded logged');
  check(audit.includes('bo.vahan_and_statutory_recorded'), 'Audit event bo.vahan_and_statutory_recorded logged');
  check(audit.includes('bo.dispatched_insurance'), 'Audit event bo.dispatched_insurance logged');
  check(audit.includes('bo.dispatched_accounts'), 'Audit event bo.dispatched_accounts logged');
  check(audit.includes('bo.dispatched_accessories'), 'Audit event bo.dispatched_accessories logged');

  console.log(`Passed ${checks} Back Office preparation, PDI, VAHAN, statutory signatures, and dispatch checks.`);
} finally {
  await pool.end();
}
