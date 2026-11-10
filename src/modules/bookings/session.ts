import 'server-only';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/modules/identity/session';
export async function requireSales() {
  const session = await requireStaff();
  if (!session.memberships.some(m => ['SO','TL','SM'].includes(m.role))) redirect('/workspace');
  return session;
}

// Only previously saved values from bookings visible under this user's RLS.
export async function bookingSuggestions(client: Awaited<ReturnType<typeof requireSales>>['client']) {
  const fields=['tl_name','model','suffix_1','suffix_2','colour_1','colour_2','interior_colour','registration_suffix','registration_colour'];
  const result=await client.from('bookings').select('data').order('updated_at',{ascending:false}).limit(500);
  if(result.error) throw new Error('Booking suggestions unavailable');
  return Object.fromEntries(fields.map(key=>[key,[...new Set(result.data.flatMap(row=>{
    const data=row.data;
    const value=data && typeof data==='object' && !Array.isArray(data) ? data[key] : null;
    return typeof value==='string' && value.trim() ? [value.trim()] : [];
  }))].sort()]));
}
