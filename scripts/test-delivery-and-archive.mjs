import assert from 'node:assert/strict';
import { randomUUID, createHash, createHmac } from 'node:crypto';
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

const secret = (await pool.query('select secret from private.document_verifier')).rows[0].secret;
const proof = (docId, h) => createHmac('sha256', secret).update(`${docId}:${h}`).digest('hex');

const scope = 'd4000000-0000-0000-0000-000000000002'; // so2 in team1/branch1

try {
  const so = await login('so2@example.test');
  const tl = await login('tl3@example.test');
  const sm = await login('sm4@example.test');
  const bo = await login('bo5@example.test');
  const ins = await login('insurance6@example.test');
  const acc = await login('accounts7@example.test');
  const cashier = await login('cashier8@example.test');
  const security = await login('security10@example.test');
  const admin = await login('admin1@example.test');
  const otherBranch = await login('so13@example.test');

  // 1. Setup a booking through Sales -> BO -> Insurance -> Accounts -> Accessories -> RTO
  const customerCode = `DELV-TEST-${randomUUID()}`;
  const data = {
    customer_code: customerCode,
    customer_name: 'Delivery Customer',
    booking_number: 'DELV-FLOW-01',
    booking_date: '2026-11-24',
    enquiry_number: 'ENQ-DELV-01',
    communication_address: 'Kalamassery Showroom Test Address',
    contact_person: 'Delivery Customer',
    pin: '682024',
    model: 'Urban Cruiser Taisor',
    suffix_1: 'V Turbo AT',
    colour_1: 'Lucent Orange',
    registration_same: 'yes',
    registration_name: 'Delivery Customer',
    registration_address: 'Kalamassery Showroom Test Address',
    registration_pin: '682024',
    registration_model: 'Urban Cruiser Taisor',
    registration_suffix: 'V Turbo AT',
    registration_colour: 'Lucent Orange',
  };

  const save = { p_operation: randomUUID(), p_membership: scope, p_data: data, p_confirmed: true };
  const id = ok(await so.rpc('save_booking_draft', save));
  let revision = 1;

  // Add required Aadhaar & PAN
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Test) >>\nendobj\nxref\n0 2\n0000000000 65535 f \n0000000010 00000 n \ntrailer\n<< /Root 1 0 R >>\nstartxref\n50\n%%EOF\n');
  const hash = createHash('sha256').update(pdf).digest('hex');

  for (const kind of ['aadhaar', 'pan']) {
    const docId = ok(await so.rpc('reserve_booking_document', {
      p_operation: randomUUID(), p_booking: id, p_revision: revision,
      p_kind: kind, p_filename: `${kind}.pdf`, p_mime: 'application/pdf',
      p_size: pdf.length, p_sha256: hash,
    }));
    await so.storage.from('booking-documents').upload(docId, pdf, { contentType: 'application/pdf' });
    ok(await so.rpc('finalize_booking_document', { p_document: docId, p_revision: revision, p_attestation: proof(docId, hash) }));
    revision++;
  }

  // Advance Payment
  const advPayDocId = ok(await so.rpc('reserve_booking_document', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_kind: 'payment_receipt', p_filename: 'adv_receipt.pdf', p_mime: 'application/pdf',
    p_size: pdf.length, p_sha256: hash,
  }));
  await so.storage.from('booking-documents').upload(advPayDocId, pdf, { contentType: 'application/pdf' });
  ok(await so.rpc('finalize_booking_document', { p_document: advPayDocId, p_revision: revision, p_attestation: proof(advPayDocId, hash) }));
  revision++;

  const payId = ok(await so.rpc('record_booking_payment', {
    p_operation: randomUUID(), p_booking: id, p_amount: 50000, p_method: 'upi', p_reference: 'UPI-DELV-ADV-001', p_payment_type: 'booking_advance', p_proof_document: advPayDocId,
  }));
  ok(await cashier.rpc('verify_booking_payment', {
    p_operation: randomUUID(), p_payment_id: payId, p_receipt_no: 'REC-DELV-ADV-01',
  }));

  // Advance workflow to BO review
  ok(await so.rpc('send_booking_to_tl', { p_operation: randomUUID(), p_booking: id, p_revision: revision }));
  revision++;
  ok(await tl.rpc('receive_sales_file', { p_booking: id, p_revision: revision }));
  ok(await tl.rpc('approve_booking_tl', { p_operation: randomUUID(), p_booking: id, p_revision: revision }));
  revision++;

  ok(await sm.rpc('allocate_vehicle_sm', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_allocation_ref: 'MBJ11DELV2026999',
  }));
  revision++;

  // SO records customer intimation
  ok(await so.rpc('record_customer_intimation', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision, p_notes: 'Customer notified of VIN allocation',
  }));
  revision++;

  // Balance Payment
  const balPayDocId = ok(await so.rpc('reserve_booking_document', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_kind: 'payment_receipt', p_filename: 'bal_receipt.pdf', p_mime: 'application/pdf',
    p_size: pdf.length, p_sha256: hash,
  }));
  await so.storage.from('booking-documents').upload(balPayDocId, pdf, { contentType: 'application/pdf' });
  ok(await so.rpc('finalize_booking_document', { p_document: balPayDocId, p_revision: revision, p_attestation: proof(balPayDocId, hash) }));
  revision++;

  const balPayId = ok(await so.rpc('record_booking_payment', {
    p_operation: randomUUID(), p_booking: id, p_amount: 1200000, p_method: 'upi', p_reference: 'UPI-DELV-BAL-001', p_payment_type: 'balance_payment', p_proof_document: balPayDocId,
  }));
  ok(await cashier.rpc('verify_booking_payment', {
    p_operation: randomUUID(), p_payment_id: balPayId, p_receipt_no: 'REC-DELV-BAL-01',
  }));

  ok(await sm.rpc('handover_to_bo_sm', { p_operation: randomUUID(), p_booking: id, p_revision: revision }));
  revision++;

  // BO PDI
  ok(await bo.rpc('record_bo_pdi', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_status: 'passed', p_inspector: 'Kalamassery Yard Lead', p_notes: 'All checks passed',
  }));
  revision++;

  // Dispatch to Insurance
  ok(await bo.rpc('dispatch_bo_department', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision, p_target_dept: 'insurance',
  }));
  revision++;

  // Insurance issues policy
  const insDocId = ok(await ins.rpc('reserve_booking_document', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_kind: 'insurance_policy', p_filename: 'delv-policy.pdf', p_mime: 'application/pdf',
    p_size: pdf.length, p_sha256: hash,
  }));
  await ins.storage.from('booking-documents').upload(insDocId, pdf, { contentType: 'application/pdf' });
  ok(await ins.rpc('finalize_booking_document', { p_document: insDocId, p_revision: revision, p_attestation: proof(insDocId, hash) }));
  revision++;

  ok(await ins.rpc('record_insurance_policy', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_company_name: 'Toyota Protect Insurance (Chola MS)',
    p_policy_number: 'POL-DELV-001',
    p_policy_type: 'comprehensive_1_3',
    p_idv: 1200000,
    p_premium: 38000,
    p_start_date: '2026-11-24',
    p_end_date: '2027-11-23',
    p_document_id: insDocId,
    p_add_ons: ['zero_dep', 'engine_protect'],
  }));
  revision++;

  // Dispatch to Accounts
  ok(await bo.rpc('dispatch_bo_department', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision, p_target_dept: 'accounts',
  }));
  revision++;

  // Accounts records vehicle commercial invoice
  ok(await acc.rpc('record_vehicle_invoice', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_invoice_number: 'INV-DELV-001', p_invoice_date: '2026-11-24',
    p_ex_showroom: 1200000, p_tcs: 12000, p_total_amount: 1212000,
  }));
  revision++;

  // Accounts records road tax
  ok(await acc.rpc('record_road_tax_payment', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_receipt_no: 'TAX-DELV-001', p_amount: 180000, p_payment_mode: 'e_treasury_netbanking', p_paid_date: '2026-11-24',
  }));
  revision++;

  // Accounts records FASTag
  ok(await acc.rpc('record_fastag_issuance', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_fastag_tag_id: '607417-TAG-DELV',
    p_fastag_bank: 'ICICI Bank (NETC FASTag)',
    p_security_deposit: 200,
    p_wallet_balance: 300,
  }));
  revision++;

  // Accounts records accounts clearance
  ok(await acc.rpc('complete_accounts_clearance', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
  }));
  revision++;

  // BO records RTO registration
  ok(await bo.rpc('record_rto_registration', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_registration_no: 'KL-07-DE-7788', p_registration_date: '2026-11-24', p_location: 'Ernakulam RTO',
    p_hsrp_status: 'fitted', p_rc_status: 'generated',
  }));
  revision++;

  // ---------------------------------------------------------
  // 2. Test Accounts Financial Closure (SRC-X09)
  // ---------------------------------------------------------

  // A. Unauthorized roles cannot perform financial closure
  const unauthClosure = await so.rpc('record_financial_closure', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
  });
  check(unauthClosure.error && unauthClosure.error.code === '42501', 'SO rejected from recording commercial financial closure');

  const unauthSecurityClosure = await security.rpc('record_financial_closure', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
  });
  check(unauthSecurityClosure.error && unauthSecurityClosure.error.code === '42501', 'Security rejected from recording financial closure');

  // B. Stale revision rejected
  const staleClosure = await acc.rpc('record_financial_closure', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision - 1,
  });
  check(staleClosure.error && staleClosure.error.code === '40001', 'Stale revision rejected for financial closure');

  // C. Valid Accounts financial closure
  const closureOp = randomUUID();
  const closedId = ok(await acc.rpc('record_financial_closure', {
    p_operation: closureOp, p_booking: id, p_revision: revision,
    p_notes: 'All vehicle invoices, tax receipts, and customer payments verified. Cleared for vehicle release.',
  }));
  check(closedId === id, 'Financial closure recorded for booking');
  revision++;

  // D. Idempotent call with same operation ID
  const dupClosure = ok(await acc.rpc('record_financial_closure', {
    p_operation: closureOp, p_booking: id, p_revision: revision,
  }));
  check(dupClosure === id, 'Idempotent financial closure returns booking id');

  // Verify delivery_records row created with financial_closure_at
  const { data: delvRecord1 } = await acc.from('delivery_records').select('*').eq('booking_id', id).single();
  check(delvRecord1 !== null, 'delivery_records entry created');
  check(delvRecord1.financial_closure_at !== null, 'financial_closure_at timestamp set');
  check(delvRecord1.status === 'financial_closed', 'delivery_records status is financial_closed');

  // ---------------------------------------------------------
  // 3. Test Security Gate Pass Counter (SRC-X10, SRC-T07, R-15)
  // ---------------------------------------------------------

  // A. Non-security staff rejected from issuing gate pass
  const unauthGatePass = await acc.rpc('issue_gate_pass', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_gate_pass_no: 'GP-NT-2026-0042', p_officer_name: 'Officer Raman', p_odometer: 15,
  });
  check(unauthGatePass.error && unauthGatePass.error.code === '42501', 'Accounts rejected from issuing security gate pass');

  // B. Missing gate pass number rejected
  const emptyPass = await security.rpc('issue_gate_pass', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_gate_pass_no: '', p_officer_name: 'Officer Raman', p_odometer: 15,
  });
  check(emptyPass.error && emptyPass.error.code === '22023', 'Empty gate pass number rejected');

  // C. Security uploads gate pass document
  const gpPdf = Buffer.from('%PDF-1.4 synthetic security gate pass', 'utf8');
  const gpHash = createHash('sha256').update(gpPdf).digest('hex');
  const gpDocId = ok(await security.rpc('reserve_booking_document', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_kind: 'gate_pass', p_filename: 'gate-pass.pdf', p_mime: 'application/pdf',
    p_size: gpPdf.length, p_sha256: gpHash,
  }));
  await security.storage.from('booking-documents').upload(gpDocId, gpPdf, { contentType: 'application/pdf' });
  ok(await security.rpc('finalize_booking_document', { p_document: gpDocId, p_revision: revision, p_attestation: proof(gpDocId, gpHash) }));
  revision++;

  // D. Security successfully issues gate pass
  const gpOp = randomUUID();
  const gpResult = ok(await security.rpc('issue_gate_pass', {
    p_operation: gpOp, p_booking: id, p_revision: revision,
    p_gate_pass_no: 'GP-NT-2026-0042',
    p_officer_name: 'Officer Raman K (Head Guard)',
    p_odometer: 18,
    p_document_id: gpDocId,
  }));
  check(gpResult === id, 'Security gate pass issued');
  revision++;

  // E. Idempotence test
  const dupGp = ok(await security.rpc('issue_gate_pass', {
    p_operation: gpOp, p_booking: id, p_revision: revision,
    p_gate_pass_no: 'GP-NT-2026-0042', p_officer_name: 'Officer Raman K (Head Guard)', p_odometer: 18,
  }));
  check(dupGp === id, 'Idempotent gate pass issuance returns booking id');

  const { data: delvRecord2 } = await security.from('delivery_records').select('*').eq('booking_id', id).single();
  check(delvRecord2.gate_pass_no === 'GP-NT-2026-0042', 'Gate pass number recorded');
  check(delvRecord2.gate_pass_issued_at !== null, 'gate_pass_issued_at timestamp recorded');
  check(delvRecord2.security_officer_name === 'Officer Raman K (Head Guard)', 'Security officer name recorded');
  check(delvRecord2.odometer_reading === 18, 'Odometer reading recorded at vehicle showroom exit');
  check(delvRecord2.gate_pass_document_id === gpDocId, 'Gate pass document attached');
  check(delvRecord2.status === 'gate_pass_issued', 'Status transitioned to gate_pass_issued');

  // ---------------------------------------------------------
  // 4. Test Actual Vehicle Delivery Handover (R-15, Q-10)
  // ---------------------------------------------------------

  // A. Missing recipient rejected
  const emptyRecipient = await security.rpc('record_vehicle_delivery', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_recipient_name: '', p_relationship: 'Self', p_keys_handed_over: true,
  });
  check(emptyRecipient.error && emptyRecipient.error.code === '22023', 'Empty recipient name rejected');

  // B. Security uploads delivery acknowledgment document
  const delvAckPdf = Buffer.from('%PDF-1.4 synthetic delivery acknowledgment form', 'utf8');
  const delvAckHash = createHash('sha256').update(delvAckPdf).digest('hex');
  const delvAckDocId = ok(await security.rpc('reserve_booking_document', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_kind: 'delivery_acknowledgment', p_filename: 'delivery-ack.pdf', p_mime: 'application/pdf',
    p_size: delvAckPdf.length, p_sha256: delvAckHash,
  }));
  await security.storage.from('booking-documents').upload(delvAckDocId, delvAckPdf, { contentType: 'application/pdf' });
  ok(await security.rpc('finalize_booking_document', { p_document: delvAckDocId, p_revision: revision, p_attestation: proof(delvAckDocId, delvAckHash) }));
  revision++;

  // C. Security records physical vehicle delivery handover
  const delvOp = randomUUID();
  const delvResult = ok(await security.rpc('record_vehicle_delivery', {
    p_operation: delvOp, p_booking: id, p_revision: revision,
    p_recipient_name: 'Anil Kumar',
    p_relationship: 'Self (Customer)',
    p_keys_handed_over: true,
    p_notes: 'Owner manual, toolkit, 2 key fobs, and flower bouquet presented at vehicle delivery bay',
    p_document_id: delvAckDocId,
  }));
  check(delvResult === id, 'Vehicle delivery handover recorded');
  revision++;

  // D. Idempotence test
  const dupDelv = ok(await security.rpc('record_vehicle_delivery', {
    p_operation: delvOp, p_booking: id, p_revision: revision,
    p_recipient_name: 'Anil Kumar',
  }));
  check(dupDelv === id, 'Idempotent delivery record returns booking id');

  const { data: delvRecord3 } = await security.from('delivery_records').select('*').eq('booking_id', id).single();
  check(delvRecord3.delivered_at !== null, 'delivered_at timestamp recorded');
  check(delvRecord3.recipient_name === 'Anil Kumar', 'Recipient name recorded');
  check(delvRecord3.keys_handed_over === true, 'keys_handed_over confirmed');
  check(delvRecord3.delivery_document_id === delvAckDocId, 'Delivery acknowledgment document attached');
  check(delvRecord3.status === 'delivered', 'Status transitioned to delivered');

  // ---------------------------------------------------------
  // 5. Test Return File to Accounts (SRC-T07)
  // ---------------------------------------------------------

  // A. Non-security staff rejected from returning file
  const unauthReturn = await acc.rpc('return_file_to_accounts', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
  });
  check(unauthReturn.error && unauthReturn.error.code === '42501', 'Accounts rejected from executing security file return');

  // B. Security returns physical file to Accounts
  const returnOp = randomUUID();
  const returnResult = ok(await security.rpc('return_file_to_accounts', {
    p_operation: returnOp, p_booking: id, p_revision: revision,
  }));
  check(returnResult === id, 'File returned to Accounts by Security');
  revision++;

  // C. Idempotence test
  const dupReturn = ok(await security.rpc('return_file_to_accounts', {
    p_operation: returnOp, p_booking: id, p_revision: revision,
  }));
  check(dupReturn === id, 'Idempotent file return returns booking id');

  const { data: delvRecord4 } = await security.from('delivery_records').select('*').eq('booking_id', id).single();
  check(delvRecord4.security_file_returned_at !== null, 'security_file_returned_at timestamp recorded');
  check(delvRecord4.status === 'file_returned', 'Status transitioned to file_returned');

  // ---------------------------------------------------------
  // 6. Test Accounts Final Audit & Archive Storage (SRC-A07, R-15)
  // ---------------------------------------------------------

  // A. Security or SO rejected from archiving
  const unauthArchive = await security.rpc('record_final_archive', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_location: 'Rack A Shelf 1',
  });
  check(unauthArchive.error && unauthArchive.error.code === '42501', 'Security rejected from archiving file');

  // B. Missing archive location rejected
  const emptyLocation = await acc.rpc('record_final_archive', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_location: '',
  });
  check(emptyLocation.error && emptyLocation.error.code === '22023', 'Empty archive location rejected');

  // C. Accounts completes physical audit and archives file
  const archiveAudit = {
    form20_signed: true,
    disclaimer_signed: true,
    aadhaar_verified: true,
    pan_verified: true,
    vahan_receipt_original: true,
    gate_pass_security_copy: true,
    delivery_receipt_signed: true,
  };

  const archiveOp = randomUUID();
  const archiveResult = ok(await acc.rpc('record_final_archive', {
    p_operation: archiveOp, p_booking: id, p_revision: revision,
    p_location: 'Showroom Archive Room / Rack-04 / Shelf-B / Box-2026-11-042',
    p_physical_audit: archiveAudit,
  }));
  check(archiveResult === id, 'Accounts successfully archived file');
  revision++;

  // D. Idempotence test
  const dupArchive = ok(await acc.rpc('record_final_archive', {
    p_operation: archiveOp, p_booking: id, p_revision: revision,
    p_location: 'Showroom Archive Room / Rack-04 / Shelf-B / Box-2026-11-042',
  }));
  check(dupArchive === id, 'Idempotent archive returns booking id');

  // E. Verify full lifecycle completion: bookings.state is 'archived'
  const { data: finalBooking } = await acc.from('bookings').select('*').eq('id', id).single();
  check(finalBooking.state === 'archived', 'Bookings state reached final archived state');

  const { data: finalDelvRecord } = await acc.from('delivery_records').select('*').eq('booking_id', id).single();
  check(finalDelvRecord.archived_at !== null, 'archived_at timestamp recorded');
  check(finalDelvRecord.archive_location === 'Showroom Archive Room / Rack-04 / Shelf-B / Box-2026-11-042', 'Archive location recorded');
  check(finalDelvRecord.archive_physical_audit.form20_signed === true, 'Physical audit details saved');
  check(finalDelvRecord.status === 'archived', 'delivery_records status is archived');

  // ---------------------------------------------------------
  // 7. Verify Audit Events
  // ---------------------------------------------------------
  const auditRows = (await pool.query(
    "select action, reason from public.audit_events where target_id=$1 and action in ('accounts.financial_closure', 'security.gate_pass_issued', 'delivery.vehicle_delivered', 'security.file_returned_to_accounts', 'accounts.file_archived') order by occurred_at asc",
    [id]
  )).rows;
  const actionNames = auditRows.map(e => e.action);
  check(actionNames.includes('accounts.financial_closure'), 'Audit log includes accounts.financial_closure');
  check(actionNames.includes('security.gate_pass_issued'), 'Audit log includes security.gate_pass_issued');
  check(actionNames.includes('delivery.vehicle_delivered'), 'Audit log includes delivery.vehicle_delivered');
  check(actionNames.includes('security.file_returned_to_accounts'), 'Audit log includes security.file_returned_to_accounts');
  check(actionNames.includes('accounts.file_archived'), 'Audit log includes accounts.file_archived');

  // ---------------------------------------------------------
  // 8. Test RLS Isolation
  // ---------------------------------------------------------
  const { data: visibleToBranch1Security } = await security.from('delivery_records').select('*').eq('booking_id', id);
  check(visibleToBranch1Security.length === 1, 'Security in Branch 1 can view delivery record');

  const { data: visibleToBranch1Accounts } = await acc.from('delivery_records').select('*').eq('booking_id', id);
  check(visibleToBranch1Accounts.length === 1, 'Accounts in Branch 1 can view delivery record');

  const { data: visibleToOtherBranch } = await otherBranch.from('delivery_records').select('*').eq('booking_id', id);
  check(visibleToOtherBranch.length === 0, 'Staff in Branch 2 cannot view Branch 1 delivery record');

  const { data: visibleToAdmin } = await admin.from('delivery_records').select('*').eq('booking_id', id);
  check(visibleToAdmin.length === 1, 'Admin can view delivery record');

  // ---------------------------------------------------------
  // 9. Test Public Zero-Login Gate Pass Verification
  // ---------------------------------------------------------
  const anonClient = client(); // unauthenticated
  const pubVerify = ok(await anonClient.rpc('verify_public_gate_pass', { p_booking_id: id }));
  check(pubVerify.valid === true, 'Public gate pass verification is valid for issued gate pass');
  check(pubVerify.gate_pass_no === 'GP-NT-2026-0042', 'Public verification returns gate pass number');
  check(pubVerify.odometer_reading === 18, 'Public verification returns odometer reading');
  check(pubVerify.customer_name === 'Delivery Customer', 'Public verification returns customer name');
  check(pubVerify.chassis_number === 'MBJ11DELV2026999', 'Public verification returns chassis allocation');

  // Negative test: unissued or unknown booking ID returns valid: false
  const fakeVerify = ok(await anonClient.rpc('verify_public_gate_pass', { p_booking_id: randomUUID() }));
  check(fakeVerify.valid === false, 'Public gate pass verification fails for unknown booking');

  console.log(`Delivery, gate pass, handover and archive suite: ${checks} checks passed.`);
} finally {
  await pool.end();
}
