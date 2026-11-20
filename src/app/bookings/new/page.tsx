import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireSales, bookingSuggestions } from '@/modules/bookings/session';
import { generateSampleBookingData } from '@/modules/bookings/fields';
import { WorkspaceShell } from '@/components/workspace/shell';
import { DraftEditor } from '@/components/bookings/draft-editor';
import styles from '@/components/bookings/booking.module.css';

export default async function NewBooking({ searchParams }: { searchParams: Promise<{ test?: string }> }) {
  const session = await requireSales();
  const scopes = session.memberships.filter(m => m.role==='SO');
  if (!scopes.length) redirect('/bookings');
  const isTest = (await searchParams).test === '1';
  const initialData = isTest ? generateSampleBookingData() : {};

  return <WorkspaceShell {...session} page="bookings">
    <Link className={styles.back} href="/bookings">Back to bookings</Link>
    <div className={styles.pageHeader}>
      <div><span className={styles.eyebrow}>Customer file / Sales Officer</span><h1>New booking file</h1><p>Enter details for an existing confirmed booking. Save what you have and continue later.</p></div>
      <div className={styles.actionsGroup}>
        <span className={styles.status}>Draft</span>
        {!isTest && <Link className={styles.secondaryAction} href="/bookings/new?test=1">Fill test details</Link>}
      </div>
    </div>
    <DraftEditor key={isTest ? 'test' : 'empty'} data={initialData} suggestions={await bookingSuggestions(session.client)} scopes={scopes.map(m=>({id:m.id,label:`${m.branches?.name} / ${m.teams?.name}`}))} soName={session.profile.display_name} />
    <p className={styles.note}>TL submission will open once the required fields and document checks are confirmed.</p>
  </WorkspaceShell>;
}
