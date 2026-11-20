import { randomUUID } from 'node:crypto';
import { BookingDocuments } from '@/components/bookings/documents';
import { ActionForm } from '@/components/action-form';
import { sendToTL, receiveFile, approveTL, approveSM, recordBOPdi, recordBOVahanAndStatutory, dispatchBODepartment } from '@/modules/bookings/actions';
import { recordPayment } from '@/modules/cashier/actions';
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
  const prepResult=await session.client.from('bo_preparations').select('*').eq('booking_id',id).maybeSingle();
  const prep=prepResult.data;
  const payResult=await session.client.from('booking_payments').select('*').eq('booking_id',id).maybeSingle();
  const payment=payResult.data;
  if(docs.error || submission.error) throw new Error('File documents unavailable');

  const isTL=session.memberships.some(m=>m.role==='TL' && m.branch_id===b.branch_id && m.team_id===b.team_id);
  const isSM=session.memberships.some(m=>m.role==='SM' && m.branch_id===b.branch_id);
  const isBO=session.memberships.some(m=>m.role==='BO' && m.branch_id===b.branch_id);

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
    'Approved by Sales — Back Office coordination';

  return <WorkspaceShell {...session} page="bookings">
    <Link href="/bookings" className={styles.back}>Back to bookings</Link>
    <div className={styles.pageHeader}><div><span className={styles.eyebrow}>Customer file / Booking details</span><h1>{data.customer_name || 'Booking file'}</h1><p><strong>Customer ID: {b.customer_id || 'Not entered'}</strong></p><p>{data.booking_number ? `Booking ${data.booking_number}` : `File ${b.id.slice(0,8)}`} · {b.branches?.name}</p></div><span className={styles.status}>{statusLabel} · v{b.revision}</span></div>
    {saved && <p role="status" className={styles.saved}>Draft saved. No approval or handover has been recorded.</p>}
    {!editable && <p className={styles.note}>Read-only file. Submitted details and document versions are preserved together.</p>}
    <DraftEditor suggestions={await bookingSuggestions(session.client)} key={b.revision} data={data} id={id} revision={b.revision} editable={editable} soName={b.so_name} scopes={[{id:own?.id || '',label:`${b.branches?.name} / ${b.teams?.name}`}]} />
    <BookingDocuments booking={id} revision={b.revision} documents={docs.data} editable={editable} owner={{name:data.registration_name || '',address:data.registration_address || '',pin:data.registration_pin || ''}} />

    <section className={styles.boSection}>
      <h2>Booking Advance Payment & Cashier Verification</h2>
      <p>Showroom booking token payment across Card, UPI, Cheque, or Cash counters.</p>
      {payment ? (
        <div style={{ marginTop: '16px', padding: '18px 20px', background: '#fafbfc', border: '1px solid var(--line)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <strong style={{ fontSize: '18px' }}>₹{Number(payment.amount).toLocaleString('en-IN')}</strong>
              <span style={{ marginLeft: '12px', padding: '3px 8px', background: '#f1f3f5', borderRadius: '4px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                {payment.payment_method}
              </span>
              <div style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
                Reference: <strong>{payment.reference_no}</strong> · Recorded {new Date(payment.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </div>
            </div>
            <div>
              <span className={payment.status === 'verified' ? styles.badgePassed : styles.badgePending}>
                {payment.status === 'verified' ? `✓ Receipt #${payment.receipt_no} Issued by Cashier` : '⏳ Awaiting Cashier Receipt Confirmation'}
              </span>
            </div>
          </div>
          {payment.proof_document_id && (
            <div style={{ marginTop: '10px' }}>
              <a href={`/api/booking-documents/${payment.proof_document_id}`} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#4338ca', fontWeight: 600, textDecoration: 'underline' }}>
                View attached customer payment slip
              </a>
            </div>
          )}
        </div>
      ) : editable ? (
        <div style={{ marginTop: '16px', padding: '18px 20px', background: '#fafbfc', border: '1px solid var(--line)', borderRadius: '8px' }}>
          <h3 style={{ fontSize: '15px', margin: '0 0 10px' }}>Record Initial Booking Advance</h3>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 14px' }}>
            Enter the customer booking token payment. This will route to the Cashier Counter for receipt confirmation.
          </p>
          <ActionForm action={recordPayment} label="Record Booking Advance">
            <input type="hidden" name="operation" value={randomUUID()} />
            <input type="hidden" name="booking" value={id} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px', marginBottom: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 550 }}>Payment Mode
                <select name="method" required style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}>
                  <option value="card">Card (POS Terminal)</option>
                  <option value="upi">UPI (GPay / PhonePe / QR)</option>
                  <option value="cheque">Cheque / Demand Draft</option>
                  <option value="cash">Cash (Counter Deposit)</option>
                </select>
              </label>
              <label style={{ fontSize: '13px', fontWeight: 550 }}>Advance Amount (₹)
                <input name="amount" type="number" required defaultValue="25000" min="1" step="1" style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 550 }}>Reference / UTR / Cheque No
                <input name="reference" required placeholder="e.g. UTR-982189 / CHQ-0021" maxLength={100} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} />
              </label>
              <label style={{ fontSize: '13px', fontWeight: 550 }}>Payment Proof Slip (Optional PDF or JPEG)
                <input name="proof_file" type="file" accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg" style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} />
              </label>
            </div>
          </ActionForm>
        </div>
      ) : (
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No advance payment recorded for this booking file.</p>
      )}
    </section>
    
    <section className={styles.handoff}><h2>{sectionTitle}</h2>
      {editable && (
        <>
          <p>Save your changes first. Send the saved details and attached documents together. The file will become read-only for the SO.</p>
          <p>{missing.length ? `Required booking details still missing: ${missing.join(', ')}.` : 'Required booking details are complete.'} Both current registered-owner documents must be attached.</p>
          {payment && payment.status !== 'verified' && (
            <div style={{ padding: '12px 14px', background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '6px', marginBottom: '14px', fontSize: '13px', color: '#9a3412', fontWeight: 550 }}>
              Booking advance payment of ₹{Number(payment.amount).toLocaleString('en-IN')} is awaiting Cashier receipt verification before the file can be sent to the Team Leader.
            </div>
          )}
          <ActionForm action={sendToTL} label="Send to TL">
            <input type="hidden" name="operation" value={randomUUID()}/>
            <input type="hidden" name="booking" value={id}/>
            <input type="hidden" name="revision" value={b.revision}/>
          </ActionForm>
        </>
      )}
      {submission.data && <><p>File version {submission.data.file_revision} sent by {submission.data.sender_name} to {b.teams?.name || 'the assigned team'} TL on {new Date(submission.data.sent_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}.</p>
        <p>{submission.data.received_at ? `TL receipt recorded by ${submission.data.receiver_name} on ${new Date(submission.data.received_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}.` : 'Awaiting TL receipt.'}</p>
        {canReceive && <ActionForm action={receiveFile} label="Acknowledge file receipt"><input type="hidden" name="booking" value={id}/><input type="hidden" name="revision" value={b.revision}/></ActionForm>}
        {submission.data.tl_approved_at && <p>TL approval recorded by {submission.data.tl_approver_name} on {new Date(submission.data.tl_approved_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}.</p>}
        {canApproveTL && <ActionForm action={approveTL} label="Approve file & forward to SM"><input type="hidden" name="operation" value={randomUUID()}/><input type="hidden" name="booking" value={id}/><input type="hidden" name="revision" value={b.revision}/></ActionForm>}
        {b.state === 'tl_review' && !canApproveTL && Boolean(submission.data.received_at) && <p>Awaiting Team Leader review and approval.</p>}
        {submission.data.sm_approved_at && <p>SM approval & vehicle allocation (<strong>VIN / Chassis: {submission.data.allocation_ref}</strong>) recorded by {submission.data.sm_approver_name} on {new Date(submission.data.sm_approved_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}.</p>}
        {canApproveSM && <ActionForm action={approveSM} label="Approve booking & forward to Back Office">
          <input type="hidden" name="operation" value={randomUUID()}/><input type="hidden" name="booking" value={id}/><input type="hidden" name="revision" value={b.revision}/>
          <label style={{display:'block',margin:'14px 0 16px',fontWeight:550,fontSize:'14px'}}>Vehicle Allocation (Chassis / VIN number)
            <input name="allocation_ref" required placeholder="e.g. MBJ11ZX202699881" maxLength={100} style={{display:'block',width:'100%',marginTop:'6px'}}/>
          </label>
        </ActionForm>}
        {b.state === 'sm_review' && !canApproveSM && <p>Awaiting Sales Manager vehicle allocation and commercial approval.</p>}
        {b.state === 'bo_review' && <p>File has been approved by Sales. Back Office coordinates vehicle preparation, VAHAN staging, and departmental dispatches below.</p>}
      </>}
      {b.state==='draft' && !editable && <p>The Sales Officer has not sent this file yet.</p>}
      <p>Digital movement does not record a signature or transfer of physical originals.</p>
    </section>

    {b.state === 'bo_review' && <section className={styles.boSection}>
      <h2>Back Office — Vehicle Preparation & Fulfilment Coordination</h2>
      <p>Coordinate Pre-Delivery Inspection (PDI), VAHAN portal staging, physical statutory signatures, and departmental dispatches.</p>

      <div className={styles.boGrid}>
        {/* PDI Verification Card */}
        <div className={styles.boCard}>
          <h3>
            <span>Pre-Delivery Inspection (PDI)</span>
            <span className={prep?.pdi_status === 'passed' ? styles.badgePassed : prep?.pdi_status === 'rework' ? styles.badgeRework : prep?.pdi_status === 'failed' ? styles.badgeRework : styles.badgePending}>
              {prep?.pdi_status === 'passed' ? '✓ Passed' : prep?.pdi_status === 'rework' ? '⚠ Rework' : prep?.pdi_status === 'failed' ? '✗ Failed' : '⏳ Pending'}
            </span>
          </h3>
          <p><strong>Stockyard Inspector:</strong> {prep?.pdi_inspector_name || 'Not inspected yet'}</p>
          <p><strong>Notes:</strong> {prep?.pdi_notes || 'No inspection notes recorded.'}</p>
          {prep?.pdi_completed_at && <p><small>Recorded on {new Date(prep.pdi_completed_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</small></p>}
          {isBO && <div style={{marginTop:'16px'}}>
            <ActionForm action={recordBOPdi} label="Save PDI Status">
              <input type="hidden" name="operation" value={randomUUID()}/>
              <input type="hidden" name="booking" value={id}/>
              <input type="hidden" name="revision" value={b.revision}/>
              <label style={{display:'block',margin:'8px 0',fontSize:'13px',fontWeight:550}}>Inspection Status
                <select name="pdi_status" defaultValue={prep?.pdi_status === 'pending' ? 'passed' : prep?.pdi_status || 'passed'} style={{display:'block',width:'100%',marginTop:'4px',padding:'6px 8px',borderRadius:'6px',border:'1px solid var(--line)'}}>
                  <option value="passed">Passed (Fit for delivery)</option>
                  <option value="rework">Rework Required</option>
                  <option value="failed">Failed Inspection</option>
                </select>
              </label>
              <label style={{display:'block',margin:'8px 0',fontSize:'13px',fontWeight:550}}>Inspector Name & Yard
                <input name="inspector" defaultValue={prep?.pdi_inspector_name || ''} placeholder="e.g. Saju K. (Kalamassery Yard)" required style={{display:'block',width:'100%',marginTop:'4px',padding:'6px 8px',borderRadius:'6px',border:'1px solid var(--line)'}}/>
              </label>
              <label style={{display:'block',margin:'8px 0',fontSize:'13px',fontWeight:550}}>Inspection Notes
                <input name="notes" defaultValue={prep?.pdi_notes || ''} placeholder="e.g. Battery checked, toolkit verified" style={{display:'block',width:'100%',marginTop:'4px',padding:'6px 8px',borderRadius:'6px',border:'1px solid var(--line)'}}/>
              </label>
            </ActionForm>
          </div>}
        </div>

        {/* VAHAN & Statutory Signatures Card */}
        <div className={styles.boCard}>
          <h3>
            <span>VAHAN Staging & Statutory Signatures</span>
            <span className={prep?.vahan_app_no && prep?.form20_signed ? styles.badgePassed : styles.badgePending}>
              {prep?.vahan_app_no && prep?.form20_signed ? '✓ Staged' : '⏳ Action Required'}
            </span>
          </h3>
          <p><strong>VAHAN App No:</strong> {prep?.vahan_app_no || 'Not entered yet'}</p>
          <p><strong>Form 20 (RTO Form):</strong> {prep?.form20_signed ? '✓ Physically ink-signed on paper original' : '⏳ Pending ink signature'}</p>
          <p><strong>Customer Disclaimer:</strong> {prep?.disclaimer_signed ? '✓ Physically ink-signed on paper original' : '⏳ Pending ink signature'}</p>
          {isBO && <div style={{marginTop:'16px'}}>
            <ActionForm action={recordBOVahanAndStatutory} label="Save VAHAN & Signatures">
              <input type="hidden" name="operation" value={randomUUID()}/>
              <input type="hidden" name="booking" value={id}/>
              <input type="hidden" name="revision" value={b.revision}/>
              <label style={{display:'block',margin:'8px 0',fontSize:'13px',fontWeight:550}}>VAHAN Application Reference
                <input name="vahan_app_no" defaultValue={prep?.vahan_app_no || ''} placeholder="e.g. KL-07-2026-AP-00918" style={{display:'block',width:'100%',marginTop:'4px',padding:'6px 8px',borderRadius:'6px',border:'1px solid var(--line)'}}/>
              </label>
              <div style={{margin:'12px 0'}}>
                <label style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px',fontSize:'13px'}}>
                  <input type="checkbox" name="form20_signed" defaultChecked={prep?.form20_signed} />
                  Form 20 signed by registered owner (paper original)
                </label>
                <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px'}}>
                  <input type="checkbox" name="disclaimer_signed" defaultChecked={prep?.disclaimer_signed} />
                  Customer disclaimer signed (paper original)
                </label>
              </div>
            </ActionForm>
          </div>}
        </div>
      </div>

      {/* Departmental Dispatches */}
      <div style={{marginTop:'28px'}}>
        <h3 style={{fontSize:'17px',marginBottom:'6px'}}>Departmental Dispatches</h3>
        <p style={{fontSize:'14px',color:'var(--muted)',margin:'0 0 16px'}}>Dispatch the approved vehicle dossier to Insurance, Accounts, and Accessories for parallel preparation.</p>
        <div className={styles.dispatchGrid}>
          {/* Insurance Dispatch */}
          <div className={styles.dispatchCard}>
            <div>
              <h4>1. Insurance Desk</h4>
              <p>For policy quotation, underwriter selection, cover note generation, and broker entry.</p>
              <span className={prep?.insurance_dispatched_at ? styles.badgePassed : styles.badgePending}>
                {prep?.insurance_dispatched_at ? '✓ Dispatched' : 'Awaiting Dispatch'}
              </span>
              {prep?.insurance_dispatched_at && <p style={{marginTop:'8px'}}><small>Sent {new Date(prep.insurance_dispatched_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</small></p>}
            </div>
            {isBO && !prep?.insurance_dispatched_at && <div style={{marginTop:'12px'}}>
              <ActionForm action={dispatchBODepartment} label="Dispatch to Insurance">
                <input type="hidden" name="operation" value={randomUUID()}/>
                <input type="hidden" name="booking" value={id}/>
                <input type="hidden" name="revision" value={b.revision}/>
                <input type="hidden" name="target_dept" value="insurance"/>
              </ActionForm>
            </div>}
          </div>

          {/* Accounts Dispatch */}
          <div className={styles.dispatchCard}>
            <div>
              <h4>2. Accounts (Tax Invoice & FASTag)</h4>
              <p>For commercial tax invoicing, margin money reconciliation, and RFID FASTag processing.</p>
              <span className={prep?.accounts_dispatched_at ? styles.badgePassed : styles.badgePending}>
                {prep?.accounts_dispatched_at ? '✓ Dispatched' : 'Awaiting Dispatch'}
              </span>
              {prep?.accounts_dispatched_at && <p style={{marginTop:'8px'}}><small>Sent {new Date(prep.accounts_dispatched_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</small></p>}
            </div>
            {isBO && !prep?.accounts_dispatched_at && <div style={{marginTop:'12px'}}>
              <ActionForm action={dispatchBODepartment} label="Dispatch to Accounts">
                <input type="hidden" name="operation" value={randomUUID()}/>
                <input type="hidden" name="booking" value={id}/>
                <input type="hidden" name="revision" value={b.revision}/>
                <input type="hidden" name="target_dept" value="accounts"/>
              </ActionForm>
            </div>}
          </div>

          {/* Accessories Dispatch */}
          <div className={styles.dispatchCard}>
            <div>
              <h4>3. Accessories Department</h4>
              <p>For inventory stock checks, accessory fitment requisition, and partial work tracking.</p>
              <span className={prep?.accessories_dispatched_at ? styles.badgePassed : styles.badgePending}>
                {prep?.accessories_dispatched_at ? '✓ Dispatched' : 'Awaiting Dispatch'}
              </span>
              {prep?.accessories_dispatched_at && <p style={{marginTop:'8px'}}><small>Sent {new Date(prep.accessories_dispatched_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</small></p>}
            </div>
            {isBO && !prep?.accessories_dispatched_at && <div style={{marginTop:'12px'}}>
              <ActionForm action={dispatchBODepartment} label="Dispatch to Accessories">
                <input type="hidden" name="operation" value={randomUUID()}/>
                <input type="hidden" name="booking" value={id}/>
                <input type="hidden" name="revision" value={b.revision}/>
                <input type="hidden" name="target_dept" value="accessories"/>
              </ActionForm>
            </div>}
          </div>
        </div>
      </div>
    </section>}

    <section className={styles.history}><h2>Save history</h2><ol>{history.data.map(v=><li key={v.revision}><span>Version {v.revision} · {v.actor_name} · {v.document_ids.length} documents</span><small>{new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(v.recorded_at))}</small></li>)}</ol><p className={styles.note}>Showing the latest 20 saves. Earlier versions are retained.</p></section>
  </WorkspaceShell>;
}
