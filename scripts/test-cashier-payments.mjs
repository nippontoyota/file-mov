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

const scope = 'd4000000-0000-0000-0000-000000000002'; // so2 in team3/branch1
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
const hash = createHash('sha256').update(pdf).digest('hex');
const proof = id => createHmac('sha256', process.env.DOCUMENT_VERIFICATION_SECRET).update(`${id}:${hash}`).digest('hex');

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
  let revision = 1;

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

  // Helper to attach a document
  async function attachDoc(caller, kind, rev) {
    const docId = ok(await caller.rpc('reserve_booking_document', {
      p_operation: randomUUID(), p_booking: bookingId, p_revision: rev,
      p_kind: kind, p_filename: `${kind}.pdf`, p_mime: 'application/pdf',
      p_size: pdf.length, p_sha256: hash,
    }));
    ok(await caller.storage.from('booking-documents').upload(docId, pdf, { contentType: 'application/pdf' }));
    ok(await caller.rpc('finalize_booking_document', {
      p_document: docId, p_revision: rev, p_attestation: proof(docId),
    }));
    return docId;
  }

  // 4. Test all 4 payment modes: Card, UPI, Cheque, Cash
  const testModes = [
    { method: 'card', amount: 30000, ref: 'POS-AUTH-98210', receipt: 'RCP-CARD-001' },
    { method: 'upi', amount: 50000, ref: 'UPI-UTR-8829104', receipt: 'RCP-UPI-002' },
    { method: 'cheque', amount: 100000, ref: 'CHQ-HDFC-00912', receipt: 'RCP-CHQ-003' },
    { method: 'cash', amount: 25000, ref: 'CASH-COUNTER-01', receipt: 'RCP-CSH-004' },
  ];

  for (const item of testModes) {
    // A. SO records payment without proof initially
    const payOp = randomUUID();
    const payId = ok(await so.rpc('record_booking_payment', {
      p_operation: payOp, p_booking: bookingId, p_amount: item.amount,
      p_method: item.method, p_reference: item.ref,
    }));
    check(Boolean(payId), `Payment record created for ${item.method}`);

    // B. Verify initial status is pending_verification with no proof
    const initialRecord = ok(await cashier.from('booking_payments').select('*').eq('id', payId).single());
    check(initialRecord.status === 'pending_verification', `${item.method} initial status is pending_verification`);
    check(Number(initialRecord.amount) === item.amount, `${item.method} amount matches`);
    check(initialRecord.reference_no === item.ref, `${item.method} reference matches`);
    check(initialRecord.proof_document_id === null, `${item.method} has no proof attached initially`);

    // C. Non-cashier cannot verify payment
    const soVerify = await so.rpc('verify_booking_payment', {
      p_operation: randomUUID(), p_payment_id: payId, p_receipt_no: item.receipt,
    });
    check(soVerify.error?.code === '42501', `SO cannot verify payment for ${item.method}`);

    // D. Cashier CANNOT verify without proof attached (strictly blocked)
    const noProofVerify = await cashier.rpc('verify_booking_payment', {
      p_operation: randomUUID(), p_payment_id: payId, p_receipt_no: item.receipt,
    });
    check(noProofVerify.error?.code === '22023', `Verification without proof rejected for ${item.method}`);

    // E. SO CANNOT send booking to TL while payment is pending verification
    const sendWhilePending = await so.rpc('send_booking_to_tl', {
      p_operation: randomUUID(), p_booking: bookingId, p_revision: revision,
    });
    check(sendWhilePending.error?.code === '22023', `SO cannot send to TL while ${item.method} payment is pending verification`);

    // F. Attach proof document (Cashier uploads proof slip)
    const proofDocId = await attachDoc(cashier, 'payment_receipt', revision);
    revision++;

    // G. Cashier verifies payment with proof document provided
    const verifyOp = randomUUID();
    const verifiedId = ok(await cashier.rpc('verify_booking_payment', {
      p_operation: verifyOp, p_payment_id: payId, p_receipt_no: item.receipt,
      p_proof_document: proofDocId,
    }));
    check(verifiedId === payId, `Cashier verified payment ${payId} after proof attached`);

    // H. Verify verified record state
    const verifiedRecord = ok(await cashier.from('booking_payments').select('*').eq('id', payId).single());
    check(verifiedRecord.status === 'verified', `${item.method} status updated to verified`);
    check(verifiedRecord.receipt_no === item.receipt, `${item.method} receipt number matches`);
    check(verifiedRecord.proof_document_id === proofDocId, `${item.method} proof document linked`);
    check(verifiedRecord.verified_by !== null, `${item.method} verified_by attributed`);
    check(verifiedRecord.verified_at !== null, `${item.method} verified_at timestamp set`);

    // I. Verification idempotency
    const retryVerify = ok(await cashier.rpc('verify_booking_payment', {
      p_operation: verifyOp, p_payment_id: payId, p_receipt_no: item.receipt,
      p_proof_document: proofDocId,
    }));
    check(retryVerify === payId, `Verification idempotent for ${item.method}`);
  }

  // 5. Now that all payments are verified, attach mandatory Aadhaar & PAN and send to TL
  await attachDoc(so, 'aadhaar', revision);
  revision++;
  await attachDoc(so, 'pan', revision);
  revision++;

  const sendSuccess = ok(await so.rpc('send_booking_to_tl', {
    p_operation: randomUUID(), p_booking: bookingId, p_revision: revision,
  }));
  check(sendSuccess === bookingId, 'SO successfully sent booking to TL once all payments verified');

  const finalBooking = ok(await so.from('bookings').select('state').eq('id', bookingId).single());
  check(finalBooking.state === 'tl_review', 'Booking transitioned to tl_review');

  // Verify Audit Events
  const audit = (await pool.query(
    "select action, reason from public.audit_events where action in ('cashier.payment_recorded','cashier.payment_verified','booking.sent_to_tl') order by occurred_at asc"
  )).rows;
  check(audit.some(r => r.action === 'cashier.payment_recorded'), 'Audit event cashier.payment_recorded logged');
  check(audit.some(r => r.action === 'cashier.payment_verified'), 'Audit event cashier.payment_verified logged');
  check(audit.some(r => r.action === 'booking.sent_to_tl'), 'Audit event booking.sent_to_tl logged');

  console.log(`Passed ${checks} Cashier payments, proof validation, RLS, and SO->TL gate checks.`);
} finally {
  await pool.end();
}
