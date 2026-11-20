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
  const cashier = await login('cashier8@example.test');
  const otherBranch = await login('so13@example.test');

  // 1. Create a draft booking
  const data = {
    customer_code: `PAY-TEST-${randomUUID()}`,
    customer_name: 'Cashier Test Customer',
    booking_number: 'PAY-TEST-01',
    booking_date: '2026-11-20',
    enquiry_number: 'ENQ-PAY-01',
    communication_address: 'Kalamassery Showroom Test Address',
    contact_person: 'Cashier Test Customer',
    pin: '682024',
    model: 'Innova HyCross',
    suffix_1: 'ZX',
    colour_1: 'Super White',
    registration_same: 'yes',
    registration_name: 'Cashier Test Customer',
    registration_address: 'Kalamassery Showroom Test Address',
    registration_pin: '682024',
    registration_model: 'Innova HyCross',
    registration_suffix: 'ZX',
    registration_colour: 'Super White',
  };
  const save = { p_operation: randomUUID(), p_membership: scope, p_data: data, p_confirmed: true };
  const bookingId = ok(await so.rpc('save_booking_draft', save));

  // 2. Access control: cross-branch cannot record payment
  const crossBranchPay = await otherBranch.rpc('record_booking_payment', {
    p_operation: randomUUID(), p_booking: bookingId, p_amount: 50000,
    p_method: 'upi', p_reference: 'UTR-CROSS-01',
  });
  check(crossBranchPay.error?.code === '42501', 'Cross-branch staff cannot record payment');

  // 3. Validation: invalid payment method or negative amount rejected
  const invalidMethod = await so.rpc('record_booking_payment', {
    p_operation: randomUUID(), p_booking: bookingId, p_amount: 50000,
    p_method: 'bitcoin', p_reference: 'BTC-01',
  });
  check(invalidMethod.error?.code === '22023', 'Invalid payment method rejected');

  const invalidAmount = await so.rpc('record_booking_payment', {
    p_operation: randomUUID(), p_booking: bookingId, p_amount: -100,
    p_method: 'cash', p_reference: 'CASH-01',
  });
  check(invalidAmount.error?.code === '22023', 'Negative payment amount rejected');

  // 4. Test all 4 payment modes: Card, UPI, Cheque, Cash
  const testModes = [
    { method: 'card', amount: 30000, ref: 'POS-AUTH-98210', receipt: 'RCP-CARD-001' },
    { method: 'upi', amount: 50000, ref: 'UPI-UTR-8829104', receipt: 'RCP-UPI-002' },
    { method: 'cheque', amount: 100000, ref: 'CHQ-HDFC-00912', receipt: 'RCP-CHQ-003' },
    { method: 'cash', amount: 25000, ref: 'CASH-COUNTER-01', receipt: 'RCP-CSH-004' },
  ];

  for (const item of testModes) {
    const payOp = randomUUID();
    const payId = ok(await so.rpc('record_booking_payment', {
      p_operation: payOp, p_booking: bookingId, p_amount: item.amount,
      p_method: item.method, p_reference: item.ref,
    }));
    check(Boolean(payId), `Payment record created for ${item.method}`);

    // Idempotency: re-running with same operation ID returns same payId
    const retryPay = ok(await so.rpc('record_booking_payment', {
      p_operation: payOp, p_booking: bookingId, p_amount: item.amount,
      p_method: item.method, p_reference: item.ref,
    }));
    check(retryPay === payId, `Payment recording idempotent for ${item.method}`);

    // Verify initial status is pending_verification
    const initialRecord = ok(await cashier.from('booking_payments').select('*').eq('id', payId).single());
    check(initialRecord.status === 'pending_verification', `${item.method} initial status is pending_verification`);
    check(Number(initialRecord.amount) === item.amount, `${item.method} amount matches`);
    check(initialRecord.reference_no === item.ref, `${item.method} reference matches`);

    // Non-cashier cannot verify payment
    const soVerify = await so.rpc('verify_booking_payment', {
      p_operation: randomUUID(), p_payment_id: payId, p_receipt_no: item.receipt,
    });
    check(soVerify.error?.code === '42501', `SO cannot verify payment for ${item.method}`);

    // Cashier verifies payment
    const verifyOp = randomUUID();
    const verifiedId = ok(await cashier.rpc('verify_booking_payment', {
      p_operation: verifyOp, p_payment_id: payId, p_receipt_no: item.receipt,
    }));
    check(verifiedId === payId, `Cashier verified payment ${payId}`);

    // Verify verified record
    const verifiedRecord = ok(await cashier.from('booking_payments').select('*').eq('id', payId).single());
    check(verifiedRecord.status === 'verified', `${item.method} status updated to verified`);
    check(verifiedRecord.receipt_no === item.receipt, `${item.method} receipt number matches`);
    check(verifiedRecord.verified_by !== null, `${item.method} verified_by attributed`);
    check(verifiedRecord.verified_at !== null, `${item.method} verified_at timestamp set`);

    // Verification idempotency
    const retryVerify = ok(await cashier.rpc('verify_booking_payment', {
      p_operation: verifyOp, p_payment_id: payId, p_receipt_no: item.receipt,
    }));
    check(retryVerify === payId, `Verification idempotent for ${item.method}`);
  }

  // Verify Audit Events
  const audit = (await pool.query(
    "select action, reason from public.audit_events where action in ('cashier.payment_recorded','cashier.payment_verified') order by occurred_at asc"
  )).rows;
  check(audit.some(r => r.action === 'cashier.payment_recorded'), 'Audit event cashier.payment_recorded logged');
  check(audit.some(r => r.action === 'cashier.payment_verified'), 'Audit event cashier.payment_verified logged');

  console.log(`Passed ${checks} Cashier payments, 4 payment modes, RLS, and verification checks.`);
} finally {
  await pool.end();
}
