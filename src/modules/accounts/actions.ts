'use server';
import { randomUUID, createHmac } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/modules/identity/actions';
import { requireStaff } from '@/modules/identity/session';
import { safeError, uuid, textField } from '@/lib/errors';
import { inspectDocument } from '@/modules/bookings/documents';

export async function recordVehicleInvoice(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  let revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before saving invoice details.' };
  }

  const invoiceNumber = textField(form, 'invoice_number', 64);
  const invoiceDate = textField(form, 'invoice_date', 10) || new Date().toISOString().split('T')[0];
  const exShowroom = Number(form.get('ex_showroom_amount'));
  const tcs = Number(form.get('tcs_amount')) || 0;
  const totalAmount = Number(form.get('total_invoice_amount'));

  if (!invoiceNumber) return { error: 'Enter the commercial vehicle tax invoice number.' };
  if (!Number.isFinite(exShowroom) || exShowroom <= 0) return { error: 'Enter a valid ex-showroom price.' };
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) return { error: 'Enter a valid total invoice amount.' };

  // Optional invoice PDF/JPEG upload
  let documentId: string | null = null;
  const invoiceFile = form.get('invoice_file');
  if (invoiceFile instanceof File && invoiceFile.size > 0) {
    if (!['application/pdf', 'image/jpeg'].includes(invoiceFile.type)) {
      return { error: 'Vehicle invoice must be a PDF or JPEG document.' };
    }
    const secret = process.env.DOCUMENT_VERIFICATION_SECRET;
    if (!secret) return { error: 'Document verification service unconfigured.' };

    try {
      const bytes = new Uint8Array(await invoiceFile.arrayBuffer());
      const hash = inspectDocument(bytes, invoiceFile.type);
      const filename = invoiceFile.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 200) || 'vehicle_invoice';

      const reserveOp = randomUUID();
      const reserved = await client.rpc('reserve_booking_document', {
        p_operation: reserveOp,
        p_booking: id,
        p_revision: revision,
        p_kind: 'vehicle_invoice',
        p_filename: filename,
        p_mime: invoiceFile.type,
        p_size: bytes.length,
        p_sha256: hash,
      });

      if (reserved.error || !reserved.data) {
        return { error: safeError(reserved.error) };
      }

      documentId = reserved.data;
      const uploaded = await client.storage.from('booking-documents').upload(documentId, bytes, {
        contentType: invoiceFile.type,
        upsert: false,
      });

      if (uploaded.error && !['409', '400'].includes(String(uploaded.error.statusCode))) {
        return { error: 'Invoice document upload did not complete. Please retry.' };
      }

      const attestation = createHmac('sha256', secret).update(`${documentId}:${hash}`).digest('hex');
      const finalized = await client.rpc('finalize_booking_document', {
        p_document: documentId,
        p_revision: revision,
        p_attestation: attestation,
      });

      if (finalized.error) {
        return { error: safeError(finalized.error) };
      }
      revision++;
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Invalid invoice document. Choose a valid PDF or JPEG.' };
    }
  }

  const result = await client.rpc('record_vehicle_invoice', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
    p_invoice_number: invoiceNumber,
    p_invoice_date: invoiceDate,
    p_ex_showroom: exShowroom,
    p_tcs: tcs,
    p_total_amount: totalAmount,
    p_document_id: documentId || undefined,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/accounts');
  redirect(`/bookings/${id}?toast=clearance`);
}

export async function recordFastagIssuance(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  const revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before saving FASTag details.' };
  }

  const tagId = textField(form, 'fastag_tag_id', 64);
  const bank = textField(form, 'fastag_bank', 64);
  const deposit = Number(form.get('fastag_security_deposit')) || 200;
  const wallet = Number(form.get('fastag_wallet_balance')) || 300;

  if (!tagId) return { error: 'Enter the FASTag RFID Tag ID or barcode.' };
  if (!bank) return { error: 'Select or enter the issuing bank for the FASTag.' };

  const result = await client.rpc('record_fastag_issuance', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
    p_fastag_tag_id: tagId,
    p_fastag_bank: bank,
    p_security_deposit: deposit,
    p_wallet_balance: wallet,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/accounts');
  revalidatePath('/cashier');
  redirect(`/bookings/${id}?toast=clearance`);
}

export async function acknowledgeFastagHandover(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  const revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before acknowledging handover.' };
  }

  const notes = textField(form, 'notes', 200);

  const result = await client.rpc('acknowledge_fastag_handover', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
    p_notes: notes || undefined,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/accounts');
  revalidatePath('/cashier');
  redirect(`/bookings/${id}?toast=clearance`);
}

export async function recordRoadTaxPayment(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  let revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before saving road tax details.' };
  }

  const receiptNo = textField(form, 'road_tax_receipt_no', 64);
  const amount = Number(form.get('road_tax_amount'));
  const paymentMode = textField(form, 'road_tax_payment_mode', 32) || 'e_treasury_netbanking';
  const paidDate = textField(form, 'road_tax_paid_date', 10) || new Date().toISOString().split('T')[0];

  if (!receiptNo) return { error: 'Enter the e-Treasury road tax receipt or challan number.' };
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter a valid road tax amount.' };

  // Optional road tax PDF/JPEG upload
  let documentId: string | null = null;
  const taxFile = form.get('road_tax_file');
  if (taxFile instanceof File && taxFile.size > 0) {
    if (!['application/pdf', 'image/jpeg'].includes(taxFile.type)) {
      return { error: 'Road tax receipt must be a PDF or JPEG document.' };
    }
    const secret = process.env.DOCUMENT_VERIFICATION_SECRET;
    if (!secret) return { error: 'Document verification service unconfigured.' };

    try {
      const bytes = new Uint8Array(await taxFile.arrayBuffer());
      const hash = inspectDocument(bytes, taxFile.type);
      const filename = taxFile.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 200) || 'road_tax_challan';

      const reserveOp = randomUUID();
      const reserved = await client.rpc('reserve_booking_document', {
        p_operation: reserveOp,
        p_booking: id,
        p_revision: revision,
        p_kind: 'road_tax_receipt',
        p_filename: filename,
        p_mime: taxFile.type,
        p_size: bytes.length,
        p_sha256: hash,
      });

      if (reserved.error || !reserved.data) {
        return { error: safeError(reserved.error) };
      }

      documentId = reserved.data;
      const uploaded = await client.storage.from('booking-documents').upload(documentId, bytes, {
        contentType: taxFile.type,
        upsert: false,
      });

      if (uploaded.error && !['409', '400'].includes(String(uploaded.error.statusCode))) {
        return { error: 'Road tax receipt upload did not complete. Please retry.' };
      }

      const attestation = createHmac('sha256', secret).update(`${documentId}:${hash}`).digest('hex');
      const finalized = await client.rpc('finalize_booking_document', {
        p_document: documentId,
        p_revision: revision,
        p_attestation: attestation,
      });

      if (finalized.error) {
        return { error: safeError(finalized.error) };
      }
      revision++;
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Invalid road tax document. Choose a valid PDF or JPEG.' };
    }
  }

  const result = await client.rpc('record_road_tax_payment', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
    p_receipt_no: receiptNo,
    p_amount: amount,
    p_payment_mode: paymentMode,
    p_paid_date: paidDate,
    p_document_id: documentId || undefined,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/accounts');
  redirect(`/bookings/${id}?toast=clearance`);
}

export async function completeAccountsClearance(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  const revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before completing clearance.' };
  }

  const result = await client.rpc('complete_accounts_clearance', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/accounts');
  revalidatePath('/back-office');
  redirect(`/bookings/${id}?toast=clearance`);
}

export async function fillDemoAccounts(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  let revision = Number(form.get('revision'));

  if (!uuid.test(id) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before running demo pre-fill.' };
  }

  // 1. Generate synthetic Invoice PDF
  const secret = process.env.DOCUMENT_VERIFICATION_SECRET;
  if (!secret) return { error: 'Document verification unconfigured.' };

  const invoicePdf = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Title (Nippon Toyota Commercial Tax Invoice) /Author (Accounts Dept) >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000095 00000 n \n0000000155 00000 n \ntrailer\n<< /Root 2 0 R /Size 4 >>\nstartxref\n225\n%%EOF\n'
  );
  const invHash = inspectDocument(invoicePdf, 'application/pdf');
  const invDocId = (await client.rpc('reserve_booking_document', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_kind: 'vehicle_invoice',
    p_filename: 'demo_commercial_invoice.pdf',
    p_mime: 'application/pdf',
    p_size: invoicePdf.length,
    p_sha256: invHash,
  })).data;

  if (invDocId) {
    await client.storage.from('booking-documents').upload(invDocId, invoicePdf, { contentType: 'application/pdf' });
    const att = createHmac('sha256', secret).update(`${invDocId}:${invHash}`).digest('hex');
    await client.rpc('finalize_booking_document', {
      p_document: invDocId,
      p_revision: revision,
      p_attestation: att,
    });
    revision++;
  }

  // 2. Record Vehicle Tax Invoice
  const invRes = await client.rpc('record_vehicle_invoice', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_invoice_number: `INV-NT-2026-${Math.floor(10000 + Math.random() * 90000)}`,
    p_invoice_date: new Date().toISOString().split('T')[0],
    p_ex_showroom: 1850000,
    p_tcs: 18500,
    p_total_amount: 1868500,
    p_document_id: invDocId || undefined,
  });
  if (invRes.error) return { error: safeError(invRes.error) };
  revision++;

  // 3. Record FASTag Issuance
  const fastagRes = await client.rpc('record_fastag_issuance', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_fastag_tag_id: `607417-TAG-${Math.floor(100000 + Math.random() * 900000)}`,
    p_fastag_bank: 'ICICI Bank (NETC FASTag)',
    p_security_deposit: 200,
    p_wallet_balance: 300,
  });
  if (fastagRes.error) return { error: safeError(fastagRes.error) };
  revision++;

  // 4. Generate synthetic Road Tax Challan PDF
  const taxPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Title (Kerala Motor Vehicle Dept e-Treasury Challan) /Author (e-Treasury MVD) >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000105 00000 n \n0000000165 00000 n \ntrailer\n<< /Root 2 0 R /Size 4 >>\nstartxref\n235\n%%EOF\n'
  );
  const taxHash = inspectDocument(taxPdf, 'application/pdf');
  const taxDocId = (await client.rpc('reserve_booking_document', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_kind: 'road_tax_receipt',
    p_filename: 'demo_kerala_road_tax_challan.pdf',
    p_mime: 'application/pdf',
    p_size: taxPdf.length,
    p_sha256: taxHash,
  })).data;

  if (taxDocId) {
    await client.storage.from('booking-documents').upload(taxDocId, taxPdf, { contentType: 'application/pdf' });
    const att = createHmac('sha256', secret).update(`${taxDocId}:${taxHash}`).digest('hex');
    await client.rpc('finalize_booking_document', {
      p_document: taxDocId,
      p_revision: revision,
      p_attestation: att,
    });
    revision++;
  }

  // 5. Record Kerala Road Tax Payment
  const taxRes = await client.rpc('record_road_tax_payment', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_receipt_no: `KL-ETR-2026-${Math.floor(100000 + Math.random() * 900000)}`,
    p_amount: 277500,
    p_payment_mode: 'e_treasury_netbanking',
    p_paid_date: new Date().toISOString().split('T')[0],
    p_document_id: taxDocId || undefined,
  });
  if (taxRes.error) return { error: safeError(taxRes.error) };
  revision++;

  // 6. Complete Accounts Clearance
  const clearRes = await client.rpc('complete_accounts_clearance', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
  });
  if (clearRes.error) return { error: safeError(clearRes.error) };

  revalidatePath('/bookings');
  revalidatePath('/accounts');
  revalidatePath('/back-office');
  redirect(`/bookings/${id}?toast=clearance`);
}
