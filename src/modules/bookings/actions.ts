'use server';
import { randomUUID, createHash, createHmac } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/modules/identity/actions';
import { requireStaff } from '@/modules/identity/session';
import { safeError, uuid, textField } from '@/lib/errors';
import { inspectDocument } from './documents';
import { bookingFields, type BookingData, generateSampleBookingData } from './fields';

export async function saveBooking(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const operation = textField(form, 'operation', 36);
  const membership = textField(form, 'membership', 36);
  const id = textField(form, 'booking', 36);
  const revision = Number(form.get('revision'));
  if (!uuid.test(operation) || !uuid.test(membership) || (id && (!uuid.test(id) || !Number.isSafeInteger(revision) || revision<1))) return { error: 'Refresh and select your current Sales Officer assignment.' };
  const same=form.get('registration_same');
  if(same!=='yes' && same!=='no') return {error:'Choose whether registration details match the booking.'};
  const data: BookingData = {registration_same:same};
  for (const field of bookingFields) {
    const value = form.get(field.key);
    const max = 'type' in field && field.type==='textarea' ? 2000 : 200;
    if (typeof value !== 'string' || value.trim().length>max) return { error: `Check ${field.label.toLowerCase()}. Use at most ${max} characters.` };
    data[field.key] = value.trim();
  }
  const result = await client.rpc('save_booking_draft', { p_operation: operation, p_membership: membership, p_data: data, p_confirmed: true, p_booking: id || undefined, p_revision: id ? revision : undefined });
  if (result.error || !result.data) return { error: safeError(result.error) };
  revalidatePath('/bookings');
  revalidatePath(`/bookings/${result.data}`);
  redirect(`/bookings/${result.data}?saved=1`);
}

export async function createTestBooking(_: ActionState, form: FormData): Promise<ActionState> {
  const { client, memberships } = await requireStaff();
  const so = memberships.find(m => m.role === 'SO');
  if (!so) return { error: 'An active Sales Officer assignment is required to create a booking draft.' };

  const operation = textField(form, 'operation', 36) || randomUUID();
  const testData = generateSampleBookingData();

  const result = await client.rpc('save_booking_draft', {
    p_operation: operation,
    p_membership: so.id,
    p_data: testData,
    p_confirmed: true,
  });

  if (result.error || !result.data) return { error: safeError(result.error) };
  const bookingId = result.data;
  let revision = 1;

  // Automatically attach sample KYC documents and advance payment for Shiva (test)
  const secret = process.env.DOCUMENT_VERIFICATION_SECRET;
  if (secret) {
    try {
      const dummyPdf = Buffer.from(
        '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n'
      );
      const hash = createHash('sha256').update(dummyPdf).digest('hex');

      for (const kind of ['aadhaar', 'pan'] as const) {
        const reserveOp = randomUUID();
        const reserved = await client.rpc('reserve_booking_document', {
          p_operation: reserveOp,
          p_booking: bookingId,
          p_revision: revision,
          p_kind: kind,
          p_filename: `${kind}_shiva_test.pdf`,
          p_mime: 'application/pdf',
          p_size: dummyPdf.length,
          p_sha256: hash,
        });

        if (reserved.data) {
          const docId = reserved.data;
          await client.storage.from('booking-documents').upload(docId, dummyPdf, {
            contentType: 'application/pdf',
            upsert: true,
          });
          const attestation = createHmac('sha256', secret).update(`${docId}:${hash}`).digest('hex');
          await client.rpc('finalize_booking_document', {
            p_document: docId,
            p_revision: revision,
            p_attestation: attestation,
          });
          revision++;
        }
      }

      // Attach sample payment proof slip
      const paySlipOp = randomUUID();
      const reservedSlip = await client.rpc('reserve_booking_document', {
        p_operation: paySlipOp,
        p_booking: bookingId,
        p_revision: revision,
        p_kind: 'payment_receipt',
        p_filename: 'advance_payment_slip_shiva_test.pdf',
        p_mime: 'application/pdf',
        p_size: dummyPdf.length,
        p_sha256: hash,
      });

      let proofDocId: string | undefined = undefined;
      if (reservedSlip.data) {
        proofDocId = reservedSlip.data;
        await client.storage.from('booking-documents').upload(proofDocId, dummyPdf, {
          contentType: 'application/pdf',
          upsert: true,
        });
        const attestation = createHmac('sha256', secret).update(`${proofDocId}:${hash}`).digest('hex');
        await client.rpc('finalize_booking_document', {
          p_document: proofDocId,
          p_revision: revision,
          p_attestation: attestation,
        });
        revision++;
      }

      // Record initial booking advance payment (₹25,000 via UPI)
      await client.rpc('record_booking_payment', {
        p_operation: randomUUID(),
        p_booking: bookingId,
        p_amount: 25000,
        p_method: 'upi',
        p_reference: `UPI-NT-${Math.floor(100000 + Math.random() * 900000)}`,
        p_payment_type: 'booking_advance',
        p_proof_document: proofDocId,
      });
    } catch {
      // Continue even if simulation attachment fails
    }
  }

  revalidatePath('/bookings');
  revalidatePath('/cashier');
  revalidatePath(`/bookings/${bookingId}`);
  redirect(`/bookings/${bookingId}?saved=1`);
}

export async function sendToTL(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireStaff();const id=String(form.get('booking'));const operation=String(form.get('operation'));const revision=Number(form.get('revision'));
 if(!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) return {error:'Refresh the booking before sending.'};
 const result=await client.rpc('send_booking_to_tl',{p_operation:operation,p_booking:id,p_revision:revision});
 if(result.error) {
   if (result.error.message?.includes('pending_payment_verification')) {
     return { error: 'The booking advance payment is awaiting Cashier verification and receipt confirmation before sending to Team Leader.' };
   }
   return {error:result.error.code==='22023'?'Complete the required booking details, attach both registered-owner documents and ensure your team has an active TL.':safeError(result.error)};
 }
 revalidatePath('/bookings');redirect(`/bookings/${id}`);
}
export async function receiveFile(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireStaff();const id=String(form.get('booking'));const revision=Number(form.get('revision'));
 if(!uuid.test(id) || !Number.isSafeInteger(revision)) return {error:'Refresh the file before confirming receipt.'};
 const result=await client.rpc('receive_sales_file',{p_booking:id,p_revision:revision});
 if(result.error) return {error:safeError(result.error)};
 revalidatePath('/bookings');redirect(`/bookings/${id}`);
}

export async function approveTL(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireStaff();const id=String(form.get('booking'));const operation=String(form.get('operation'));const revision=Number(form.get('revision'));
 if(!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) return {error:'Refresh the file before approving.'};
 const result=await client.rpc('approve_booking_tl',{p_operation:operation,p_booking:id,p_revision:revision});
 if(result.error) return {error:safeError(result.error)};
 revalidatePath('/bookings');redirect(`/bookings/${id}`);
}

export async function returnToSO(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  const revision = Number(form.get('revision'));
  const reason = textField(form, 'reason', 500);

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before returning.' };
  }
  if (!reason || reason.length < 3) {
    return { error: 'Enter a clear reason for returning the file to the Sales Officer.' };
  }

  const result = await client.rpc('return_booking_tl', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
    p_reason: reason,
  });

  if (result.error) return { error: safeError(result.error) };
  revalidatePath('/bookings');
  redirect(`/bookings/${id}?toast=dispatched`);
}

export async function allocateVehicleSM(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  const revision = Number(form.get('revision'));
  const allocation = textField(form, 'allocation_ref', 100);

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before allocating vehicle.' };
  }
  if (!allocation) {
    return { error: 'Enter the vehicle allocation reference (Chassis or VIN number).' };
  }

  const result = await client.rpc('allocate_vehicle_sm', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
    p_allocation_ref: allocation,
  });

  if (result.error) return { error: safeError(result.error) };
  revalidatePath('/bookings');
  redirect(`/bookings/${id}?toast=dispatched`);
}

export async function recordIntimation(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  const revision = Number(form.get('revision'));
  const notes = textField(form, 'notes', 1000);

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before saving intimation details.' };
  }
  if (!notes) {
    return { error: 'Enter details of customer intimation (call discussion, payment arrangement).' };
  }

  const result = await client.rpc('record_customer_intimation', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
    p_notes: notes,
  });

  if (result.error) return { error: safeError(result.error) };
  revalidatePath('/bookings');
  redirect(`/bookings/${id}?toast=dispatched`);
}

export async function handoverToBO(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  const revision = Number(form.get('revision'));

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before handing over to Back Office.' };
  }

  const result = await client.rpc('handover_to_bo_sm', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
  });

  if (result.error) return { error: safeError(result.error) };
  revalidatePath('/bookings');
  redirect(`/bookings/${id}?toast=dispatched`);
}

export async function approveSM(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireStaff();const id=String(form.get('booking'));const operation=String(form.get('operation'));const revision=Number(form.get('revision'));
 const allocation=textField(form,'allocation_ref',100);
 if(!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) return {error:'Refresh the file before approving.'};
 if(!allocation) return {error:'Enter the vehicle allocation reference (Chassis or VIN number).'};
 const result=await client.rpc('approve_booking_sm',{p_operation:operation,p_booking:id,p_revision:revision,p_allocation_ref:allocation});
 if(result.error) return {error:safeError(result.error)};
 revalidatePath('/bookings');redirect(`/bookings/${id}`);
}

export async function recordBOPdi(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireStaff();const id=String(form.get('booking'));const operation=String(form.get('operation'));const revision=Number(form.get('revision'));
 const status=textField(form,'pdi_status',20);
 const inspector=textField(form,'inspector',100);
 const notes=textField(form,'notes',1000);
 if(!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) return {error:'Refresh the file before saving PDI details.'};
 if(!status || !['passed','rework','failed'].includes(status)) return {error:'Choose a valid PDI status (Passed, Rework, or Failed).'};
 const result=await client.rpc('record_bo_pdi',{p_operation:operation,p_booking:id,p_revision:revision,p_status:status,p_inspector:inspector,p_notes:notes});
 if(result.error) return {error:safeError(result.error)};
 revalidatePath('/bookings');redirect(`/bookings/${id}`);
}

export async function recordBOVahanAndStatutory(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  let revision = Number(form.get('revision'));
  const vahan = textField(form, 'vahan_app_no', 64);
  const form20 = form.get('form20_signed') === 'true' || form.get('form20_signed') === 'on';
  const disclaimer = form.get('disclaimer_signed') === 'true' || form.get('disclaimer_signed') === 'on';

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before saving VAHAN details.' };
  }

  // Handle optional VAHAN acknowledgement slip upload
  const vahanAckFile = form.get('vahan_ack_file');
  if (vahanAckFile instanceof File && vahanAckFile.size > 0) {
    if (!['application/pdf', 'image/jpeg'].includes(vahanAckFile.type)) {
      return { error: 'VAHAN acknowledgement slip must be a PDF or JPEG document.' };
    }
    const secret = process.env.DOCUMENT_VERIFICATION_SECRET;
    if (!secret) return { error: 'Document verification service unconfigured.' };

    try {
      const bytes = new Uint8Array(await vahanAckFile.arrayBuffer());
      const hash = inspectDocument(bytes, vahanAckFile.type);
      const filename = vahanAckFile.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 200) || 'vahan_ack';

      const reserveOp = randomUUID();
      const reserved = await client.rpc('reserve_booking_document', {
        p_operation: reserveOp,
        p_booking: id,
        p_revision: revision,
        p_kind: 'vahan_ack',
        p_filename: filename,
        p_mime: vahanAckFile.type,
        p_size: bytes.length,
        p_sha256: hash,
      });

      if (reserved.error || !reserved.data) {
        return { error: safeError(reserved.error) };
      }

      const docId = reserved.data;
      const uploaded = await client.storage.from('booking-documents').upload(docId, bytes, {
        contentType: vahanAckFile.type,
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
      revision++;
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Upload failed. Choose a valid PDF or JPEG.' };
    }
  }

  const result = await client.rpc('record_bo_vahan_and_statutory', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
    p_vahan_app_no: vahan,
    p_form20_signed: form20,
    p_disclaimer_signed: disclaimer,
  });

  if (result.error) return { error: safeError(result.error) };
  revalidatePath('/bookings');
  revalidatePath('/back-office');
  redirect(`/bookings/${id}?toast=dispatched`);
}

export async function dispatchBODepartment(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  const operation = String(form.get('operation'));
  const revision = Number(form.get('revision'));
  const dept = textField(form, 'target_dept', 20);

  if (!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before dispatching.' };
  }
  if (!dept || !['insurance', 'accounts', 'accessories'].includes(dept)) {
    return { error: 'Choose a valid department to dispatch.' };
  }

  const result = await client.rpc('dispatch_bo_department', {
    p_operation: operation,
    p_booking: id,
    p_revision: revision,
    p_target_dept: dept,
  });

  if (result.error) return { error: safeError(result.error) };
  revalidatePath('/bookings');
  revalidatePath('/back-office');
  redirect(`/bookings/${id}?toast=dispatched`);
}

export async function fillDemoBOPrep(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaff();
  const id = String(form.get('booking'));
  let revision = Number(form.get('revision'));
  if (!uuid.test(id) || !Number.isSafeInteger(revision)) {
    return { error: 'Refresh the file before running demo pre-fill.' };
  }

  // 1. Record PDI passed
  const pdiRes = await client.rpc('record_bo_pdi', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_status: 'passed',
    p_inspector: 'Saju K. (Kalamassery Stockyard)',
    p_notes: 'PDI Passed. Battery 12.8V, toolkit verified, odometer 12 km, paint & body pristine.',
  });
  if (pdiRes.error) return { error: safeError(pdiRes.error) };
  revision++;

  // 2. Record VAHAN application and signatures
  const vahanRes = await client.rpc('record_bo_vahan_and_statutory', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_vahan_app_no: `KL-07-2026-AP-${Math.floor(10000 + Math.random() * 90000)}`,
    p_form20_signed: true,
    p_disclaimer_signed: true,
  });
  if (vahanRes.error) return { error: safeError(vahanRes.error) };
  revision++;

  // 3. Dispatch to Insurance
  await client.rpc('dispatch_bo_department', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_target_dept: 'insurance',
  });
  revision++;

  // 4. Dispatch to Accounts
  await client.rpc('dispatch_bo_department', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_target_dept: 'accounts',
  });
  revision++;

  // 5. Dispatch to Accessories
  await client.rpc('dispatch_bo_department', {
    p_operation: randomUUID(),
    p_booking: id,
    p_revision: revision,
    p_target_dept: 'accessories',
  });

  revalidatePath('/bookings');
  revalidatePath('/back-office');
  redirect(`/bookings/${id}?toast=dispatched`);
}
