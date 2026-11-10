import 'server-only';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/modules/identity/session';
export async function requireSales() {
  const session = await requireStaff();
  if (!session.memberships.some(m => ['SO','TL','SM'].includes(m.role))) redirect('/workspace');
  return session;
}
