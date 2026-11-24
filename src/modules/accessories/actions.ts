'use server';
import { randomUUID, createHmac } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/modules/identity/actions';
import { requireStaff } from '@/modules/identity/session';
import { safeError, uuid, textField } from '@/lib/errors';
import { inspectDocument } from '@/modules/bookings/documents';

export async function recordAccessoriesWork(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  const revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before saving accessories work.' };
  }

  const stockStatus = textField(form, 'stock_status', 32);
  if (!stockStatus || !['full_stock', 'partial_stock'].includes(stockStatus)) {
    return { error: 'Select valid stock availability (Full Stock or Partial Stock).' };
  }

  const itemsRaw = form.get('items_json');
  let items: unknown[] = [];
  try {
    if (typeof itemsRaw === 'string' && itemsRaw.trim()) {
      items = JSON.parse(itemsRaw);
    }
  } catch {
    return { error: 'Invalid accessories checklist data.' };
  }

  const result = await client.rpc('record_accessories_work', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
    p_items: items as never,
    p_stock_status: stockStatus,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/accessories');
  revalidatePath(`/bookings/${id}`);
  return { success: 'Accessories fitment and stock checklist updated.' };
}

export async function recordAccessoriesBill(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  let revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before saving accessory bill.' };
  }

  const billNumber = textField(form, 'bill_number', 64);
  const billDate = textField(form, 'bill_date', 10) || new Date().toISOString().split('T')[0];
  const partsAmount = Number(form.get('parts_amount')) || 0;
  const labourAmount = Number(form.get('labour_amount')) || 0;
  const totalAmount = Number(form.get('total_amount'));
  const costAmount = Number(form.get('cost_amount')) || 0;

  if (!billNumber) return { error: 'Enter the accessory commercial bill / invoice number.' };
  if (!Number.isFinite(totalAmount) || totalAmount < 0) return { error: 'Enter a valid total bill amount.' };

  let documentId: string | null = null;
  const billFile = form.get('bill_file');
  if (billFile instanceof File && billFile.size > 0) {
    if (!['application/pdf', 'image/jpeg'].includes(billFile.type)) {
      return { error: 'Accessory bill must be a PDF or JPEG document.' };
    }
    const secret = process.env.DOCUMENT_VERIFICATION_SECRET;
    if (!secret) return { error: 'Document verification service unconfigured.' };

    try {
      const bytes = new Uint8Array(await billFile.arrayBuffer());
      const hash = inspectDocument(bytes, billFile.type);
      const filename = billFile.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 200) || 'accessories_bill';

      const reserveOp = randomUUID();
      const reserved = await client.rpc('reserve_booking_document', {
        p_operation: reserveOp,
        p_booking: id,
        p_revision: revision,
        p_kind: 'accessories_bill',
        p_filename: filename,
        p_mime: billFile.type,
        p_size: bytes.length,
        p_sha256: hash,
      });

      if (reserved.error || !reserved.data) {
        return { error: safeError(reserved.error) };
      }

      documentId = reserved.data;
      const uploaded = await client.storage.from('booking-documents').upload(documentId, bytes, {
        contentType: billFile.type,
        upsert: false,
      });

      if (uploaded.error && !['409', '400'].includes(String(uploaded.error.statusCode))) {
        return { error: 'Accessory bill upload did not complete. Please retry.' };
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
      return { error: err instanceof Error ? err.message : 'Invalid accessory bill file. Choose a valid PDF or JPEG.' };
    }
  }

  const result = await client.rpc('record_accessories_bill', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
    p_bill_number: billNumber,
    p_bill_date: billDate,
    p_parts_amount: partsAmount,
    p_labour_amount: labourAmount,
    p_total_amount: totalAmount,
    p_cost_amount: costAmount,
    p_document_id: documentId || undefined,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/accessories');
  revalidatePath(`/bookings/${id}`);
  return { success: 'Accessory commercial bill and profit calculation recorded.' };
}

export async function signAccessoriesMargin(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  const revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before signing margin details.' };
  }

  const result = await client.rpc('sign_accessories_margin', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/accessories');
  revalidatePath(`/bookings/${id}`);
  return { success: 'Accessory profit & loss margin signed off.' };
}

export async function submitAccessoriesToBO(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  const revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before submitting to Back Office.' };
  }

  const result = await client.rpc('submit_accessories_to_bo', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/accessories');
  revalidatePath('/back-office');
  revalidatePath(`/bookings/${id}`);
  return { success: 'Accessory bill collected and handed over to Back Office.' };
}

export async function forwardAccessoriesToAccounts(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  const revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before forwarding to Accounts.' };
  }

  const result = await client.rpc('forward_accessories_to_accounts', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/accessories');
  revalidatePath('/back-office');
  revalidatePath('/accounts');
  revalidatePath(`/bookings/${id}`);
  return { success: 'Accessory bills forwarded to Accounts for final financial clearance.' };
}

export async function recordRTORegistration(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  const revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before saving RTO registration details.' };
  }

  const registrationNo = textField(form, 'registration_no', 32);
  const registrationDate = textField(form, 'registration_date', 10) || new Date().toISOString().split('T')[0];
  const location = textField(form, 'location', 64) || 'Ernakulam RTO (KL-07)';
  const hsrpStatus = textField(form, 'hsrp_status', 32) || 'fitted';
  const rcStatus = textField(form, 'rc_status', 32) || 'generated';

  if (!registrationNo) return { error: 'Enter official RTO vehicle registration number.' };

  const result = await client.rpc('record_rto_registration', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
    p_registration_no: registrationNo,
    p_registration_date: registrationDate,
    p_location: location,
    p_hsrp_status: hsrpStatus,
    p_rc_status: rcStatus,
  });

  if (result.error) return { error: safeError(result.error) };

  revalidatePath('/bookings');
  revalidatePath('/back-office');
  revalidatePath(`/bookings/${id}`);
  return { success: 'Official RTO Registration & HSRP status recorded.' };
}

export async function fillDemoAccessories(_: ActionState, form: FormData): Promise<ActionState> {
  const { client, memberships } = await requireStaff();
  const id = String(form.get('booking'));
  let revision = Number(form.get('revision'));

  if (!uuid.test(id) || !Number.isSafeInteger(revision)) {
    return { error: 'Invalid booking file.' };
  }

  const secret = process.env.DOCUMENT_VERIFICATION_SECRET;
  if (!secret) return { error: 'Document verification service unconfigured.' };

  // 1. Record Accessories Checklist & Fitment Work (SRC-X01, SRC-X02, SRC-X03)
  const demoItems = [
    { name: 'Toyota Genuine 7D Premium Floor Mats', part_no: 'PZ001-0K001', qty: 1, fitted: true, remarks: 'Fitted' },
    { name: 'Mud Flaps Contoured Set (Front & Rear)', part_no: 'PZ002-0K002', qty: 1, fitted: true, remarks: 'Fitted' },
    { name: 'Door Visor Set with Chrome Beading', part_no: 'PZ003-0K003', qty: 1, fitted: true, remarks: 'Fitted' },
    { name: 'Dual-Tone Leatherette Seat Covers', part_no: 'PZ004-0K004', qty: 1, fitted: true, remarks: 'Fitted' },
    { name: 'Toyota Front & Rear Dashcam DVR Full HD', part_no: 'PZ005-0K005', qty: 1, fitted: true, remarks: 'Fitted & tested' }
  ];

  const workRes = await client.rpc('record_accessories_work', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_items: demoItems as never,
    p_stock_status: 'full_stock',
  });
  if (workRes.error) return { error: safeError(workRes.error) };
  revision++;

  // 2. Upload synthetic Accessories Bill Document
  const billPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Title (Nippon Toyota Genuine Accessories Tax Invoice) /Author (Accessories Dept) >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000100 00000 n \n0000000160 00000 n \ntrailer\n<< /Root 2 0 R /Size 4 >>\nstartxref\n230\n%%EOF\n'
  );
  const billHash = inspectDocument(billPdf, 'application/pdf');
  const billDocId = (await client.rpc('reserve_booking_document', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_kind: 'accessories_bill',
    p_filename: 'demo_toyota_accessories_invoice.pdf',
    p_mime: 'application/pdf',
    p_size: billPdf.length,
    p_sha256: billHash,
  })).data;

  if (billDocId) {
    await client.storage.from('booking-documents').upload(billDocId, billPdf, { contentType: 'application/pdf' });
    const att = createHmac('sha256', secret).update(`${billDocId}:${billHash}`).digest('hex');
    await client.rpc('finalize_booking_document', {
      p_document: billDocId,
      p_revision: revision,
      p_attestation: att,
    });
    revision++;
  }

  // 3. Record Accessories Commercial Bill (SRC-X04, SRC-X05)
  const billRes = await client.rpc('record_accessories_bill', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_bill_number: `ACC-INV-2026-${Math.floor(10000 + Math.random() * 90000)}`,
    p_bill_date: new Date().toISOString().split('T')[0],
    p_parts_amount: 42000,
    p_labour_amount: 3500,
    p_total_amount: 45500,
    p_cost_amount: 36000,
    p_document_id: billDocId || undefined,
  });
  if (billRes.error) return { error: safeError(billRes.error) };
  revision++;

  // 4. Sign Accessories Margin & Profit/Loss (SRC-X06)
  const signRes = await client.rpc('sign_accessories_margin', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
  });
  if (signRes.error) return { error: safeError(signRes.error) };
  revision++;

  // 5. If user is Admin, also auto-collect to BO and forward to Accounts
  const isAdmin = memberships.some(m => m.role === 'Admin');
  if (isAdmin) {
    const subRes = await client.rpc('submit_accessories_to_bo', {
      p_operation: randomUUID(),
      p_booking: id,
      p_revision: revision,
    });
    if (!subRes.error) {
      revision++;
      await client.rpc('forward_accessories_to_accounts', {
        p_operation: randomUUID(),
        p_booking: id,
        p_revision: revision,
      });
    }
  }

  revalidatePath('/bookings');
  revalidatePath('/accessories');
  revalidatePath('/back-office');
  revalidatePath('/accounts');
  redirect(`/bookings/${id}?toast=accessories`);
}
