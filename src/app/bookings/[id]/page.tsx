import { randomUUID } from 'node:crypto';
import { BookingDocuments } from '@/components/bookings/documents';
import { ActionForm } from '@/components/action-form';
import { sendToTL, receiveFile } from '@/modules/bookings/actions';
import { requiredBookingFields } from '@/modules/bookings/documents';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSales, bookingSuggestions } from '@/modules/bookings/session';
import { bookingData } from '@/modules/bookings/fields';
import { uuid } from '@/lib/errors';
import { WorkspaceShell } from '@/components/workspace/shell';
import { DraftEditor } from '@/components/bookings/draft-editor';
import styles from '@/components/bookings/booking.module.css';
export default async function Booking({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{saved?:string}>}) {
  const session=await requireSales();
  const {id}=await params;
  if(!uuid.test(id)) notFound();
  const result=await session.client.from('bookings').select('id,state,customer_id,data,branch_id,team_id,so_id,so_name,revision,branches(name),teams(name)').eq('id',id).maybeSingle();
  if(result.error) throw new Error('Booking file unavailable');
  if(!result.data) notFound();
  const b=result.data;
  const history=await session.client.from('booking_versions').select('revision,actor_name,recorded_at,document_ids').eq('booking_id',id).order('revision',{ascending:false}).limit(20);
  if(history.error) throw new Error('Booking history unavailable');
  const own=session.memberships.find(m=>m.role==='SO' && m.branch_id===b.branch_id && m.team_id===b.team_id && b.so_id===session.user.id);
  const data=bookingData(b.data);
  const docs=await session.client.from('booking_documents').select('*').eq('booking_id',id).order('version',{ascending:false});
  const submission=await session.client.from('sales_submissions').select('*').eq('booking_id',id).maybeSingle();
  if(docs.error || submission.error) throw new Error('File documents unavailable');
  const editable=Boolean(own) && b.state==='draft';
  const canReceive=session.memberships.some(m=>m.role==='TL' && m.branch_id===b.branch_id && m.team_id===b.team_id);
  const missing=Object.entries(requiredBookingFields).filter(([key])=>!data[key as keyof typeof data]?.trim()).map(([,label])=>label);
  const saved=(await searchParams).saved==='1';
  return <WorkspaceShell {...session} page="bookings">
    <Link href="/bookings" className={styles.back}>Back to bookings</Link>
    <div className={styles.pageHeader}><div><span className={styles.eyebrow}>Customer file / Booking details</span><h1>{data.customer_name || 'Booking file'}</h1><p><strong>Customer ID: {b.customer_id || 'Not entered'}</strong></p><p>{data.booking_number ? `Booking ${data.booking_number}` : `File ${b.id.slice(0,8)}`} · {b.branches?.name}</p></div><span className={styles.status}>{b.state==='draft'?'Draft':'With TL'} · v{b.revision}</span></div>
    {saved && <p role="status" className={styles.saved}>Draft saved. No approval or handover has been recorded.</p>}
    {!editable && <p className={styles.note}>Read-only file. Submitted details and document versions are preserved together.</p>}
    <DraftEditor suggestions={await bookingSuggestions(session.client)} key={b.revision} data={data} id={id} revision={b.revision} editable={editable} soName={b.so_name} scopes={[{id:own?.id || '',label:`${b.branches?.name} / ${b.teams?.name}`}]} />
    <BookingDocuments booking={id} revision={b.revision} documents={docs.data} editable={editable} owner={{name:data.registration_name || '',address:data.registration_address || '',pin:data.registration_pin || ''}} />
    <section className={styles.handoff}><h2>{b.state==='draft'?'Send file to Team Leader':'Team Leader review'}</h2>
      {editable && <><p>Save your changes first. Send the saved details and attached documents together. The file will become read-only for the SO.</p><p>{missing.length ? `Required booking details still missing: ${missing.join(', ')}.` : 'Required booking details are complete.'} Both current registered-owner documents must be attached.</p><ActionForm action={sendToTL} label="Send to TL"><input type="hidden" name="operation" value={randomUUID()}/><input type="hidden" name="booking" value={id}/><input type="hidden" name="revision" value={b.revision}/></ActionForm></>}
      {submission.data && <><p>File version {submission.data.file_revision} sent by {submission.data.sender_name} to {b.teams?.name || 'the assigned team'} TL on {new Date(submission.data.sent_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}.</p><p>{submission.data.received_at ? `TL receipt recorded by ${submission.data.receiver_name} on ${new Date(submission.data.received_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}.` : 'Awaiting TL receipt.'}</p>{canReceive && !submission.data.received_at && <ActionForm action={receiveFile} label="Acknowledge file receipt"><input type="hidden" name="booking" value={id}/><input type="hidden" name="revision" value={b.revision}/></ActionForm>}<p>Receipt is not approval. TL approval, then SM approval, must precede TL sending to BO. Those approval steps are not enabled yet.</p></>}
      {b.state==='draft' && !editable && <p>The Sales Officer has not sent this file yet.</p>}
      <p>Digital movement does not record a signature or transfer of physical originals.</p>
    </section>
    <section className={styles.history}><h2>Save history</h2><ol>{history.data.map(v=><li key={v.revision}><span>Version {v.revision} · {v.actor_name} · {v.document_ids.length} documents</span><small>{new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(v.recorded_at))}</small></li>)}</ol><p className={styles.note}>Showing the latest 20 saves. Earlier versions are retained.</p></section>
  </WorkspaceShell>;
}
