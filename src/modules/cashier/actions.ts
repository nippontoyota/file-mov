'use server';
import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/modules/identity/actions';
import { requireStaff } from '@/modules/identity/session';
import { safeError, uuid, textField } from '@/lib/errors';

export async function recordPayment(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = textField(form, 'booking', 36);
  const operation = textField(form, 'operation', 36);
  const method = textField(form, 'method', 20);
  const reference = textField(form, 'reference', 100);
  const document = textField(form, 'document', 36) || null;
  const rawAmount = Number(form.get('amount'));

  if (!id || !uuid.test(id) || !operation || !uuid.test(operation)) {
    return { error: 'Refresh the booking before recording payment.' };
  }
  if (!rawAmount || Number.isNaN(rawAmount) || rawAmount <= 0) {
    return { error: 'Enter a valid payment amount greater than zero.' };
  }
  if (!method || !['card', 'upi', 'cheque', 'cash'].includes(method)) {
    return { error: 'Select a valid payment mode (Card, UPI, Cheque, or Cash).' };
  }
  if (!reference) {
    return { error: 'Enter a payment reference, UTR, cheque number, or receipt note.' };
  }
  if (document && !uuid.test(document)) {
    return { error: 'Invalid document proof reference.' };
  }

  const result = await client.rpc('record_booking_payment', {
    p_operation: operation,
    p_booking: id,
    p_amount: rawAmount,
    p_method: method,
    p_reference: reference,
    p_proof_document: document || undefined,
  });

  if (result.error) return { error: safeError(result.error) };
  revalidatePath('/cashier');
  revalidatePath(`/bookings/${id}`);
  return { success: 'Booking payment advance recorded. Sent to Cashier for verification.' };
}

export async function verifyPayment(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const paymentId = textField(form, 'payment_id', 36);
  const operation = textField(form, 'operation', 36);
  const receiptNo = textField(form, 'receipt_no', 50);
  const document = textField(form, 'document', 36) || null;

  if (!paymentId || !uuid.test(paymentId) || !operation || !uuid.test(operation)) {
    return { error: 'Refresh the cashier page before verifying.' };
  }
  if (!receiptNo) {
    return { error: 'Enter the official dealership receipt number.' };
  }
  if (document && !uuid.test(document)) {
    return { error: 'Invalid proof document reference.' };
  }

  const result = await client.rpc('verify_booking_payment', {
    p_operation: operation,
    p_payment_id: paymentId,
    p_receipt_no: receiptNo,
    p_proof_document: document || undefined,
  });

  if (result.error) return { error: safeError(result.error) };
  revalidatePath('/cashier');
  return { success: `Receipt ${receiptNo} issued and payment verified.` };
}
