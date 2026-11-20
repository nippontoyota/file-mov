'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/modules/identity/actions';
import { requireStaff } from '@/modules/identity/session';
import { safeError, uuid, textField } from '@/lib/errors';
import { bookingFields, type BookingData } from './fields';

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

export async function sendToTL(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireStaff();const id=String(form.get('booking'));const operation=String(form.get('operation'));const revision=Number(form.get('revision'));
 if(!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) return {error:'Refresh the booking before sending.'};
 const result=await client.rpc('send_booking_to_tl',{p_operation:operation,p_booking:id,p_revision:revision});
 if(result.error) return {error:result.error.code==='22023'?'Complete the required booking details, attach both registered-owner documents and ensure your team has an active TL.':safeError(result.error)};
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

export async function recordBOVahanAndStatutory(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireStaff();const id=String(form.get('booking'));const operation=String(form.get('operation'));const revision=Number(form.get('revision'));
 const vahan=textField(form,'vahan_app_no',64);
 const form20=form.get('form20_signed')==='true' || form.get('form20_signed')==='on';
 const disclaimer=form.get('disclaimer_signed')==='true' || form.get('disclaimer_signed')==='on';
 if(!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) return {error:'Refresh the file before saving VAHAN details.'};
 const result=await client.rpc('record_bo_vahan_and_statutory',{p_operation:operation,p_booking:id,p_revision:revision,p_vahan_app_no:vahan,p_form20_signed:form20,p_disclaimer_signed:disclaimer});
 if(result.error) return {error:safeError(result.error)};
 revalidatePath('/bookings');redirect(`/bookings/${id}`);
}

export async function dispatchBODepartment(_:ActionState,form:FormData):Promise<ActionState>{
 const {client}=await requireStaff();const id=String(form.get('booking'));const operation=String(form.get('operation'));const revision=Number(form.get('revision'));
 const dept=textField(form,'target_dept',20);
 if(!uuid.test(id) || !uuid.test(operation) || !Number.isSafeInteger(revision)) return {error:'Refresh the file before dispatching.'};
 if(!dept || !['insurance','accounts','accessories'].includes(dept)) return {error:'Choose a valid department to dispatch.'};
 const result=await client.rpc('dispatch_bo_department',{p_operation:operation,p_booking:id,p_revision:revision,p_target_dept:dept});
 if(result.error) return {error:safeError(result.error)};
 revalidatePath('/bookings');redirect(`/bookings/${id}`);
}
