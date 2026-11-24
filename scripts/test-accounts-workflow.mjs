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

const scope = 'd4000000-0000-0000-0000-000000000002'; // so2 in team3/branch1

try {
  const so = await login('so2@example.test');
  const tl = await login('tl3@example.test');
  const sm = await login('sm4@example.test');
  const bo = await login('bo5@example.test');
  const ins = await login('insurance6@example.test');
  const acc = await login('accounts7@example.test');
  const cashier = await login('cashier8@example.test');
  const otherBranch = await login('so13@example.test');

  // 1. Create a booking through SO -> TL -> SM -> bo_review
  const data = {
    customer_code: `ACC-TEST-${randomUUID()}`,
    customer_name: 'Accounts Test Customer',
    booking_number: 'ACC-FLOW-01',
    booking_date: '2026-11-24',
    enquiry_number: 'ENQ-ACC-01',
    communication_address: 'Kalamassery Showroom Test Address',
    contact_person: 'Accounts Test Customer',
    pin: '682024',
    model: 'Innova HyCross',
    suffix_1: 'ZX (O)',
    colour_1: 'Pearl White',
    registration_same: 'yes',
    registration_name: 'Accounts Test Customer',
    registration_address: 'Kalamassery Showroom Test Address',
    registration_pin: '682024',
    registration_model: 'Innova HyCross',
    registration_suffix: 'ZX (O)',
    registration_colour: 'Pearl White',
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
    p_operation: randomUUID(), p_booking: id, p_amount: 50000, p_method: 'upi', p_reference: 'UPI-ACC-ADV-001', p_payment_type: 'booking_advance', p_proof_document: advPayDocId,
  }));
  ok(await cashier.rpc('verify_booking_payment', {
    p_operation: randomUUID(), p_payment_id: payId, p_receipt_no: 'REC-ACC-ADV-01',
  }));

  // Advance workflow to BO review
  ok(await so.rpc('send_booking_to_tl', { p_operation: randomUUID(), p_booking: id, p_revision: revision }));
  revision++;
  ok(await tl.rpc('receive_sales_file', { p_booking: id, p_revision: revision }));
  ok(await tl.rpc('approve_booking_tl', { p_operation: randomUUID(), p_booking: id, p_revision: revision }));
  revision++;
  ok(await sm.rpc('allocate_vehicle_sm', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_allocation_ref: 'MBJAA528409988221',
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
  ok(await so.rpc('finalize_booking_document', { p_document: balPayDocId, p_revision: revision, p_attestation: proof(balPayDocId, hash) }));
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

  // Back Office PDI & VAHAN Staging
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

  // 2. Pre-dispatch access checks: Accounts cannot see booking before dispatch
  const preDispatch = ok(await acc.from('bookings').select('id').eq('id', id));
  check(preDispatch.length === 0, 'Accounts cannot view booking before BO accounts dispatch');

  // Non-accounts role cannot record vehicle invoice
  const nonAccRecord = await so.rpc('record_vehicle_invoice', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_invoice_number: 'INV-TEST-001', p_invoice_date: '2026-11-24',
    p_ex_showroom: 1850000, p_total_amount: 1868500,
  });
  check(nonAccRecord.error?.code === '42501', 'SO cannot record commercial vehicle invoice');

  // 3. BO dispatches to Insurance and Accounts
  ok(await bo.rpc('dispatch_bo_department', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision, p_target_dept: 'insurance',
  }));
  revision++;
  ok(await bo.rpc('dispatch_bo_department', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision, p_target_dept: 'accounts',
  }));
  revision++;

  // Now Accounts can see the file!
  const postDispatch = ok(await acc.from('bookings').select('id').eq('id', id));
  check(postDispatch.length === 1 && postDispatch[0].id === id, 'Accounts can view booking after dispatch');

  // Cross-branch isolation: other branch staff cannot see booking
  const crossBranch = ok(await otherBranch.from('bookings').select('id').eq('id', id));
  check(crossBranch.length === 0, 'Cross-branch staff cannot view booking');

  // 4. RULE D-16 INVARIANT TEST:
  // Invoicing is strictly gated on Motor Insurance issuance.
  // Attempting to record invoice before insurance must fail!
  const prematureInvoice = await acc.rpc('record_vehicle_invoice', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_invoice_number: 'INV-NT-2026-001', p_invoice_date: '2026-11-24',
    p_ex_showroom: 1850000, p_total_amount: 1868500,
  });
  check(prematureInvoice.error?.code === '22023', 'Rule D-16 enforced: Vehicle invoice rejected before insurance policy issued');
  check(prematureInvoice.error?.message?.includes('Rule D-16 violation'), 'Error message cites Rule D-16 violation');

  // Attempting to reserve vehicle_invoice document before insurance policy issued also fails
  const prematureDoc = await acc.rpc('reserve_booking_document', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_kind: 'vehicle_invoice', p_filename: 'invoice.pdf', p_mime: 'application/pdf',
    p_size: pdf.length, p_sha256: hash,
  });
  check(prematureDoc.error?.code === '22023', 'Rule D-16 enforced: Invoice document reservation rejected before insurance issued');

  // 5. Insurance desk issues policy
  const polDocId = ok(await ins.rpc('reserve_booking_document', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_kind: 'insurance_policy', p_filename: 'policy.pdf', p_mime: 'application/pdf',
    p_size: pdf.length, p_sha256: hash,
  }));
  await ins.storage.from('booking-documents').upload(polDocId, pdf, { contentType: 'application/pdf' });
  ok(await ins.rpc('finalize_booking_document', { p_document: polDocId, p_revision: revision, p_attestation: proof(polDocId, hash) }));
  revision++;

  ok(await ins.rpc('record_insurance_policy', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_company_name: 'ICICI Lombard General Insurance',
    p_policy_number: 'POL-ICICI-ACC-99',
    p_policy_type: 'comprehensive_1_3',
    p_idv: 1850000,
    p_premium: 46250,
  }));
  revision++;

  // 6. Now that insurance is issued, Accounts can record the Commercial Tax Invoice!
  // Missing invoice number fails
  const missingInvNo = await acc.rpc('record_vehicle_invoice', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_invoice_number: '', p_invoice_date: '2026-11-24',
    p_ex_showroom: 1850000, p_total_amount: 1868500,
  });
  check(missingInvNo.error?.code === '22023', 'Empty invoice number rejected');

  // Non-positive price fails
  const zeroPrice = await acc.rpc('record_vehicle_invoice', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_invoice_number: 'INV-NT-2026-08492', p_invoice_date: '2026-11-24',
    p_ex_showroom: 0, p_total_amount: 1868500,
  });
  check(zeroPrice.error?.code === '22023', 'Zero ex-showroom price rejected');

  // Upload vehicle invoice PDF
  const invDocId = ok(await acc.rpc('reserve_booking_document', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_kind: 'vehicle_invoice', p_filename: 'commercial_invoice.pdf', p_mime: 'application/pdf',
    p_size: pdf.length, p_sha256: hash,
  }));
  await acc.storage.from('booking-documents').upload(invDocId, pdf, { contentType: 'application/pdf' });
  ok(await acc.rpc('finalize_booking_document', { p_document: invDocId, p_revision: revision, p_attestation: proof(invDocId, hash) }));
  revision++;

  // Record valid Commercial Invoice
  const invoiceOp = randomUUID();
  const invRes = ok(await acc.rpc('record_vehicle_invoice', {
    p_operation: invoiceOp, p_booking: id, p_revision: revision,
    p_invoice_number: 'INV-NT-2026-08492',
    p_invoice_date: '2026-11-24',
    p_ex_showroom: 1850000,
    p_tcs: 18500,
    p_total_amount: 1868500,
    p_document_id: invDocId,
  }));
  check(invRes === id, 'record_vehicle_invoice returned booking ID');
  revision++;

  // Verify accounts_records has invoice details
  const recAfterInv = ok(await acc.from('accounts_records').select('*').eq('booking_id', id).single());
  check(recAfterInv.invoice_number === 'INV-NT-2026-08492', 'Invoice number recorded');
  check(Number(recAfterInv.ex_showroom_amount) === 1850000, 'Ex-showroom amount recorded');
  check(Number(recAfterInv.total_invoice_amount) === 1868500, 'Total invoice amount recorded');
  check(recAfterInv.invoice_document_id === invDocId, 'Invoice PDF document linked');
  check(recAfterInv.invoiced_by !== null, 'Invoiced by staff recorded');

  // Idempotency: replaying invoice with same operation ID returns same result
  const invReplay = ok(await acc.rpc('record_vehicle_invoice', {
    p_operation: invoiceOp, p_booking: id, p_revision: revision - 1,
    p_invoice_number: 'INV-NT-2026-08492',
    p_invoice_date: '2026-11-24',
    p_ex_showroom: 1850000,
    p_tcs: 18500,
    p_total_amount: 1868500,
    p_document_id: invDocId,
  }));
  check(invReplay === id, 'Invoice recording replay is idempotent');

  // 7. FASTag Issuance & Cashier Handover (SRC-A04, SRC-C01, SRC-H09)
  const fastagRes = ok(await acc.rpc('record_fastag_issuance', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_fastag_tag_id: '607417-TAG-882910',
    p_fastag_bank: 'ICICI Bank (NETC FASTag)',
    p_security_deposit: 200,
    p_wallet_balance: 300,
  }));
  check(fastagRes === id, 'FASTag issuance returned booking ID');
  revision++;

  const recAfterTag = ok(await acc.from('accounts_records').select('*').eq('booking_id', id).single());
  check(recAfterTag.fastag_tag_id === '607417-TAG-882910', 'FASTag tag ID recorded');
  check(recAfterTag.fastag_handover_status === 'pending_handover', 'Initial handover status is pending_handover');

  // Cashier acknowledges physical FASTag handover
  const handoverRes = ok(await cashier.rpc('acknowledge_fastag_handover', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_notes: 'Affixed to windshield and handed receipt to customer',
  }));
  check(handoverRes === id, 'Cashier acknowledged FASTag handover');
  revision++;

  const recAfterHandover = ok(await acc.from('accounts_records').select('*').eq('booking_id', id).single());
  check(recAfterHandover.fastag_handover_status === 'handed_over', 'Handover status updated to handed_over');
  check(recAfterHandover.fastag_handover_by !== null, 'Handover by staff recorded');

  // 8. Kerala Road Tax & Statutory Statutory Payment (SRC-A05, SRC-A06, SRC-H07)
  const taxDocId = ok(await acc.rpc('reserve_booking_document', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_kind: 'road_tax_receipt', p_filename: 'road_tax_challan.pdf', p_mime: 'application/pdf',
    p_size: pdf.length, p_sha256: hash,
  }));
  await acc.storage.from('booking-documents').upload(taxDocId, pdf, { contentType: 'application/pdf' });
  ok(await acc.rpc('finalize_booking_document', { p_document: taxDocId, p_revision: revision, p_attestation: proof(taxDocId, hash) }));
  revision++;

  const taxRes = ok(await acc.rpc('record_road_tax_payment', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_receipt_no: 'KL-ETR-2026-98124',
    p_amount: 277500,
    p_payment_mode: 'e_treasury_netbanking',
    p_paid_date: '2026-11-24',
    p_document_id: taxDocId,
  }));
  check(taxRes === id, 'Road tax payment returned booking ID');
  revision++;

  const recAfterTax = ok(await acc.from('accounts_records').select('*').eq('booking_id', id).single());
  check(recAfterTax.road_tax_receipt_no === 'KL-ETR-2026-98124', 'Road tax receipt number recorded');
  check(Number(recAfterTax.road_tax_amount) === 277500, 'Road tax amount recorded');
  check(recAfterTax.road_tax_document_id === taxDocId, 'Road tax challan document linked');

  // 9. Accounts Clearance Completion (SRC-A06, SRC-H06, SRC-T04)
  const clearRes = ok(await acc.rpc('complete_accounts_clearance', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
  }));
  check(clearRes === id, 'complete_accounts_clearance returned booking ID');
  revision++;

  const finalRec = ok(await acc.from('accounts_records').select('*').eq('booking_id', id).single());
  check(finalRec.status === 'cleared', 'Accounts record status is cleared');

  const finalPrep = ok(await bo.from('bo_preparations').select('*').eq('booking_id', id).single());
  check(finalPrep.accounts_completed_at !== null, 'bo_preparations.accounts_completed_at recorded');
  check(finalPrep.accounts_completed_by !== null, 'bo_preparations.accounts_completed_by recorded');

  // 10. Audit Trail Verification
  const auditRows = (await pool.query(
    "select action, reason from public.audit_events where target_id=$1 and action in ('accounts.invoice_recorded', 'accounts.fastag_issued', 'cashier.fastag_handed_over', 'accounts.road_tax_recorded', 'accounts.clearance_completed') order by occurred_at asc",
    [id]
  )).rows;
  check(auditRows.length === 5, 'All 5 Accounts & Cashier audit events recorded');
  check(auditRows.some(a => a.action === 'accounts.invoice_recorded' && a.reason.includes('INV-NT-2026-08492')), 'Invoice audit logged');
  check(auditRows.some(a => a.action === 'cashier.fastag_handed_over'), 'Cashier FASTag handover audit logged');
  check(auditRows.some(a => a.action === 'accounts.road_tax_recorded' && a.reason.includes('KL-ETR-2026-98124')), 'Road tax audit logged');
  check(auditRows.some(a => a.action === 'accounts.clearance_completed'), 'Accounts clearance audit logged');

  console.log(`Passed ${checks} Accounts commercial invoicing, FASTag, road tax, and clearance checks.`);
} finally {
  await pool.end();
}
