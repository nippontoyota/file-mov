import { randomUUID } from 'node:crypto';
import { BookingDocuments } from '@/components/bookings/documents';
import { ActionForm } from '@/components/action-form';
import { sendToTL, receiveFile, approveTL, approveSM } from '@/modules/bookings/actions';
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

  const isTL=session.memberships.some(m=>m.role==='TL' && m.branch_id===b.branch_id && m.team_id===b.team_id);
  const isSM=session.memberships.some(m=>m.role==='SM' && m.branch_id===b.branch_id);

  const editable=Boolean(own) && b.state==='draft';
  const canReceive=isTL && b.state==='tl_review' && !submission.data?.received_at;
  const canApproveTL=isTL && b.state==='tl_review' && Boolean(submission.data?.received_at) && !submission.data?.tl_approved_at;
  const canApproveSM=isSM && b.state==='sm_review' && Boolean(submission.data?.tl_approved_at) && !submission.data?.sm_approved_at;

  const missing=Object.entries(requiredBookingFields).filter(([key])=>!data[key as keyof typeof data]?.trim()).map(([,label])=>label);
  const saved=(await searchParams).saved==='1';

  const statusLabel =
    b.state === 'draft' ? 'Draft' :
    b.state === 'tl_review' ? 'With TL' :
    b.state === 'sm_review' ? 'With SM' :
    b.state === 'bo_review' ? 'With Back Office' : b.state;

  const sectionTitle =
    b.state === 'draft' ? 'Send file to Team Leader' :
    b.state === 'tl_review' ? 'Team Leader review' :
    b.state === 'sm_review' ? 'Sales Manager approval & allocation' :
    'Approved by Sales — Back Office handoff';

  return <WorkspaceShell {...session} page="bookings">
    <Link href="/bookings" className={styles.back}>Back to bookings</Link>
    <div className={styles.pageHeader}><div><span className={styles.eyebrow}>Customer file / Booking details</span><h1>{data.customer_name || 'Booking file'}</h1><p><strong>Customer ID: {b.customer_id || 'Not entered'}</strong></p><p>{data.booking_number ? `Booking ${data.booking_number}` : `File ${b.id.slice(0,8)}`} · {b.branches?.name}</p></div><span className={styles.status}>{statusLabel} · v{b.revision}</span></div>
    {saved && <p role="status" className={styles.saved}>Draft saved. No approval or handover has been recorded.</p>}
    {!editable && <p className={styles.note}>Read-only file. Submitted details and document versions are preserved together.</p>}
    <DraftEditor suggestions={await bookingSuggestions(session.client)} key={b.revision} data={data} id={id} revision={b.revision} editable={editable} soName={b.so_name} scopes={[{id:own?.id || '',label:`${b.branches?.name} / ${b.teams?.name}`}]} />
    <BookingDocuments booking={id} revision={b.revision} documents={docs.data} editable={editable} owner={{name:data.registration_name || '',address:data.registration_address || '',pin:data.registration_pin || ''}} />
    <section className={styles.handoff}><h2>{sectionTitle}</h2>
      {editable && <><p>Save your changes first. Send the saved details and attached documents together. The file will become read-only for the SO.</p><p>{missing.length ? `Required booking details still missing: ${missing.join(', ')}.` : 'Required booking details are complete.'} Both current registered-owner documents must be attached.</p><ActionForm action={sendToTL} label="Send to TL"><input type="hidden" name="operation" value={randomUUID()}/><input type="hidden" name="booking" value={id}/><input type="hidden" name="revision" value={b.revision}/></ActionForm></>}
      {submission.data && <><p>File version {submission.data.file_revision} sent by {submission.data.sender_name} to {b.teams?.name || 'the assigned team'} TL on {new Date(submission.data.sent_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}.</p>
        <p>{submission.data.received_at ? `TL receipt recorded by ${submission.data.receiver_name} on ${new Date(submission.data.received_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}.` : 'Awaiting TL receipt.'}</p>
        {canReceive && <ActionForm action={receiveFile} label="Acknowledge file receipt"><input type="hidden" name="booking" value={id}/><input type="hidden" name="revision" value={b.revision}/></ActionForm>}
        {submission.data.tl_approved_at && <p>TL approval recorded by {submission.data.tl_approver_name} on {new Date(submission.data.tl_approved_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}.</p>}
        {canApproveTL && <ActionForm action={approveTL} label="Approve file & forward to SM"><input type="hidden" name="operation" value={randomUUID()}/><input type="hidden" name="booking" value={id}/><input type="hidden" name="revision" value={b.revision}/></ActionForm>}
        {b.state === 'tl_review' && !canApproveTL && Boolean(submission.data.received_at) && <p>Awaiting Team Leader review and approval.</p>}
        {submission.data.sm_approved_at && <p>SM approval & vehicle allocation ({submission.data.allocation_ref}) recorded by {submission.data.sm_approver_name} on {new Date(submission.data.sm_approved_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}.</p>}
        {canApproveSM && <ActionForm action={approveSM} label="Approve booking & forward to Back Office">
          <input type="hidden" name="operation" value={randomUUID()}/><input type="hidden" name="booking" value={id}/><input type="hidden" name="revision" value={b.revision}/>
          <label style={{display:'block',margin:'14px 0 16px',fontWeight:550,fontSize:'14px'}}>Vehicle Allocation (Chassis / VIN number)
            <input name="allocation_ref" required placeholder="e.g. MBJ11ZX202699881" maxLength={100} style={{display:'block',width:'100%',marginTop:'6px'}}/>
          </label>
        </ActionForm>}
        {b.state === 'sm_review' && !canApproveSM && <p>Awaiting Sales Manager vehicle allocation and commercial approval.</p>}
        {b.state === 'bo_review' && <p>File has been approved by Sales and forwarded to Back Office for PDI, Form 20, and VAHAN staging.</p>}
      </>}
      {b.state==='draft' && !editable && <p>The Sales Officer has not sent this file yet.</p>}
      <p>Digital movement does not record a signature or transfer of physical originals.</p>
    </section>
    <section className={styles.history}><h2>Save history</h2><ol>{history.data.map(v=><li key={v.revision}><span>Version {v.revision} · {v.actor_name} · {v.document_ids.length} documents</span><small>{new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(v.recorded_at))}</small></li>)}</ol><p className={styles.note}>Showing the latest 20 saves. Earlier versions are retained.</p></section>
  </WorkspaceShell>;
}
