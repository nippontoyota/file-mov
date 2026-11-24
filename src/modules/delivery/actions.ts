'use server';
import { randomUUID, createHmac } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/modules/identity/actions';
import { requireStaff } from '@/modules/identity/session';
import { safeError, uuid, textField } from '@/lib/errors';
import { inspectDocument } from '@/modules/bookings/documents';

export async function recordFinancialClosure(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  const revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before recording financial closure.' };
  }

  const notes = textField(form, 'notes', 500);

  const result = await client.rpc('record_financial_closure', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
    p_notes: notes || undefined,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/accounts');
  revalidatePath('/security');
  revalidatePath(`/bookings/${id}`);
  return { success: 'Accounts financial closure completed; file routed to Security for gate release.' };
}

export async function issueGatePass(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  let revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before issuing gate pass.' };
  }

  const gatePassNo = textField(form, 'gate_pass_no', 64);
  const officerName = textField(form, 'officer_name', 100) || 'Main Gate Security Officer';
  const odometer = Number(form.get('odometer')) || 15;

  if (!gatePassNo) return { error: 'Enter official showroom gate pass number.' };

  let documentId: string | null = null;
  const gatePassFile = form.get('gate_pass_file');
  if (gatePassFile instanceof File && gatePassFile.size > 0) {
    if (!['application/pdf', 'image/jpeg'].includes(gatePassFile.type)) {
      return { error: 'Gate pass document must be a PDF or JPEG file.' };
    }
    const secret = process.env.DOCUMENT_VERIFICATION_SECRET;
    if (!secret) return { error: 'Document verification service unconfigured.' };

    try {
      const bytes = new Uint8Array(await gatePassFile.arrayBuffer());
      const hash = inspectDocument(bytes, gatePassFile.type);
      const filename = gatePassFile.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 200) || 'gate_pass';

      const reserveOp = randomUUID();
      const reserved = await client.rpc('reserve_booking_document', {
        p_operation: reserveOp,
        p_booking: id,
        p_revision: revision,
        p_kind: 'gate_pass',
        p_filename: filename,
        p_mime: gatePassFile.type,
        p_size: bytes.length,
        p_sha256: hash,
      });

      if (reserved.error || !reserved.data) {
        return { error: safeError(reserved.error) };
      }

      documentId = reserved.data;
      const uploaded = await client.storage.from('booking-documents').upload(documentId, bytes, {
        contentType: gatePassFile.type,
        upsert: false,
      });

      if (uploaded.error && !['409', '400'].includes(String(uploaded.error.statusCode))) {
        return { error: 'Gate pass upload did not complete. Please retry.' };
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
      return { error: err instanceof Error ? err.message : 'Invalid gate pass document. Choose a valid PDF or JPEG.' };
    }
  }

  const result = await client.rpc('issue_gate_pass', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
    p_gate_pass_no: gatePassNo,
    p_officer_name: officerName,
    p_odometer: odometer,
    p_document_id: documentId || undefined,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/security');
  revalidatePath(`/bookings/${id}`);
  return { success: 'Official Security Gate Pass issued; vehicle cleared for exit.' };
}

export async function recordVehicleDelivery(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  let revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before recording vehicle delivery.' };
  }

  const recipientName = textField(form, 'recipient_name', 100);
  const relationship = textField(form, 'relationship', 64) || 'Self';
  const keysHandedOver = form.get('keys_handed_over') === 'on' || form.get('keys_handed_over') === 'true';
  const notes = textField(form, 'notes', 500);

  if (!recipientName) return { error: 'Enter customer / recipient name receiving the vehicle.' };

  let documentId: string | null = null;
  const deliveryFile = form.get('delivery_file');
  if (deliveryFile instanceof File && deliveryFile.size > 0) {
    if (!['application/pdf', 'image/jpeg'].includes(deliveryFile.type)) {
      return { error: 'Delivery acknowledgment must be a PDF or JPEG document.' };
    }
    const secret = process.env.DOCUMENT_VERIFICATION_SECRET;
    if (!secret) return { error: 'Document verification service unconfigured.' };

    try {
      const bytes = new Uint8Array(await deliveryFile.arrayBuffer());
      const hash = inspectDocument(bytes, deliveryFile.type);
      const filename = deliveryFile.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 200) || 'delivery_acknowledgment';

      const reserveOp = randomUUID();
      const reserved = await client.rpc('reserve_booking_document', {
        p_operation: reserveOp,
        p_booking: id,
        p_revision: revision,
        p_kind: 'delivery_acknowledgment',
        p_filename: filename,
        p_mime: deliveryFile.type,
        p_size: bytes.length,
        p_sha256: hash,
      });

      if (reserved.error || !reserved.data) {
        return { error: safeError(reserved.error) };
      }

      documentId = reserved.data;
      const uploaded = await client.storage.from('booking-documents').upload(documentId, bytes, {
        contentType: deliveryFile.type,
        upsert: false,
      });

      if (uploaded.error && !['409', '400'].includes(String(uploaded.error.statusCode))) {
        return { error: 'Delivery document upload did not complete. Please retry.' };
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
      return { error: err instanceof Error ? err.message : 'Invalid delivery document. Choose a valid PDF or JPEG.' };
    }
  }

  const result = await client.rpc('record_vehicle_delivery', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
    p_recipient_name: recipientName,
    p_relationship: relationship,
    p_keys_handed_over: keysHandedOver,
    p_notes: notes || undefined,
    p_document_id: documentId || undefined,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/security');
  revalidatePath(`/bookings/${id}`);
  return { success: 'Vehicle customer delivery recorded; keys and delivery kit presented.' };
}

export async function returnFileToAccounts(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  const revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before returning file to Accounts.' };
  }

  const result = await client.rpc('return_file_to_accounts', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/security');
  revalidatePath('/accounts');
  revalidatePath(`/bookings/${id}`);
  return { success: 'Physical customer file returned to Accounts for final audit & archiving.' };
}

export async function recordFinalArchive(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  const revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before archiving.' };
  }

  const location = textField(form, 'location', 128);
  if (!location) return { error: 'Enter physical archive storage location (e.g. Rack B4 / Box 12 / 2026-NOV).' };

  const auditRaw = form.get('audit_json');
  let audit: unknown = {};
  try {
    if (typeof auditRaw === 'string' && auditRaw.trim()) {
      audit = JSON.parse(auditRaw);
    }
  } catch {
    return { error: 'Invalid physical originals audit data.' };
  }

  const result = await client.rpc('record_final_archive', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
    p_location: location,
    p_physical_audit: audit as never,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/accounts');
  revalidatePath(`/bookings/${id}`);
  return { success: 'Customer file physically audited and archived in showroom records storage.' };
}

export async function fillDemoDeliveryAndArchive(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  let revision = Number(form.get('revision'));

  if (!uuid.test(id) || !Number.isSafeInteger(revision)) {
    return { error: 'Invalid booking file.' };
  }

  const secret = process.env.DOCUMENT_VERIFICATION_SECRET;
  if (!secret) return { error: 'Document verification service unconfigured.' };

  // 1. Record Financial Closure (SRC-X09)
  const closureRes = await client.rpc('record_financial_closure', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_notes: 'All vehicle invoices, FASTag charges, road tax, and accessory bills settled in full.',
  });
  if (closureRes.error) return { error: safeError(closureRes.error) };
  revision++;

  // 2. Upload synthetic Gate Pass PDF
  const gatePassPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Title (Nippon Toyota Official Security Gate Pass) /Author (Security Dept) >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000100 00000 n \n0000000160 00000 n \ntrailer\n<< /Root 2 0 R /Size 4 >>\nstartxref\n230\n%%EOF\n'
  );
  const gatePassHash = inspectDocument(gatePassPdf, 'application/pdf');
  const gatePassDocId = (await client.rpc('reserve_booking_document', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_kind: 'gate_pass',
    p_filename: 'demo_security_gate_pass.pdf',
    p_mime: 'application/pdf',
    p_size: gatePassPdf.length,
    p_sha256: gatePassHash,
  })).data;

  if (gatePassDocId) {
    await client.storage.from('booking-documents').upload(gatePassDocId, gatePassPdf, { contentType: 'application/pdf' });
    const att = createHmac('sha256', secret).update(`${gatePassDocId}:${gatePassHash}`).digest('hex');
    await client.rpc('finalize_booking_document', {
      p_document: gatePassDocId,
      p_revision: revision,
      p_attestation: att,
    });
    revision++;
  }

  // 3. Issue Gate Pass (SRC-X10, SRC-T07)
  const gpRes = await client.rpc('issue_gate_pass', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_gate_pass_no: `GP-NT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    p_officer_name: 'Babu K. (Main Gate Security Supervisor)',
    p_odometer: 18,
    p_document_id: gatePassDocId || undefined,
  });
  if (gpRes.error) return { error: safeError(gpRes.error) };
  revision++;

  // 4. Record Vehicle Delivery Handover (R-15, Q-10)
  const delRes = await client.rpc('record_vehicle_delivery', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_recipient_name: 'Customer (Registered Owner)',
    p_relationship: 'Self',
    p_keys_handed_over: true,
    p_notes: 'Vehicle delivered in immaculate condition. Both keys, owner manual, toolkit, and FASTag verified.',
  });
  if (delRes.error) return { error: safeError(delRes.error) };
  revision++;

  // 5. Return Physical File to Accounts (SRC-T07)
  const retRes = await client.rpc('return_file_to_accounts', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
  });
  if (retRes.error) return { error: safeError(retRes.error) };
  revision++;

  // 6. Record Final Physical Archive (SRC-A07, R-15)
  const auditLog = {
    obf_original: true,
    kyc_aadhaar_pan: true,
    receipts_advance_balance: true,
    insurance_policy_copy: true,
    commercial_tax_invoice: true,
    road_tax_challan: true,
    accessories_bills: true,
    form20_signed: true,
    disclaimer_signed: true,
    gate_pass_copy: true
  };

  const archRes = await client.rpc('record_final_archive', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_location: `Rack B4 / Shelf 3 / Box 2026-NOV / File-${Math.floor(100 + Math.random() * 900)}`,
    p_physical_audit: auditLog as never,
  });
  if (archRes.error) return { error: safeError(archRes.error) };

  revalidatePath('/bookings');
  revalidatePath('/accounts');
  revalidatePath('/security');
  redirect(`/bookings/${id}?toast=archived`);
}
