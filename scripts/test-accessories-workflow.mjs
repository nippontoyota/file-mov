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
  const accessories = await login('accessories9@example.test');
  const admin = await login('admin1@example.test');
  const otherBranch = await login('so13@example.test');

  // 1. Create a booking through SO -> TL -> SM -> bo_review
  const data = {
    customer_code: `ACC-TEST-${randomUUID()}`,
    customer_name: 'Accessories Test Customer',
    booking_number: 'ACCS-FLOW-01',
    booking_date: '2026-11-24',
    enquiry_number: 'ENQ-ACCS-01',
    communication_address: 'Kalamassery Showroom Test Address',
    contact_person: 'Accessories Test Customer',
    pin: '682024',
    model: 'Innova HyCross',
    suffix_1: 'ZX (O)',
    colour_1: 'Blackish Ageha',
    registration_same: 'yes',
    registration_name: 'Accessories Test Customer',
    registration_address: 'Kalamassery Showroom Test Address',
    registration_pin: '682024',
    registration_model: 'Innova HyCross',
    registration_suffix: 'ZX (O)',
    registration_colour: 'Blackish Ageha',
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
    p_operation: randomUUID(), p_booking: id, p_amount: 50000, p_method: 'upi', p_reference: 'UPI-ACCS-ADV-001', p_payment_type: 'booking_advance', p_proof_document: advPayDocId,
  }));
  ok(await cashier.rpc('verify_booking_payment', {
    p_operation: randomUUID(), p_payment_id: payId, p_receipt_no: 'REC-ACCS-ADV-01',
  }));

  // Advance workflow to BO review
  ok(await so.rpc('send_booking_to_tl', { p_operation: randomUUID(), p_booking: id, p_revision: revision }));
  revision++;
  ok(await tl.rpc('receive_sales_file', { p_booking: id, p_revision: revision }));
  ok(await tl.rpc('approve_booking_tl', { p_operation: randomUUID(), p_booking: id, p_revision: revision }));
  revision++;
  ok(await sm.rpc('allocate_vehicle_sm', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_allocation_ref: 'MBJ11ACCS2026998',
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
    p_operation: randomUUID(), p_booking: id, p_amount: 2200000, p_method: 'upi', p_reference: 'NEFT-ACCS-BAL-001', p_payment_type: 'balance_payment', p_proof_document: balPayDocId,
  }));
  ok(await cashier.rpc('verify_booking_payment', {
    p_operation: randomUUID(), p_payment_id: balPayId, p_receipt_no: 'REC-ACCS-BAL-01',
  }));

  ok(await sm.rpc('handover_to_bo_sm', { p_operation: randomUUID(), p_booking: id, p_revision: revision }));
  revision++;

  // BO PDI
  ok(await bo.rpc('record_bo_pdi', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_status: 'passed', p_inspector: 'Kalamassery Yard Lead', p_notes: 'All checks passed',
  }));
  revision++;

  // 2. Test Accessories Dispatch Pre-condition
  const earlyWork = await accessories.rpc('record_accessories_work', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_items: [{ name: 'Floor Mats', part_no: 'PZ01', qty: 1, fitted: true }],
    p_stock_status: 'full_stock',
  });
  check(earlyWork.error && earlyWork.error.message.includes('accessories_not_dispatched'), 'record_accessories_work rejected before BO dispatch');

  // BO dispatches to Accessories
  ok(await bo.rpc('dispatch_bo_department', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision, p_target_dept: 'accessories',
  }));
  revision++;

  // 3. Test Unauthorized callers for record_accessories_work
  const unauthWork = await acc.rpc('record_accessories_work', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_items: [], p_stock_status: 'full_stock',
  });
  check(unauthWork.error && unauthWork.error.code === '42501', 'Accounts rejected from recording accessories work');

  const otherBranchWork = await otherBranch.rpc('record_accessories_work', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_items: [], p_stock_status: 'full_stock',
  });
  check(otherBranchWork.error && otherBranchWork.error.code === '42501', 'Other branch rejected from recording accessories work');

  // 4. Record partial stock work (SRC-X01, SRC-X02, SRC-X03)
  const checklist1 = [
    { name: '7D Floor Mats', part_no: 'PZ001', qty: 1, fitted: true, remarks: 'Fitted' },
    { name: 'Rear Spoiler', part_no: 'PZ002', qty: 1, fitted: false, remarks: 'Backordered at plant' }
  ];
  ok(await accessories.rpc('record_accessories_work', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_items: checklist1, p_stock_status: 'partial_stock',
  }));
  revision++;

  let { data: rec } = await accessories.from('accessories_records').select('*').eq('booking_id', id).single();
  check(rec.stock_status === 'partial_stock', 'Partial stock status recorded');
  check(rec.status === 'in_progress', 'Accessories status is in_progress for partial stock');
  check(Array.isArray(rec.items) && rec.items.length === 2, 'Checklist items saved');

  // Update to full stock
  const checklist2 = [
    { name: '7D Floor Mats', part_no: 'PZ001', qty: 1, fitted: true, remarks: 'Fitted' },
    { name: 'Rear Spoiler', part_no: 'PZ002', qty: 1, fitted: true, remarks: 'Stock arrived and fitted' }
  ];
  ok(await accessories.rpc('record_accessories_work', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_items: checklist2, p_stock_status: 'full_stock',
  }));
  revision++;

  ({ data: rec } = await accessories.from('accessories_records').select('*').eq('booking_id', id).single());
  check(rec.stock_status === 'full_stock', 'Full stock status updated');
  check(rec.status === 'fitted', 'Accessories status transitioned to fitted');

  // 5. Test Accessories Commercial Bill (SRC-X04, SRC-X05)
  // Upload accessories_bill document
  const accBillDocId = ok(await accessories.rpc('reserve_booking_document', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_kind: 'accessories_bill', p_filename: 'toyota_accessories_invoice.pdf', p_mime: 'application/pdf',
    p_size: pdf.length, p_sha256: hash,
  }));
  await accessories.storage.from('booking-documents').upload(accBillDocId, pdf, { contentType: 'application/pdf' });
  ok(await accessories.rpc('finalize_booking_document', { p_document: accBillDocId, p_revision: revision, p_attestation: proof(accBillDocId, hash) }));
  revision++;

  // Unauthorized caller for bill
  const unauthBill = await cashier.rpc('record_accessories_bill', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_bill_number: 'ACC-001', p_bill_date: '2026-11-24', p_parts_amount: 10000, p_labour_amount: 1000, p_total_amount: 11000,
  });
  check(unauthBill.error && unauthBill.error.code === '42501', 'Cashier rejected from recording accessory bill');

  // Record bill with parts 42000, labour 3500, total 45500, cost 36000
  ok(await accessories.rpc('record_accessories_bill', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_bill_number: 'ACC-INV-2026-8801',
    p_bill_date: '2026-11-24',
    p_parts_amount: 42000,
    p_labour_amount: 3500,
    p_total_amount: 45500,
    p_cost_amount: 36000,
    p_document_id: accBillDocId,
  }));
  revision++;

  ({ data: rec } = await accessories.from('accessories_records').select('*').eq('booking_id', id).single());
  check(rec.bill_number === 'ACC-INV-2026-8801', 'Accessory bill number recorded');
  check(Number(rec.total_bill_amount) === 45500, 'Total bill amount recorded');
  check(Number(rec.profit_loss_amount) === 9500, 'Profit amount correctly computed (45500 - 36000 = 9500)');
  check(Number(rec.margin_percentage) === 20.88, 'Margin percentage correctly computed (20.88%)');
  check(rec.status === 'billed', 'Accessories status is billed');
  check(rec.payment_status === 'collected', 'Payment status is collected');

  // 6. Test Profit/Loss Margin Sign-off (SRC-X06)
  const unauthSign = await so.rpc('sign_accessories_margin', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
  });
  check(unauthSign.error && unauthSign.error.code === '42501', 'SO rejected from signing accessories margin');

  // Sign margin as Accessories officer
  ok(await accessories.rpc('sign_accessories_margin', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
  }));
  revision++;

  ({ data: rec } = await accessories.from('accessories_records').select('*').eq('booking_id', id).single());
  check(rec.margin_signed === true, 'Margin signed boolean is true');
  check(rec.margin_signed_by !== null, 'Margin signed by recorded');

  // 7. Test Handoff: SO collection & submission to BO (SRC-X07)
  const unauthSub = await cashier.rpc('submit_accessories_to_bo', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
  });
  check(unauthSub.error && unauthSub.error.code === '42501', 'Cashier rejected from submitting accessories to BO');

  ok(await so.rpc('submit_accessories_to_bo', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
  }));
  revision++;

  ({ data: rec } = await accessories.from('accessories_records').select('*').eq('booking_id', id).single());
  check(rec.status === 'submitted_so', 'Accessories status is submitted_so');
  check(rec.so_collected_at !== null, 'so_collected_at timestamp recorded');

  // 8. Test BO Forward to Accounts (SRC-X08)
  const unauthFwd = await so.rpc('forward_accessories_to_accounts', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
  });
  check(unauthFwd.error && unauthFwd.error.code === '42501', 'SO rejected from forwarding accessories to Accounts');

  ok(await bo.rpc('forward_accessories_to_accounts', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
  }));
  revision++;

  ({ data: rec } = await accessories.from('accessories_records').select('*').eq('booking_id', id).single());
  check(rec.status === 'forwarded_bo', 'Accessories status is forwarded_bo');
  check(rec.bo_forwarded_at !== null, 'bo_forwarded_at timestamp recorded');

  const { data: prepCheck } = await bo.from('bo_preparations').select('*').eq('booking_id', id).single();
  check(prepCheck.accessories_completed_at !== null, 'bo_preparations.accessories_completed_at marked');

  // 9. Test RTO Registration Prerequisites (SRC-B06, SRC-H08)
  // RTO registration rejected before Kerala Road Tax payment
  const earlyRto = await bo.rpc('record_rto_registration', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_registration_no: 'KL-07-CS-4491', p_registration_date: '2026-11-24', p_location: 'Ernakulam RTO',
  });
  check(earlyRto.error && earlyRto.error.message.includes('road_tax_required_for_rto'), 'RTO registration rejected before road tax payment');

  // Dispatch to Insurance & issue policy (Rule D-16 prerequisite for accounts invoice)
  ok(await bo.rpc('dispatch_bo_department', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision, p_target_dept: 'insurance',
  }));
  revision++;

  const insDocId = ok(await ins.rpc('reserve_booking_document', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_kind: 'insurance_policy', p_filename: 'policy.pdf', p_mime: 'application/pdf',
    p_size: pdf.length, p_sha256: hash,
  }));
  await ins.storage.from('booking-documents').upload(insDocId, pdf, { contentType: 'application/pdf' });
  ok(await ins.rpc('finalize_booking_document', { p_document: insDocId, p_revision: revision, p_attestation: proof(insDocId, hash) }));
  revision++;

  ok(await ins.rpc('record_insurance_policy', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_company_name: 'ICICI Lombard General Insurance',
    p_policy_number: 'POL-ACCS-001',
    p_policy_type: 'comprehensive_1_3',
    p_idv: 2100000,
    p_premium: 58000,
    p_start_date: '2026-11-24',
    p_end_date: '2027-11-23',
    p_document_id: insDocId,
    p_add_ons: ['zero_dep'],
  }));
  revision++;

  // Dispatch to Accounts, record invoice & road tax
  ok(await bo.rpc('dispatch_bo_department', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision, p_target_dept: 'accounts',
  }));
  revision++;

  ok(await acc.rpc('record_vehicle_invoice', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_invoice_number: 'INV-ACCS-01', p_invoice_date: '2026-11-24',
    p_ex_showroom: 2100000, p_tcs: 21000, p_total_amount: 2121000,
  }));
  revision++;

  ok(await acc.rpc('record_road_tax_payment', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_receipt_no: 'KL-ETR-ACCS-001', p_amount: 315000, p_payment_mode: 'e_treasury_netbanking', p_paid_date: '2026-11-24',
  }));
  revision++;

  // 10. Record RTO Registration (SRC-B06, SRC-H08)
  const unauthRto = await acc.rpc('record_rto_registration', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_registration_no: 'KL-07-CS-4491', p_registration_date: '2026-11-24', p_location: 'Ernakulam RTO',
  });
  check(unauthRto.error && unauthRto.error.code === '42501', 'Accounts rejected from recording RTO registration');

  ok(await bo.rpc('record_rto_registration', {
    p_operation: randomUUID(), p_booking: id, p_revision: revision,
    p_registration_no: 'KL-07-CS-4491',
    p_registration_date: '2026-11-24',
    p_location: 'Ernakulam RTO (KL-07)',
    p_hsrp_status: 'fitted',
    p_rc_status: 'generated',
  }));
  revision++;

  const { data: finalPrep } = await bo.from('bo_preparations').select('*').eq('booking_id', id).single();
  check(finalPrep.rto_registration_no === 'KL-07-CS-4491', 'Permanent RTO registration number recorded');
  check(finalPrep.hsrp_status === 'fitted', 'HSRP status recorded as fitted');
  check(finalPrep.rc_status === 'generated', 'RC status recorded as generated');
  check(finalPrep.rto_completed_at !== null, 'rto_completed_at timestamp recorded');

  // 11. Test RLS isolation: Other branch cannot view accessories records
  const { data: visibleToBranch1 } = await accessories.from('accessories_records').select('*').eq('booking_id', id);
  check(visibleToBranch1.length === 1, 'Accessories officer in Branch 1 can view record');

  const { data: visibleToOtherBranch } = await otherBranch.from('accessories_records').select('*').eq('booking_id', id);
  check(visibleToOtherBranch.length === 0, 'Staff in Branch 2 cannot view Branch 1 accessories record');

  const { data: visibleToAdmin } = await admin.from('accessories_records').select('*').eq('booking_id', id);
  check(visibleToAdmin.length === 1, 'Admin can view accessories record');

  console.log(`Accessories and RTO registration suite: ${checks} checks passed.`);
} finally {
  await pool.end();
}
