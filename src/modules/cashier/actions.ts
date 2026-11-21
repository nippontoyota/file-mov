'use server';
import { createHmac } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/modules/identity/actions';
import { requireStaff } from '@/modules/identity/session';
import { safeError, uuid, textField } from '@/lib/errors';
import { inspectDocument } from '@/modules/bookings/documents';

export async function recordPayment(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = textField(form, 'booking', 36);
  const operation = textField(form, 'operation', 36);
  const method = textField(form, 'method', 20);
  const reference = textField(form, 'reference', 100);
  let document = textField(form, 'document', 36) || null;
  const rawAmount = Number(form.get('amount'));
  const proofFile = form.get('proof_file');

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

  // Upload proof document if file is provided by SO
  if (proofFile instanceof File && proofFile.size > 0) {
    const secret = process.env.DOCUMENT_VERIFICATION_SECRET;
    if (!secret) return { error: 'Document verification is not configured.' };

    const { data: b, error: bError } = await client
      .from('bookings')
      .select('revision')
      .eq('id', id)
      .single();

    if (bError || !b) return { error: 'Booking file unavailable.' };

    try {
      const bytes = new Uint8Array(await proofFile.arrayBuffer());
      const hash = inspectDocument(bytes, proofFile.type);
      const filename = proofFile.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 200) || 'payment_proof';

      const reserveOp = crypto.randomUUID();
      const reserved = await client.rpc('reserve_booking_document', {
        p_operation: reserveOp,
        p_booking: id,
        p_revision: b.revision,
        p_kind: 'payment_receipt',
        p_filename: filename,
        p_mime: proofFile.type,
        p_size: bytes.length,
        p_sha256: hash,
      });

      if (reserved.error || !reserved.data) {
        return { error: safeError(reserved.error) };
      }

      const docId = reserved.data;
      const uploaded = await client.storage.from('booking-documents').upload(docId, bytes, {
        contentType: proofFile.type,
        upsert: false,
      });

      if (uploaded.error && !['409', '400'].includes(String(uploaded.error.statusCode))) {
        return { error: 'File upload did not complete. Please retry.' };
      }

      const attestation = createHmac('sha256', secret).update(`${docId}:${hash}`).digest('hex');
      const finalized = await client.rpc('finalize_booking_document', {
        p_document: docId,
        p_revision: b.revision,
        p_attestation: attestation,
      });

      if (finalized.error) {
        return { error: safeError(finalized.error) };
      }

      document = docId;
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Invalid proof document file. Choose a valid PDF or JPEG.' };
    }
  }

  const paymentType = textField(form, 'payment_type', 30) || 'booking_advance';
  const result = await client.rpc('record_booking_payment', {
    p_operation: operation,
    p_booking: id,
    p_amount: rawAmount,
    p_method: method,
    p_reference: reference,
    p_proof_document: document || undefined,
    p_payment_type: paymentType,
  });

  if (result.error) return { error: safeError(result.error) };
  revalidatePath('/cashier');
  revalidatePath(`/bookings/${id}`);
  return {
    success: paymentType === 'balance_payment'
      ? 'Vehicle balance payment recorded. Sent to Cashier for verification.'
      : 'Booking payment advance recorded. Sent to Cashier for verification.',
  };
}

export async function verifyPayment(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const paymentId = textField(form, 'payment_id', 36);
  const operation = textField(form, 'operation', 36);
  const receiptNo = textField(form, 'receipt_no', 50);
  let document = textField(form, 'document', 36) || null;
  const proofFile = form.get('proof_file');

  if (!paymentId || !uuid.test(paymentId) || !operation || !uuid.test(operation)) {
    return { error: 'Refresh the cashier page before verifying.' };
  }
  if (!receiptNo) {
    return { error: 'Enter the official dealership receipt number.' };
  }
  if (document && !uuid.test(document)) {
    return { error: 'Invalid proof document reference.' };
  }

  // Handle direct file upload from Cashier counter if proofFile is provided
  if (proofFile instanceof File && proofFile.size > 0) {
    const secret = process.env.DOCUMENT_VERIFICATION_SECRET;
    if (!secret) return { error: 'Document verification is not configured.' };

    const { data: pay, error: payError } = await client
      .from('booking_payments')
      .select('booking_id,bookings(revision)')
      .eq('id', paymentId)
      .single();

    if (payError || !pay) return { error: 'Payment record not found.' };

    const bookingId = pay.booking_id;
    const revision = (pay.bookings as unknown as { revision: number } | null)?.revision || 1;

    try {
      const bytes = new Uint8Array(await proofFile.arrayBuffer());
      const hash = inspectDocument(bytes, proofFile.type);
      const filename = proofFile.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 200) || 'counter_payment_proof';

      const reserveOp = crypto.randomUUID();
      const reserved = await client.rpc('reserve_booking_document', {
        p_operation: reserveOp,
        p_booking: bookingId,
        p_revision: revision,
        p_kind: 'payment_receipt',
        p_filename: filename,
        p_mime: proofFile.type,
        p_size: bytes.length,
        p_sha256: hash,
      });

      if (reserved.error || !reserved.data) {
        return { error: safeError(reserved.error) };
      }

      const docId = reserved.data;
      const uploaded = await client.storage.from('booking-documents').upload(docId, bytes, {
        contentType: proofFile.type,
        upsert: false,
      });

      if (uploaded.error && !['409', '400'].includes(String(uploaded.error.statusCode))) {
        return { error: 'File upload did not complete. Please retry.' };
      }

      const attestation = createHmac('sha256', secret).update(`${docId}:${hash}`).digest('hex');
      const finalized = await client.rpc('finalize_booking_document', {
        p_document: docId,
        p_revision: revision,
        p_attestation: attestation,
      });

      if (finalized.error) {
        return { error: safeError(finalized.error) };
      }

      document = docId;
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Invalid proof document file. Choose a valid PDF or JPEG.' };
    }
  }

  const result = await client.rpc('verify_booking_payment', {
    p_operation: operation,
    p_payment_id: paymentId,
    p_receipt_no: receiptNo,
    p_proof_document: document || undefined,
  });

  if (result.error) {
    if (result.error.message?.includes('proof_document_required') || result.error.code === '22023') {
      return { error: 'A proof document (PDF or JPEG) must be attached before issuing the receipt.' };
    }
    return { error: safeError(result.error) };
  }

  revalidatePath('/cashier');
  return { success: `Receipt ${receiptNo} issued and payment verified.` };
}
