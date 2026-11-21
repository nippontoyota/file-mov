import { randomUUID } from 'node:crypto';
import { BookingDocuments } from '@/components/bookings/documents';
import { ActionForm } from '@/components/action-form';
import { sendToTL, receiveFile, approveTL, returnToSO, allocateVehicleSM, recordIntimation, handoverToBO, recordBOPdi, recordBOVahanAndStatutory, dispatchBODepartment } from '@/modules/bookings/actions';
import { recordPayment } from '@/modules/cashier/actions';
import { requiredBookingFields } from '@/modules/bookings/documents';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSales, bookingSuggestions } from '@/modules/bookings/session';
import { bookingData } from '@/modules/bookings/fields';
import { uuid } from '@/lib/errors';
import { WorkspaceShell } from '@/components/workspace/shell';
import { DraftEditor } from '@/components/bookings/draft-editor';
import { DocumentPreviewModal } from '@/components/document-preview-modal';
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
  const payResult = await session.client
    .from('booking_payments')
    .select('*')
    .eq('booking_id', id)
    .order('created_at', { ascending: true });
  const payments = payResult.data || [];
  const advancePayment = payments.find(p => p.payment_type === 'booking_advance') || payments[0] || null;
  const balancePayment = payments.find(p => p.payment_type === 'balance_payment') || null;
  const payment = advancePayment;
  const returnAuditResult = await session.client
    .from('audit_events')
    .select('reason,occurred_at')
    .eq('target_id', id)
    .eq('action', 'booking.returned_by_tl')
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestReturn = returnAuditResult.data;
  if(docs.error || submission.error) throw new Error('File documents unavailable');

  const isTL=session.memberships.some(m=>m.role==='TL' && m.branch_id===b.branch_id && m.team_id===b.team_id);
  const isSM=session.memberships.some(m=>m.role==='SM' && m.branch_id===b.branch_id);
  const isBO=session.memberships.some(m=>m.role==='BO' && m.branch_id===b.branch_id);

  const editable=Boolean(own) && b.state==='draft';
  const canReceive=isTL && b.state==='tl_review' && !submission.data?.received_at;
  const canApproveTL=isTL && b.state==='tl_review' && Boolean(submission.data?.received_at) && !submission.data?.tl_approved_at;
  const canAllocateSM=isSM && b.state==='sm_review' && Boolean(submission.data?.tl_approved_at);

  const missing=Object.entries(requiredBookingFields).filter(([key])=>!data[key as keyof typeof data]?.trim()).map(([,label])=>label);
  const saved=(await searchParams).saved==='1';

  const statusLabel =
    b.state === 'draft' ? 'Draft' :
    b.state === 'tl_review' ? 'With TL' :
    b.state === 'sm_review' ? 'With SM (Allocation)' :
    b.state === 'allocated' ? 'Vehicle Allocated (Awaiting Full Payment)' :
    b.state === 'bo_review' ? 'With Back Office' : b.state;

  const sectionTitle =
    b.state === 'draft' ? 'Send file to Team Leader' :
    b.state === 'tl_review' ? 'Team Leader review' :
    b.state === 'sm_review' ? 'Sales Manager vehicle allocation' :
    b.state === 'allocated' ? 'Vehicle Allocation & Customer Balance Payment' :
    'Approved by Sales — Back Office coordination';

  return <WorkspaceShell {...session} page="bookings">
    <Link href="/bookings" className={styles.back}>Back to bookings</Link>
    <div className={styles.pageHeader}><div><span className={styles.eyebrow}>Customer file / Booking details</span><h1>{data.customer_name || 'Booking file'}</h1><p><strong>Customer ID: {b.customer_id || 'Not entered'}</strong></p><p>{data.booking_number ? `Booking ${data.booking_number}` : `File ${b.id.slice(0,8)}`} · {b.branches?.name}</p></div><span className={styles.status}>{statusLabel} · v{b.revision}</span></div>
    {saved && <p role="status" className={styles.saved}>Draft saved. No approval or handover has been recorded.</p>}
    {b.state === 'draft' && latestReturn && (
      <div style={{ padding: '14px 18px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', marginBottom: '20px', color: '#991b1b' }}>
        <strong style={{ fontSize: '14px', display: 'block', marginBottom: '2px' }}>File returned by Team Leader for correction:</strong>
        <p style={{ margin: '0', fontSize: '13px' }}>&ldquo;{latestReturn.reason}&rdquo;</p>
        <small style={{ color: 'var(--muted)', display: 'block', marginTop: '4px' }}>
          Returned on {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(latestReturn.occurred_at))}. Please update details or documents and re-submit.
        </small>
      </div>
    )}
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
              <DocumentPreviewModal
                documentId={payment.proof_document_id}
                label="Preview customer payment slip"
                title="Customer Booking Advance Payment Slip"
                subtitle={`Booking ${data.booking_number || ''} · ${payment.payment_method?.toUpperCase()} payment of ₹${Number(payment.amount).toLocaleString('en-IN')}`}
              />
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
          {(() => {
            const paymentPending = payment && payment.status !== 'verified';
            const missingDocs = !docs.data?.some(d => d.kind === 'aadhaar' && d.status === 'ready') || !docs.data?.some(d => d.kind === 'pan' && d.status === 'ready');
            const sendDisabled = Boolean(paymentPending) || missing.length > 0 || missingDocs;
            const sendDisabledReason = paymentPending
              ? `Cannot send to Team Leader: Advance payment of ₹${Number(payment.amount).toLocaleString('en-IN')} is awaiting Cashier verification and official receipt confirmation.`
              : missing.length > 0
              ? `Cannot send to Team Leader: Complete required booking details (${missing.join(', ')}).`
              : missingDocs
              ? 'Cannot send to Team Leader: Both registered-owner Aadhaar and PAN documents must be attached.'
              : undefined;

            return (
              <ActionForm
                action={sendToTL}
                label="Send to TL"
                disabled={sendDisabled}
                disabledReason={sendDisabledReason}
              >
                <input type="hidden" name="operation" value={randomUUID()}/>
                <input type="hidden" name="booking" value={id}/>
                <input type="hidden" name="revision" value={b.revision}/>
              </ActionForm>
            );
          })()}
        </>
      )}
      {submission.data && <><p>File version {submission.data.file_revision} sent by {submission.data.sender_name} to {b.teams?.name || 'the assigned team'} TL on {new Date(submission.data.sent_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}.</p>
        <p>{submission.data.received_at ? `TL receipt recorded by ${submission.data.receiver_name} on ${new Date(submission.data.received_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}.` : 'Awaiting TL receipt.'}</p>
        {canReceive && <ActionForm action={receiveFile} label="Acknowledge file receipt"><input type="hidden" name="booking" value={id}/><input type="hidden" name="revision" value={b.revision}/></ActionForm>}
        {submission.data.tl_approved_at && <p>TL approval recorded by {submission.data.tl_approver_name} on {new Date(submission.data.tl_approved_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}.</p>}
        {canApproveTL && (
          <div style={{ marginTop: '20px', padding: '20px', background: '#fafbfc', border: '1px solid var(--line)', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '17px', margin: '0 0 6px', fontWeight: 650 }}>Team Leader Verification & Decision</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 16px' }}>
              Review the order parameters, verified advance payment receipt, and KYC documents before forwarding to the Sales Manager.
            </p>

            {/* Verification Summary Checklist */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <div style={{ padding: '12px 14px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Vehicle & Variant
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>{data.model || 'Toyota Vehicle'}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  Suffix: <strong>{data.suffix_1 || 'Standard'}</strong> · Colour: <strong>{data.colour_1 || 'Not specified'}</strong>
                </div>
              </div>

              <div style={{ padding: '12px 14px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Advance Payment Clearance
                </div>
                {payment ? (
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: payment.status === 'verified' ? '#166534' : '#9a3412' }}>
                      {payment.status === 'verified' ? `✓ Receipt #${payment.receipt_no}` : 'Pending Cashier Verification'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                      ₹{Number(payment.amount).toLocaleString('en-IN')} via {payment.payment_method?.toUpperCase()} ({payment.reference_no})
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No advance payment recorded</div>
                )}
              </div>

              <div style={{ padding: '12px 14px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Registered Owner & Customer
                </div>
                <div style={{ fontSize: '14px', fontWeight: 650, color: 'var(--ink)' }}>{data.registration_name || data.customer_name || 'Customer'}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  Customer Code: {b.customer_id || 'Not entered'} · PIN: {data.registration_pin || data.pin || ''}
                </div>
              </div>

              <div style={{ padding: '12px 14px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  KYC & Statutory Files
                </div>
                <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {docs.data?.filter(d => ['aadhaar', 'pan'].includes(d.kind) && d.status === 'ready').map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600 }}>{d.kind === 'aadhaar' ? 'Aadhaar' : 'PAN'} (v{d.version})</span>
                      <DocumentPreviewModal
                        documentId={d.id}
                        label="Preview"
                        title={`${d.kind === 'aadhaar' ? 'Aadhaar Card' : 'PAN Card'} Preview`}
                        subtitle={`Registered to: ${data.registration_name || 'Customer'}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Decision Controls: Approve vs Return */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <ActionForm action={approveTL} label="Approve File & Forward to Sales Manager">
                <input type="hidden" name="operation" value={randomUUID()} />
                <input type="hidden" name="booking" value={id} />
                <input type="hidden" name="revision" value={b.revision} />
              </ActionForm>

              <details style={{ flex: 1, minWidth: '280px', border: 'none', padding: 0 }}>
                <summary style={{ fontSize: '13px', fontWeight: 600, color: '#9a3412', cursor: 'pointer', padding: '10px 0' }}>
                  Need corrections? Return file to Sales Officer ▾
                </summary>
                <div style={{ marginTop: '8px', padding: '14px', background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '6px' }}>
                  <ActionForm action={returnToSO} label="Return File to SO" secondary>
                    <input type="hidden" name="operation" value={randomUUID()} />
                    <input type="hidden" name="booking" value={id} />
                    <input type="hidden" name="revision" value={b.revision} />
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#9a3412', display: 'block', marginBottom: '4px' }}>
                      Reason for return (required for SO)
                      <textarea
                        name="reason"
                        required
                        rows={3}
                        placeholder="Specify what needs correction (e.g. Blurry PAN card scan, Suffix colour mismatch with stock, etc.)"
                        style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #fed7aa', background: 'white' }}
                      />
                    </label>
                  </ActionForm>
                </div>
              </details>
            </div>
          </div>
        )}
        {b.state === 'tl_review' && !canApproveTL && Boolean(submission.data.received_at) && <p>Awaiting Team Leader review and approval.</p>}

        {b.state === 'sm_review' && canAllocateSM && (
          <div style={{ marginTop: '20px', padding: '20px', background: '#fafbfc', border: '1px solid var(--line)', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '17px', margin: '0 0 6px', fontWeight: 650 }}>Sales Manager — Vehicle Allocation</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 16px' }}>
              Assign the factory or stockyard Chassis / VIN number to this customer booking. Allocating will move this file to Allocated status, instructing the Sales Officer to contact the customer for full balance remittance.
            </p>
            <ActionForm action={allocateVehicleSM} label="Allocate Vehicle to Booking">
              <input type="hidden" name="operation" value={randomUUID()} />
              <input type="hidden" name="booking" value={id} />
              <input type="hidden" name="revision" value={b.revision} />
              <label style={{ display: 'block', margin: '10px 0 16px', fontWeight: 550, fontSize: '14px' }}>
                Vehicle Chassis / VIN Number (from Toyota Dispatch / Yard)
                <input
                  name="allocation_ref"
                  required
                  placeholder="e.g. MBJ11ZX202699881"
                  maxLength={100}
                  style={{ display: 'block', width: '100%', marginTop: '6px', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--line)' }}
                />
              </label>
            </ActionForm>
          </div>
        )}
        {b.state === 'sm_review' && !canAllocateSM && <p>Awaiting Sales Manager vehicle allocation (Chassis / VIN number).</p>}

        {b.state === 'allocated' && (
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Allocation Details Card */}
            <div style={{ padding: '16px 20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Vehicle Allocated
                  </span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#14532d', marginTop: '2px' }}>
                    Chassis / VIN: {submission.data.allocation_ref}
                  </div>
                  <div style={{ fontSize: '12px', color: '#166534', marginTop: '4px' }}>
                    Allocated by {submission.data.allocator_name || 'Sales Manager'} on {submission.data.allocated_at ? new Date(submission.data.allocated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'recently'}.
                  </div>
                </div>
                <span className={styles.badgePassed}>✓ Stockyard Allocated</span>
              </div>
            </div>

            {/* Step 1: Customer Intimation Card */}
            <div style={{ padding: '18px 20px', background: '#fafbfc', border: '1px solid var(--line)', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '15px', margin: '0 0 6px', fontWeight: 650 }}>1. Customer Allocation Call & Intimation</h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 14px' }}>
                The Sales Officer must call the customer ({data.customer_name || 'Customer'} at {data.contact_person || 'Phone'}) to inform them of vehicle allocation and request full balance payment remittance.
              </p>
              {submission.data.customer_intimated_at ? (
                <div style={{ padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                    ✓ Customer Intimated on {new Date(submission.data.customer_intimated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </div>
                  <div style={{ fontSize: '13px', color: '#334155', marginTop: '4px' }}>
                    &ldquo;{submission.data.customer_intimation_notes}&rdquo;
                  </div>
                </div>
              ) : own ? (
                <ActionForm action={recordIntimation} label="Record Customer Intimation Call">
                  <input type="hidden" name="operation" value={randomUUID()} />
                  <input type="hidden" name="booking" value={id} />
                  <input type="hidden" name="revision" value={b.revision} />
                  <label style={{ fontSize: '13px', fontWeight: 550, display: 'block', marginBottom: '8px' }}>
                    Call Notes & Payment Arrangement
                    <textarea
                      name="notes"
                      required
                      rows={2}
                      placeholder="e.g. Spoke with customer. Informed of VIN allocation. Customer transferring ₹18,50,000 balance via RTGS tomorrow."
                      style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--line)', background: 'white', marginTop: '4px' }}
                    />
                  </label>
                </ActionForm>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Awaiting Sales Officer to call customer and record intimation notes.</p>
              )}
            </div>

            {/* Step 2: Customer Balance / Full Payment Card */}
            <div style={{ padding: '18px 20px', background: '#fafbfc', border: '1px solid var(--line)', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '15px', margin: '0 0 6px', fontWeight: 650 }}>2. Vehicle Balance Payment & Cashier Clearance</h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 14px' }}>
                Full balance payment settlement (or approved bank loan disbursement) across showroom counters. Must be verified by Cashier before Back Office handover.
              </p>
              {balancePayment ? (
                <div style={{ padding: '14px 16px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '17px' }}>₹{Number(balancePayment.amount).toLocaleString('en-IN')}</strong>
                      <span style={{ marginLeft: '10px', padding: '2px 8px', background: '#f1f3f5', borderRadius: '4px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                        {balancePayment.payment_method}
                      </span>
                      <div style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px' }}>
                        Ref / UTR: <strong>{balancePayment.reference_no}</strong> · Recorded {new Date(balancePayment.created_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </div>
                    </div>
                    <div>
                      <span className={balancePayment.status === 'verified' ? styles.badgePassed : styles.badgePending}>
                        {balancePayment.status === 'verified' ? `✓ Receipt #${balancePayment.receipt_no} Issued by Cashier` : '⏳ Awaiting Cashier Receipt Confirmation'}
                      </span>
                    </div>
                  </div>
                  {balancePayment.proof_document_id && (
                    <div style={{ marginTop: '10px' }}>
                      <DocumentPreviewModal
                        documentId={balancePayment.proof_document_id}
                        label="Preview balance payment slip"
                        title="Vehicle Balance Payment Slip"
                        subtitle={`Booking ${data.booking_number || ''} · ${balancePayment.payment_method?.toUpperCase()} payment of ₹${Number(balancePayment.amount).toLocaleString('en-IN')}`}
                      />
                    </div>
                  )}
                </div>
              ) : own ? (
                <ActionForm action={recordPayment} label="Record Balance Payment">
                  <input type="hidden" name="operation" value={randomUUID()} />
                  <input type="hidden" name="booking" value={id} />
                  <input type="hidden" name="payment_type" value="balance_payment" />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px', marginBottom: '12px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 550 }}>Payment Mode
                      <select name="method" required style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}>
                        <option value="upi">Bank Transfer / RTGS / NEFT / UPI</option>
                        <option value="card">Card (POS Terminal)</option>
                        <option value="cheque">Cheque / Demand Draft</option>
                        <option value="cash">Cash (Counter Deposit)</option>
                      </select>
                    </label>
                    <label style={{ fontSize: '13px', fontWeight: 550 }}>Balance Amount (₹)
                      <input name="amount" type="number" required placeholder="e.g. 1850000" min="1" step="1" style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} />
                    </label>
                    <label style={{ fontSize: '13px', fontWeight: 550 }}>Reference / UTR / Cheque No
                      <input name="reference" required placeholder="e.g. UTR-98218928 / CHQ-0099" maxLength={100} style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} />
                    </label>
                    <label style={{ fontSize: '13px', fontWeight: 550 }}>Payment Proof Slip (PDF or JPEG)
                      <input name="proof_file" type="file" accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg" style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} />
                    </label>
                  </div>
                </ActionForm>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Awaiting customer balance payment remittance.</p>
              )}
            </div>

            {/* Step 3: Sales Manager Handover to Back Office */}
            {isSM && (
              <div style={{ padding: '18px 20px', background: '#fafbfc', border: '1px solid var(--line)', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '15px', margin: '0 0 6px', fontWeight: 650 }}>3. Sales Manager — Hand Over to Back Office</h3>
                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 14px' }}>
                  Once the customer balance payment is verified by the Cashier, hand over the file to the Back Office for PDI, VAHAN registration, and departmental dispatches.
                </p>
                {(() => {
                  const balanceVerified = balancePayment?.status === 'verified';
                  const handoverReason = !balancePayment
                    ? 'Cannot hand over to Back Office: Customer balance payment has not been recorded.'
                    : !balanceVerified
                    ? `Cannot hand over to Back Office: Customer balance payment of ₹${Number(balancePayment.amount).toLocaleString('en-IN')} is awaiting Cashier receipt verification.`
                    : undefined;

                  return (
                    <ActionForm
                      action={handoverToBO}
                      label="Approve & Hand Over to Back Office"
                      disabled={!balanceVerified}
                      disabledReason={handoverReason}
                    >
                      <input type="hidden" name="operation" value={randomUUID()} />
                      <input type="hidden" name="booking" value={id} />
                      <input type="hidden" name="revision" value={b.revision} />
                    </ActionForm>
                  );
                })()}
              </div>
            )}
            {!isSM && (
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                {balancePayment?.status === 'verified'
                  ? 'Balance payment verified. Awaiting Sales Manager to hand over file to Back Office.'
                  : 'Awaiting balance payment clearance before Back Office handover.'}
              </p>
            )}
          </div>
        )}

        {submission.data.sm_approved_at && (
          <p>
            SM approval & vehicle allocation (<strong>VIN / Chassis: {submission.data.allocation_ref}</strong>) recorded by {submission.data.sm_approver_name} on {new Date(submission.data.sm_approved_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.
          </p>
        )}
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
