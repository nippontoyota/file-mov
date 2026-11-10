import Link from 'next/link';
import { requireSales } from '@/modules/bookings/session';
import { bookingData } from '@/modules/bookings/fields';
import { WorkspaceShell } from '@/components/workspace/shell';
import { Icon } from '@/components/workspace/icon';
import styles from '@/components/bookings/booking.module.css';
export default async function Bookings({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const session = await requireSales();
  const params = await searchParams;
  const q = typeof params.q==='string' ? params.q.trim().slice(0,120) : '';
  const page = /^\d{1,5}$/.test(params.page || '') ? Math.max(1,Math.min(Number(params.page),10000)) : 1;
  let query = session.client.from('bookings').select('id,data,revision,updated_at,so_name', { count:'exact' }).order('updated_at',{ascending:false}).range((page-1)*50,page*50-1);
  if(q) query=query.ilike('data->>customer_name',`%${q.replace(/[%_\\]/g,'\\$&')}%`);
  const result = await query;
  if(result.error) throw new Error('Booking list unavailable');
  const canCreate=session.memberships.some(m=>m.role==='SO');
  const title=session.memberships.some(m=>m.role==='SM') ? 'Branch bookings' : session.memberships.some(m=>m.role==='TL') ? 'Team bookings' : 'My bookings';
  return <WorkspaceShell {...session} page="bookings">
    <div className={styles.pageHeader}><div><span className={styles.eyebrow}>Sales / Customer files</span><h1>{title}</h1><p>Saved booking details for your assigned scope.</p></div>{canCreate && <Link className={styles.action} href="/bookings/new"><Icon name="folder" />New booking</Link>}</div>
    <form action="/bookings" className={styles.search}><label>Search customer name<input name="q" defaultValue={q} maxLength={120} placeholder="Customer name" type="search" /></label><button>Search</button></form>
    <div className={styles.list}>
      <div className={styles.columns} aria-hidden="true"><span>Booking</span><span>Customer</span><span>Vehicle</span><span>Last saved</span></div>
      {!result.data.length && <div className={styles.empty}><Icon name="folder" /><h2>{q ? 'No matching bookings' : 'No booking files yet'}</h2><p>{q ? 'Try a different customer name.' : canCreate ? 'Create a file for a confirmed booking to get started.' : 'Booking drafts from your Sales Officers will appear here.'}</p></div>}
      {result.data.map(b=>{const data=bookingData(b.data);return <Link key={b.id} href={`/bookings/${b.id}`} className={styles.row} aria-label={`Open booking ${data.booking_number || b.id.slice(0,8)} for ${data.customer_name || 'unnamed customer'}`}>
        <span><strong>{data.booking_number || 'Number not entered'}</strong><small>Draft · v{b.revision}</small></span>
        <span><strong>{data.customer_name || 'Customer not entered'}</strong><small>{b.so_name}</small></span>
        <span>{data.model || 'Model not entered'}<small>{[data.suffix_1,data.colour_1].filter(Boolean).join(' / ')}</small></span>
        <span>{new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeZone:'Asia/Kolkata'}).format(new Date(b.updated_at))}</span>
      </Link>;})}
    </div>
    <div className={styles.pagination}><span>{result.count || 0} files{q ? ' matching your search' : ''}</span>{page>1 && <Link href={`/bookings?${new URLSearchParams({q,page:String(page-1)})}`}>Previous</Link>}{page*50<(result.count || 0) && <Link href={`/bookings?${new URLSearchParams({q,page:String(page+1)})}`}>Next</Link>}</div>
  </WorkspaceShell>;
}
