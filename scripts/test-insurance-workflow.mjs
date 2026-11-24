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
  const otherBranch = await login('so13@example.test');

  // 1. Create a booking through SO -> TL -> SM -> bo_review
  const data = {
    customer_code: `INS-TEST-${randomUUID()}`,
    customer_name: 'Insurance Test Customer',
    booking_number: 'INS-FLOW-01',
    booking_date: '2026-11-24',
    enquiry_number: 'ENQ-INS-01',
    communication_address: 'Kalamassery Showroom Test Address',
    contact_person: 'Insurance Test Customer',
    pin: '682024',
    model: 'Innova HyCross',
    suffix_1: 'ZX (O)',
    colour_1: 'Pearl White',
    registration_same: 'yes',
    registration_name: 'Insurance Test Customer',
    registration_address: 'Kalamassery Showroom Test Address',
    registration_pin: '682024',
    registration_model: 'Innova HyCross',
    registration_suffix: 'ZX (O)',
    registration_colour: 'Pearl White',
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

  // Record advance payment & Cashier verify
  const advPayDocId = ok(await so.rpc('reserve_booking_document', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_kind: 'payment_receipt', p_filename: 'adv_receipt.pdf', p_mime: 'application/pdf',
    p_size: pdf.length, p_sha256: hash,
  }));
  await so.storage.from('booking-documents').upload(advPayDocId, pdf, { contentType: 'application/pdf' });
  ok(await so.rpc('finalize_booking_document', { p_document: advPayDocId, p_revision: revision, p_attestation: proof(advPayDocId) }));
  revision++;

  const advPayId = ok(await so.rpc('record_booking_payment', {
    p_operation: randomUUID(), p_booking: id, p_amount: 25000, p_method: 'upi', p_reference: 'ADV-001', p_payment_type: 'booking_advance', p_proof_document: advPayDocId,
  }));
  const cashier = await login('cashier8@example.test');
  ok(await cashier.rpc('verify_booking_payment', {
    p_operation: randomUUID(), p_payment_id: advPayId, p_receipt_no: 'RCP-ADV-001',
  }));

  // SO sends to TL
  ok(await so.rpc('send_booking_to_tl', { p_operation: randomUUID(), p_booking: id, p_revision: revision }));
  revision++;

  // TL receives and approves
  ok(await tl.rpc('receive_sales_file', { p_booking: id, p_revision: revision }));
  ok(await tl.rpc('approve_booking_tl', { p_operation: randomUUID(), p_booking: id, p_revision: revision }));
  revision++;

  // SM allocates vehicle
  ok(await sm.rpc('allocate_vehicle_sm', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision, p_allocation_ref: 'MBJ11ZX202699889',
  }));
  revision++;

  // SO records customer intimation
  ok(await so.rpc('record_customer_intimation', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision, p_notes: 'Customer notified of VIN allocation',
  }));
  revision++;

  // Upload proof and record balance payment
  const balPayDocId = ok(await so.rpc('reserve_booking_document', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_kind: 'payment_receipt', p_filename: 'bal_receipt.pdf', p_mime: 'application/pdf',
    p_size: pdf.length, p_sha256: hash,
  }));
  await so.storage.from('booking-documents').upload(balPayDocId, pdf, { contentType: 'application/pdf' });
  ok(await so.rpc('finalize_booking_document', { p_document: balPayDocId, p_revision: revision, p_attestation: proof(balPayDocId) }));
  revision++;

  const balPayId = ok(await so.rpc('record_booking_payment', {
    p_operation: randomUUID(), p_booking: id, p_amount: 1850000, p_method: 'upi', p_reference: 'RTGS-002', p_payment_type: 'balance_payment', p_proof_document: balPayDocId,
  }));
  ok(await cashier.rpc('verify_booking_payment', {
    p_operation: randomUUID(), p_payment_id: balPayId, p_receipt_no: 'RCP-BAL-002',
  }));

  // SM hands over to Back Office
  ok(await sm.rpc('handover_to_bo_sm', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
  }));
  revision++;

  // 2. Back Office PDI & VAHAN Staging
  ok(await bo.rpc('record_bo_pdi', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_status: 'passed', p_inspector: 'Saju K. (Kalamassery Yard)', p_notes: 'PDI Passed. All OK.',
  }));
  revision++;

  ok(await bo.rpc('record_bo_vahan_and_statutory', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_vahan_app_no: 'KL-07-2026-AP-99881', p_form20_signed: true, p_disclaimer_signed: true,
  }));
  revision++;

  // 3. Before dispatch: Insurance cannot see the file
  const preDispatch = ok(await ins.from('bookings').select('id').eq('id', id));
  check(preDispatch.length === 0, 'Insurance cannot view booking before insurance dispatch');

  // Non-insurance role cannot record insurance
  const nonInsRecord = await so.rpc('record_insurance_policy', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_company_name: 'ICICI Lombard', p_policy_number: 'POL-001', p_policy_type: 'comprehensive_1_3',
    p_idv: 1850000, p_premium: 46000,
  });
  check(nonInsRecord.error?.code === '42501', 'SO cannot record insurance policy');

  // 4. BO dispatches to Insurance
  ok(await bo.rpc('dispatch_bo_department', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision, p_target_dept: 'insurance',
  }));
  revision++;

  // Now Insurance can see the file!
  const postDispatch = ok(await ins.from('bookings').select('id').eq('id', id));
  check(postDispatch.length === 1 && postDispatch[0].id === id, 'Insurance can view booking after dispatch');

  // Cross-branch isolation: other branch staff cannot view booking
  const crossBranch = ok(await otherBranch.from('bookings').select('id').eq('id', id));
  check(crossBranch.length === 0, 'Cross-branch staff cannot view booking');

  // 5. Insurance Policy Validation Checks
  // Missing company name fails
  const noCompany = await ins.rpc('record_insurance_policy', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_company_name: '', p_policy_number: 'POL-001', p_policy_type: 'comprehensive_1_3',
    p_idv: 1850000, p_premium: 46000,
  });
  check(noCompany.error?.code === '22023', 'Missing company name rejected');

  // Non-positive IDV fails
  const badIdv = await ins.rpc('record_insurance_policy', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_company_name: 'ICICI Lombard', p_policy_number: 'POL-001', p_policy_type: 'comprehensive_1_3',
    p_idv: 0, p_premium: 46000,
  });
  check(badIdv.error?.code === '22023', 'Zero IDV rejected');

  // 6. Insurance uploads policy document
  const polDocId = ok(await ins.rpc('reserve_booking_document', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_kind: 'insurance_policy', p_filename: 'icici_motor_policy.pdf', p_mime: 'application/pdf',
    p_size: pdf.length, p_sha256: hash,
  }));
  await ins.storage.from('booking-documents').upload(polDocId, pdf, { contentType: 'application/pdf' });
  ok(await ins.rpc('finalize_booking_document', { p_document: polDocId, p_revision: revision, p_attestation: proof(polDocId) }));
  revision++;

  // 7. Successful Policy Recording
  const insOp = randomUUID();
  const issuedId = ok(await ins.rpc('record_insurance_policy', {
    p_operation: insOp, p_booking: id, p_revision: revision,
    p_company_name: 'ICICI Lombard General Insurance',
    p_policy_number: 'POL-ICICI-2026-99881',
    p_policy_type: 'comprehensive_1_3',
    p_idv: 1850000,
    p_premium: 46250,
    p_start_date: '2026-11-24',
    p_end_date: '2027-11-23',
    p_nominee_name: 'Anitha S.',
    p_nominee_relation: 'Spouse',
    p_nominee_age: 38,
    p_hypothecation_bank: 'HDFC Bank Ltd (Auto Loan Division)',
    p_add_ons: ['zero_dep', 'engine_protect', 'return_to_invoice', 'rsa'],
    p_document_id: polDocId,
  }));
  check(issuedId === id, 'Policy recording returned booking ID');
  revision++;

  // Verify insurance_policies table
  const policyRow = ok(await ins.from('insurance_policies').select('*').eq('booking_id', id).single());
  check(policyRow.status === 'issued', 'Policy status is issued');
  check(policyRow.policy_number === 'POL-ICICI-2026-99881', 'Policy number recorded');
  check(policyRow.company_name === 'ICICI Lombard General Insurance', 'Underwriter recorded');
  check(Number(policyRow.idv_amount) === 1850000, 'IDV recorded');
  check(Number(policyRow.premium_amount) === 46250, 'Premium recorded');
  check(policyRow.hypothecation_bank === 'HDFC Bank Ltd (Auto Loan Division)', 'Bank hypothecation recorded');
  check(policyRow.nominee_name === 'Anitha S.', 'CPA nominee recorded');
  check(policyRow.document_id === polDocId, 'Policy document linked');
  check(policyRow.issued_by !== null, 'Issuing staff recorded');

  // Verify bo_preparations completion timestamp
  const prepRow = ok(await ins.from('bo_preparations').select('*').eq('booking_id', id).single());
  check(prepRow.insurance_completed_at !== null, 'insurance_completed_at timestamp recorded in bo_preparations');
  check(prepRow.insurance_completed_by !== null, 'insurance_completed_by recorded');

  // Idempotency: replay with same operation ID returns same result without error
  const replay = ok(await ins.rpc('record_insurance_policy', {
    p_operation: insOp, p_booking: id, p_revision: revision - 1,
    p_company_name: 'ICICI Lombard General Insurance',
    p_policy_number: 'POL-ICICI-2026-99881',
    p_policy_type: 'comprehensive_1_3',
    p_idv: 1850000,
    p_premium: 46250,
  }));
  check(replay === id, 'Replay with same operation ID is idempotent');

  // Verify Audit Trail
  const audit = (await pool.query(
    "select action, reason from public.audit_events where target_id=$1 and action='insurance.policy_issued'",
    [id]
  )).rows;
  check(audit.length === 1, 'Audit event insurance.policy_issued logged');
  check(audit[0].reason.includes('POL-ICICI-2026-99881'), 'Audit reason contains policy number');

  console.log(`Passed ${checks} Insurance underwriting, document binding, and policy issuance checks.`);
} finally {
  await pool.end();
}
