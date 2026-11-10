import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireSales } from '@/modules/bookings/session';
import { WorkspaceShell } from '@/components/workspace/shell';
import { DraftEditor } from '@/components/bookings/draft-editor';
import styles from '@/components/bookings/booking.module.css';
export default async function NewBooking() {
  const session = await requireSales();
  const scopes = session.memberships.filter(m => m.role==='SO');
  if (!scopes.length) redirect('/bookings');
  return <WorkspaceShell {...session} page="bookings">
    <Link className={styles.back} href="/bookings">Back to bookings</Link>
    <div className={styles.pageHeader}><div><span className={styles.eyebrow}>Customer file / Sales Officer</span><h1>New booking file</h1><p>Enter the file header and booking details. Save what you have and continue later.</p></div><span className={styles.status}>Draft</span></div>
    <DraftEditor scopes={scopes.map(m=>({id:m.id,label:`${m.branches?.name} / ${m.teams?.name}`}))} soName={session.profile.display_name} />
    <p className={styles.note}>TL submission will open once the required fields and document checks are confirmed.</p>
  </WorkspaceShell>;
}
