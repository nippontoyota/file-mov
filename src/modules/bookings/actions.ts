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
