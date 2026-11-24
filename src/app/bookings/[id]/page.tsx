import { randomUUID } from 'node:crypto';
import { BookingDocuments } from '@/components/bookings/documents';
import { ActionForm } from '@/components/action-form';
import { sendToTL, receiveFile, approveTL, returnToSO, allocateVehicleSM, recordIntimation, handoverToBO, recordBOPdi, recordBOVahanAndStatutory, dispatchBODepartment, fillDemoBOPrep } from '@/modules/bookings/actions';
import { recordInsurancePolicy, fillDemoInsurancePolicy } from '@/modules/insurance/actions';
import {
  recordVehicleInvoice,
  recordFastagIssuance,
  acknowledgeFastagHandover,
  recordRoadTaxPayment,
  completeAccountsClearance,
  fillDemoAccounts,
} from '@/modules/accounts/actions';
import {
  recordAccessoriesWork,
  recordAccessoriesBill,
  signAccessoriesMargin,
  submitAccessoriesToBO,
  forwardAccessoriesToAccounts,
  recordRTORegistration,
  fillDemoAccessories,
} from '@/modules/accessories/actions';
import {
  recordFinancialClosure,
  issueGatePass,
  recordVehicleDelivery,
  returnFileToAccounts,
  recordFinalArchive,
  fillDemoDeliveryAndArchive,
} from '@/modules/delivery/actions';
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

interface AccessoryItem {
  name: string;
  part_no?: string;
  qty?: number;
  fitted?: boolean;
  remarks?: string;
}

export default async function Booking({params}:{params:Promise<{id:string}>}) {
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
  const insuranceResult = await session.client
    .from('insurance_policies')
    .select('*')
    .eq('booking_id', id)
    .maybeSingle();
  const insurancePolicy = insuranceResult.data;
  const accountsResult = await session.client
    .from('accounts_records')
    .select('*')
    .eq('booking_id', id)
    .maybeSingle();
  const accountsRecord = accountsResult.data;
  const accessoriesResult = await session.client
    .from('accessories_records')
    .select('*')
    .eq('booking_id', id)
    .maybeSingle();
  const accessoriesRecord = accessoriesResult.data;
  const deliveryResult = await session.client
    .from('delivery_records')
    .select('*')
    .eq('booking_id', id)
    .maybeSingle();
  const deliveryRecord = deliveryResult.data;
  const vahanAckDoc = docs.data?.find(d => d.kind === 'vahan_ack' && d.status === 'ready');
  const form20Doc = docs.data?.find(d => d.kind === 'form20' && d.status === 'ready');
  const disclaimerDoc = docs.data?.find(d => d.kind === 'disclaimer' && d.status === 'ready');
  const policyDoc = docs.data?.find(d => d.kind === 'insurance_policy' && d.status === 'ready');
  const invoiceDoc = docs.data?.find(d => d.kind === 'vehicle_invoice' && d.status === 'ready');
  const roadTaxDoc = docs.data?.find(d => d.kind === 'road_tax_receipt' && d.status === 'ready');
  const accessoriesBillDoc = docs.data?.find(d => d.kind === 'accessories_bill' && d.status === 'ready');
  const rtoRcDoc = docs.data?.find(d => d.kind === 'rto_rc_copy' && d.status === 'ready');
  const gatePassDoc = docs.data?.find(d => d.kind === 'gate_pass' && d.status === 'ready');
  const deliveryDoc = docs.data?.find(d => d.kind === 'delivery_acknowledgment' && d.status === 'ready');
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
  const isInsurance=session.memberships.some(m=>m.role==='Insurance' && m.branch_id===b.branch_id);
  const isAccounts=session.memberships.some(m=>m.role==='Accounts' && m.branch_id===b.branch_id);
  const isCashier=session.memberships.some(m=>m.role==='Cashier' && m.branch_id===b.branch_id);
  const isAccessories=session.memberships.some(m=>m.role==='Accessories' && m.branch_id===b.branch_id);
  const isSecurity=session.memberships.some(m=>m.role==='Security' && m.branch_id===b.branch_id);
  const isAdmin=session.memberships.some(m=>m.role==='Admin');
  const isSO=Boolean(own) || session.memberships.some(m=>m.role==='SO' && m.branch_id===b.branch_id && m.team_id===b.team_id);

  const editable=Boolean(own) && b.state==='draft';
  const canReceive=isTL && b.state==='tl_review' && !submission.data?.received_at;
  const canApproveTL=isTL && b.state==='tl_review' && Boolean(submission.data?.received_at) && !submission.data?.tl_approved_at;
  const canAllocateSM=isSM && b.state==='sm_review' && Boolean(submission.data?.tl_approved_at);

  const missing=Object.entries(requiredBookingFields).filter(([key])=>!data[key as keyof typeof data]?.trim()).map(([,label])=>label);

  const statusLabel =
    b.state === 'draft' ? 'Draft' :
    b.state === 'tl_review' ? 'With TL' :
    b.state === 'sm_review' ? 'With SM (Allocation)' :
    b.state === 'allocated' ? 'Vehicle Allocated (Awaiting Full Payment)' :
    b.state === 'bo_review' ? 'With Back Office' :
    b.state === 'archived' ? 'Completed & Archived' : b.state;

  const sectionTitle =
    b.state === 'draft' ? 'Send file to Team Leader' :
    b.state === 'tl_review' ? 'Team Leader review' :
    b.state === 'sm_review' ? 'Sales Manager vehicle allocation' :
    b.state === 'allocated' ? 'Vehicle Allocation & Customer Balance Payment' :
    'Approved by Sales — Back Office coordination';

  return <WorkspaceShell {...session} page="bookings">
    <Link href="/bookings" className={styles.back}>Back to bookings</Link>
    <div className={styles.pageHeader}><div><span className={styles.eyebrow}>Customer file / Booking details</span><h1>{data.customer_name || 'Booking file'}</h1><p><strong>Customer ID: {b.customer_id || 'Not entered'}</strong></p><p>{data.booking_number ? `Booking ${data.booking_number}` : `File ${b.id.slice(0,8)}`} · {b.branches?.name}</p></div><span className={styles.status}>{statusLabel} · v{b.revision}</span></div>
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
                {payment.status === 'verified' ? `Receipt #${payment.receipt_no} Issued by Cashier` : 'Awaiting Cashier Receipt Confirmation'}
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
                      {payment.status === 'verified' ? `Receipt #${payment.receipt_no}` : 'Pending Cashier Verification'}
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
                <span className={styles.badgePassed}>Stockyard Allocated</span>
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
                    Customer Intimated on {new Date(submission.data.customer_intimated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
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
                        {balancePayment.status === 'verified' ? `Receipt #${balancePayment.receipt_no} Issued by Cashier` : 'Awaiting Cashier Receipt Confirmation'}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
        <div>
          <h2>Back Office — Vehicle Preparation & Fulfilment Coordination</h2>
          <p style={{ margin: 0 }}>Coordinate Pre-Delivery Inspection (PDI), VAHAN portal staging, physical statutory signatures, and departmental dispatches.</p>
        </div>
        {isBO && (
          <ActionForm action={fillDemoBOPrep} label="Demo: Pre-fill BO Prep (Passed PDI & VAHAN)" secondary>
            <input type="hidden" name="booking" value={id} />
            <input type="hidden" name="revision" value={b.revision} />
          </ActionForm>
        )}
      </div>

      {/* 1. Pre-List Physical File Checklist (SRC-B01) */}
      <div style={{ marginTop: '18px', padding: '16px 20px', background: '#f8fafc', border: '1px solid var(--line)', borderRadius: '8px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 650, margin: '0 0 4px' }}>1. Pre-List Dossier Audit (SRC-B01)</h3>
        <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 14px' }}>
          Physical folder contents verified before staging registration and dispatches.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
          <div style={{ padding: '10px 14px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer & OBF File</div>
            <div style={{ fontSize: '14px', fontWeight: 650, marginTop: '2px', color: 'var(--ink)' }}>{data.customer_name || 'Customer'} (ID: {b.customer_id || 'N/A'})</div>
            <div style={{ fontSize: '12px', color: '#166534', marginTop: '2px' }}>OBF Booking Form v{b.revision} verified</div>
          </div>

          <div style={{ padding: '10px 14px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Allocated Vehicle & Chassis</div>
            <div style={{ fontSize: '14px', fontWeight: 650, marginTop: '2px', color: 'var(--ink)' }}>{data.model} {data.suffix_1 ? `(${data.suffix_1})` : ''} · {data.colour_1}</div>
            <div style={{ fontSize: '12px', color: '#1e40af', marginTop: '2px', fontFamily: 'monospace' }}>
              {submission.data?.allocation_ref ? `VIN: ${submission.data.allocation_ref}` : 'Allocation pending'}
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer KYC Documents</div>
            <div style={{ fontSize: '12px', display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
              {docs.data?.filter(d => ['aadhaar', 'pan'].includes(d.kind) && d.status === 'ready').map(d => (
                <span key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#166534', fontWeight: 600 }}>{d.kind.toUpperCase()}</span>
                  <DocumentPreviewModal documentId={d.id} label="Preview" title={`${d.kind.toUpperCase()} Preview`} subtitle={data.customer_name || 'Customer'} />
                </span>
              ))}
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Commercial Clearance Receipts</div>
            <div style={{ fontSize: '12px', marginTop: '2px' }}>
              {advancePayment?.status === 'verified' ? (
                <span style={{ color: '#166534', fontWeight: 600 }}>Advance: Receipt #{advancePayment.receipt_no}</span>
              ) : (
                <span style={{ color: '#9a3412' }}>Advance pending</span>
              )}
              {' · '}
              {balancePayment?.status === 'verified' ? (
                <span style={{ color: '#166534', fontWeight: 600 }}>Balance: Receipt #{balancePayment.receipt_no}</span>
              ) : (
                <span style={{ color: '#9a3412' }}>Balance pending</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.boGrid}>
        {/* 2. PDI Verification Card (SRC-B02) */}
        <div className={styles.boCard}>
          <h3>
            <span>2. Pre-Delivery Inspection (PDI)</span>
            <span className={prep?.pdi_status === 'passed' ? styles.badgePassed : prep?.pdi_status === 'rework' ? styles.badgeRework : prep?.pdi_status === 'failed' ? styles.badgeRework : styles.badgePending}>
              {prep?.pdi_status === 'passed' ? 'Passed' : prep?.pdi_status === 'rework' ? 'Rework' : prep?.pdi_status === 'failed' ? 'Failed' : 'Pending'}
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
                <input name="notes" defaultValue={prep?.pdi_notes || ''} placeholder="e.g. Battery checked, toolkit verified, odometer 14 km" style={{display:'block',width:'100%',marginTop:'4px',padding:'6px 8px',borderRadius:'6px',border:'1px solid var(--line)'}}/>
              </label>
            </ActionForm>
          </div>}
        </div>

        {/* 3. VAHAN & Statutory Signatures Card (SRC-B03 to SRC-B05) */}
        <div className={styles.boCard}>
          <h3>
            <span>3. VAHAN Staging & Signatures</span>
            <span className={prep?.vahan_app_no && prep?.form20_signed ? styles.badgePassed : styles.badgePending}>
              {prep?.vahan_app_no && prep?.form20_signed ? 'Staged' : 'Action Required'}
            </span>
          </h3>
          <p><strong>VAHAN App No:</strong> {prep?.vahan_app_no || 'Not entered yet'}</p>
          <p><strong>Form 20 (RTO Form):</strong> {prep?.form20_signed ? 'Physically ink-signed on paper original' : 'Pending ink signature'}</p>
          <p><strong>Customer Disclaimer:</strong> {prep?.disclaimer_signed ? 'Physically ink-signed on paper original' : 'Pending ink signature'}</p>

          {/* Uploaded statutory documents preview */}
          <div style={{ margin: '10px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {vahanAckDoc && (
              <div style={{ padding: '6px 10px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#166534', fontWeight: 600 }}>VAHAN Ack Slip (v{vahanAckDoc.version})</span>
                <DocumentPreviewModal documentId={vahanAckDoc.id} label="Preview" title="VAHAN Acknowledgement Receipt" subtitle={`App: ${prep?.vahan_app_no || ''}`} />
              </div>
            )}
            {form20Doc && (
              <div style={{ padding: '6px 10px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#166534', fontWeight: 600 }}>Form 20 Scanned Copy (v{form20Doc.version})</span>
                <DocumentPreviewModal documentId={form20Doc.id} label="Preview" title="Form 20 Scanned Copy" subtitle={`Registered to: ${data.registration_name || ''}`} />
              </div>
            )}
            {disclaimerDoc && (
              <div style={{ padding: '6px 10px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: '#166534', fontWeight: 600 }}>Disclaimer Scanned Copy (v{disclaimerDoc.version})</span>
                <DocumentPreviewModal documentId={disclaimerDoc.id} label="Preview" title="Customer Disclaimer Copy" subtitle={`Customer: ${data.customer_name || ''}`} />
              </div>
            )}
          </div>

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
              <label style={{display:'block',margin:'10px 0 6px',fontSize:'13px',fontWeight:550}}>
                VAHAN Acknowledgement Slip (Optional PDF/JPEG)
                <input name="vahan_ack_file" type="file" accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg" style={{display:'block',width:'100%',marginTop:'4px',padding:'6px 8px',borderRadius:'6px',border:'1px solid var(--line)'}}/>
              </label>
            </ActionForm>
          </div>}
        </div>
      </div>

      {/* 4. Departmental Dispatches (SRC-H03 to SRC-H08) */}
      <div style={{marginTop:'28px'}}>
        <h3 style={{fontSize:'17px',marginBottom:'6px'}}>4. Departmental Dispatches (SRC-H03 to SRC-H08)</h3>
        <p style={{fontSize:'14px',color:'var(--muted)',margin:'0 0 16px'}}>
          Dispatch the approved vehicle dossier to Insurance, Accounts, and Accessories for parallel preparation.
        </p>
        {prep?.pdi_status !== 'passed' && (
          <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px', marginBottom: '14px', fontSize: '13px', color: '#92400e' }}>
            Stockyard PDI inspection is recommended to be marked &ldquo;Passed&rdquo; before sending files to Accounts for commercial invoicing.
          </div>
        )}
        <div className={styles.dispatchGrid}>
          {/* Insurance Dispatch */}
          <div className={styles.dispatchCard}>
            <div>
              <h4>1. Insurance Desk</h4>
              <p>For policy quotation, underwriter selection, cover note generation, and broker entry.</p>
              <span className={prep?.insurance_dispatched_at ? styles.badgePassed : styles.badgePending}>
                {prep?.insurance_dispatched_at ? 'Dispatched' : 'Awaiting Dispatch'}
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
                {prep?.accounts_dispatched_at ? 'Dispatched' : 'Awaiting Dispatch'}
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
                {prep?.accessories_dispatched_at ? 'Dispatched' : 'Awaiting Dispatch'}
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

        {/* 5. Official RTO Vehicle Registration & HSRP Fitment (SRC-B06, SRC-H08) */}
        <div style={{ marginTop: '20px', padding: '18px 20px', background: '#f8fafc', border: '1px solid var(--line)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 650, margin: '0 0 4px' }}>5. Official RTO Vehicle Registration & HSRP (SRC-B06, SRC-H08)</h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
                Entry of permanent registration number, high-security registration plates (HSRP), and RC status following road tax clearance.
              </p>
            </div>
            <span className={prep?.rto_registration_no ? styles.badgePassed : accountsRecord?.road_tax_receipt_no ? styles.badgePending : styles.badgeRework}>
              {prep?.rto_registration_no ? 'Registered' : accountsRecord?.road_tax_receipt_no ? 'Ready for Registration' : 'Locked (Pending Road Tax)'}
            </span>
          </div>

          {prep?.rto_registration_no ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', background: 'white', padding: '14px 16px', border: '1px solid var(--line)', borderRadius: '6px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Permanent Reg Number</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#166534', marginTop: '2px', fontFamily: 'monospace' }}>
                    {prep.rto_registration_no}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Registration Date</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
                    {prep.rto_registration_date || 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>HSRP Embossed Plates</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: prep.hsrp_status === 'fitted' ? '#166534' : 'var(--ink)', marginTop: '2px' }}>
                    {prep.hsrp_status === 'fitted' ? 'Fitted on Vehicle' : prep.hsrp_status === 'received' ? 'Received at Yard' : 'Pending'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>RTO Jurisdiction</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
                    {prep.rto_location || 'Ernakulam RTO'}
                  </div>
                </div>
              </div>
              {rtoRcDoc && (
                <div style={{ marginTop: '10px' }}>
                  <DocumentPreviewModal
                    documentId={rtoRcDoc.id}
                    label="View Registration Certificate (RC) Copy"
                    title={`Registration Certificate — ${prep.rto_registration_no}`}
                    subtitle={`Customer: ${data.registration_name || data.customer_name || 'Customer'}`}
                  />
                </div>
              )}
            </div>
          ) : accountsRecord?.road_tax_receipt_no ? (
            <div>
              <p style={{ fontSize: '13px', color: '#166534', margin: '0 0 12px' }}>
                Kerala Road Tax challan verified (#{accountsRecord.road_tax_receipt_no}). Back Office can now record the official RTO registration number.
              </p>
              {(isBO || isAdmin) && (
                <ActionForm action={recordRTORegistration} label="Record Official RTO Registration">
                  <input type="hidden" name="booking" value={id} />
                  <input type="hidden" name="operation" value={randomUUID()} />
                  <input type="hidden" name="revision" value={b.revision} />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
                    <label>
                      Permanent Vehicle Reg Number
                      <input
                        name="registration_no"
                        type="text"
                        required
                        placeholder="e.g. KL-07-CS-4491"
                        style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                      />
                    </label>
                    <label>
                      Registration Date
                      <input
                        name="registration_date"
                        type="date"
                        required
                        defaultValue={new Date().toISOString().split('T')[0]}
                        style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                      />
                    </label>
                    <label>
                      RTO Office / Sub-RTO
                      <input
                        name="location"
                        type="text"
                        required
                        defaultValue="Ernakulam RTO (KL-07)"
                        style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                      />
                    </label>
                    <label>
                      HSRP Plate Status
                      <select
                        name="hsrp_status"
                        defaultValue="fitted"
                        style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                      >
                        <option value="fitted">Plates Embossed & Fitted</option>
                        <option value="received">Plates Received from Vendor</option>
                        <option value="pending">Awaiting HSRP Delivery</option>
                      </select>
                    </label>
                    <label>
                      RC Smart Card Status
                      <select
                        name="rc_status"
                        defaultValue="generated"
                        style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                      >
                        <option value="generated">Digital RC Generated (mParivahan)</option>
                        <option value="dispatched">Dispatched by RTO Post</option>
                        <option value="received">Physical Smart Card Received</option>
                      </select>
                    </label>
                  </div>
                </ActionForm>
              )}
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
              Official RTO registration number can be entered once Accounts has paid and recorded the Kerala Road Tax receipt (Rule SRC-H08).
            </p>
          )}
        </div>
      </div>
    </section>}

    {Boolean(prep?.insurance_dispatched_at || insurancePolicy) && (
      <section className={styles.boSection} id="insurance">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Statutory Underwriting / Toyota Insurance Broking (SRC-I01 to SRC-I11)
            </span>
            <h2 style={{ margin: '4px 0 6px', fontSize: '20px' }}>Motor Insurance Policy Issuance</h2>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
              Mandatory insurance policy issuance and verification before Accounts tax invoicing (Rule D-16).
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={insurancePolicy?.status === 'issued' ? styles.badgePassed : styles.badgePending}>
              {insurancePolicy?.status === 'issued' ? 'Policy Issued' : 'Awaiting Insurance Policy'}
            </span>
            {!insurancePolicy && (isInsurance || isBO || isSM) && (
              <ActionForm action={fillDemoInsurancePolicy} label="Demo: Issue Insurance Policy" secondary>
                <input type="hidden" name="booking" value={id} />
                <input type="hidden" name="revision" value={b.revision} />
              </ActionForm>
            )}
          </div>
        </div>

        {/* 1. Insurance Underwriting Dossier (What the Insurance Executive sees) */}
        <div style={{ padding: '16px 20px', background: '#f8fafc', border: '1px solid var(--line)', borderRadius: '8px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 650, margin: '0 0 4px' }}>1. Underwriting Technical Dossier</h3>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 14px' }}>
            Verified technical parameters, customer KYC, and financier details required for binding the policy.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
            {/* Vehicle & Chassis Card */}
            <div style={{ padding: '12px 14px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Vehicle & Stockyard Chassis
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px', color: 'var(--ink)' }}>
                {data.model} {data.suffix_1 ? `(${data.suffix_1})` : ''}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                Colour: <strong>{data.colour_1 || 'Standard'}</strong> · Seating: <strong>7 Seater</strong> · Fuel: <strong>Hybrid / Petrol</strong>
              </div>
              <div style={{ fontSize: '12px', color: '#1e40af', marginTop: '6px', fontFamily: 'monospace', fontWeight: 600 }}>
                {submission.data?.allocation_ref ? `Chassis / VIN: ${submission.data.allocation_ref}` : 'Chassis Allocation Pending'}
              </div>
            </div>

            {/* Policyholder Card */}
            <div style={{ padding: '12px 14px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Policyholder (RTO Registered Owner)
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px', color: 'var(--ink)' }}>
                {data.registration_name || data.customer_name || 'Customer'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                RTO Address: {data.registration_address || data.communication_address} (PIN: {data.registration_pin || data.pin})
              </div>
              <div style={{ fontSize: '12px', display: 'flex', gap: '12px', marginTop: '6px', alignItems: 'center' }}>
                {docs.data?.filter(d => ['aadhaar', 'pan'].includes(d.kind) && d.status === 'ready').map(d => (
                  <span key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#166534', fontWeight: 600 }}>{d.kind.toUpperCase()}</span>
                    <DocumentPreviewModal documentId={d.id} label="Preview" title={`${d.kind.toUpperCase()} Preview`} subtitle={data.customer_name || 'Customer'} />
                  </span>
                ))}
              </div>
            </div>

            {/* Hypothecation Card */}
            <div style={{ padding: '12px 14px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Financier Hypothecation Endorsement
              </div>
              <div style={{ fontSize: '14px', fontWeight: 650, marginTop: '2px', color: 'var(--ink)' }}>
                {insurancePolicy?.hypothecation_bank || 'HDFC Bank Ltd / Toyota Financial Services'}
              </div>
              <div style={{ fontSize: '12px', color: '#166534', marginTop: '4px', fontWeight: 550 }}>
                Endorsement clause included on policy
              </div>
            </div>

            {/* CPA & Nominee Card */}
            <div style={{ padding: '12px 14px', background: 'white', border: '1px solid var(--line)', borderRadius: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Compulsory Personal Accident (CPA) Nominee
              </div>
              <div style={{ fontSize: '14px', fontWeight: 650, marginTop: '2px', color: 'var(--ink)' }}>
                {insurancePolicy?.nominee_name || 'Anitha S.'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                Relationship: <strong>{insurancePolicy?.nominee_relation || 'Spouse'}</strong> · Age: <strong>{insurancePolicy?.nominee_age || 38} years</strong>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Policy Status or Issuance Form */}
        {insurancePolicy?.status === 'issued' ? (
          <div style={{ padding: '20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Policy Issued & Active
                </span>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#14532d', marginTop: '2px' }}>
                  {insurancePolicy.company_name} — #{insurancePolicy.policy_number}
                </div>
                <div style={{ fontSize: '13px', color: '#166534', marginTop: '4px' }}>
                  Comprehensive Coverage (1-Year Own Damage + 3-Year Third Party)
                </div>
              </div>
              {policyDoc && (
                <DocumentPreviewModal
                  documentId={policyDoc.id}
                  label="View Policy Document (PDF)"
                  title={`Motor Insurance Policy — ${insurancePolicy.company_name}`}
                  subtitle={`Policy #${insurancePolicy.policy_number} · Insured: ${data.registration_name || data.customer_name || 'Customer'}`}
                />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #bbf7d0' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 650, color: '#166534', textTransform: 'uppercase' }}>Insured Declared Value (IDV)</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#14532d', marginTop: '2px' }}>
                  ₹{Number(insurancePolicy.idv_amount).toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 650, color: '#166534', textTransform: 'uppercase' }}>Gross Premium Paid</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#14532d', marginTop: '2px' }}>
                  ₹{Number(insurancePolicy.premium_amount).toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 650, color: '#166534', textTransform: 'uppercase' }}>Validity Period</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#14532d', marginTop: '2px' }}>
                  {insurancePolicy.policy_start_date} to {insurancePolicy.policy_end_date || 'N/A'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 650, color: '#166534', textTransform: 'uppercase' }}>Issued On</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#14532d', marginTop: '2px' }}>
                  {insurancePolicy.issued_at ? new Date(insurancePolicy.issued_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Recently'}
                </div>
              </div>
            </div>

            {/* Add-ons Badges */}
            {Array.isArray(insurancePolicy.add_ons) && insurancePolicy.add_ons.length > 0 && (
              <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 650, color: '#166534' }}>Included Add-on Covers:</span>
                {insurancePolicy.add_ons.map((addon: unknown) => (
                  <span key={String(addon)} style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#dcfce7', color: '#14532d', border: '1px solid #86efac' }}>
                    {String(addon).replace(/_/g, ' ').toUpperCase()}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : isInsurance ? (
          <div style={{ padding: '20px', background: '#fafbfc', border: '1px solid var(--line)', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 650, margin: '0 0 6px' }}>2. Issue Policy & Bind Coverage</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 16px' }}>
              Enter the underwriter and issued policy certificate details. Attaching the policy copy allows Accounts to proceed with invoicing.
            </p>

            <ActionForm action={recordInsurancePolicy} label="Issue Motor Insurance Policy">
              <input type="hidden" name="operation" value={randomUUID()} />
              <input type="hidden" name="booking" value={id} />
              <input type="hidden" name="revision" value={b.revision} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <label style={{ fontSize: '13px', fontWeight: 550 }}>
                  Underwriter / Insurance Partner
                  <select name="company_name" required defaultValue="ICICI Lombard General Insurance" style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}>
                    <option value="ICICI Lombard General Insurance">ICICI Lombard General Insurance</option>
                    <option value="Bajaj Allianz General Insurance">Bajaj Allianz General Insurance</option>
                    <option value="Tata AIG General Insurance">Tata AIG General Insurance</option>
                    <option value="HDFC ERGO General Insurance">HDFC ERGO General Insurance</option>
                    <option value="Go Digit General Insurance">Go Digit General Insurance</option>
                    <option value="New India Assurance">New India Assurance Co.</option>
                  </select>
                </label>

                <label style={{ fontSize: '13px', fontWeight: 550 }}>
                  Official Policy / Cover Note Number
                  <input name="policy_number" required placeholder="e.g. POL-ICICI-2026-992189" style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} />
                </label>

                <label style={{ fontSize: '13px', fontWeight: 550 }}>
                  Insured Declared Value (IDV) (₹)
                  <input name="idv_amount" type="number" required defaultValue="1850000" min="1" step="1" style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} />
                </label>

                <label style={{ fontSize: '13px', fontWeight: 550 }}>
                  Total Gross Premium (incl. 18% GST) (₹)
                  <input name="premium_amount" type="number" required defaultValue="46250" min="1" step="1" style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} />
                </label>

                <label style={{ fontSize: '13px', fontWeight: 550 }}>
                  Policy Start Date
                  <input name="policy_start_date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} />
                </label>

                <label style={{ fontSize: '13px', fontWeight: 550 }}>
                  Policy End Date (1-Year OD)
                  <input name="policy_end_date" type="date" defaultValue={(() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split('T')[0]; })()} required style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} />
                </label>

                <label style={{ fontSize: '13px', fontWeight: 550 }}>
                  CPA Nominee Full Name
                  <input name="nominee_name" defaultValue="Anitha S." placeholder="Nominee name" style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 550 }}>
                    Nominee Relation
                    <input name="nominee_relation" defaultValue="Spouse" placeholder="e.g. Spouse" style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} />
                  </label>
                  <label style={{ fontSize: '13px', fontWeight: 550 }}>
                    Nominee Age
                    <input name="nominee_age" type="number" defaultValue="38" min="18" max="100" style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} />
                  </label>
                </div>

                <label style={{ fontSize: '13px', fontWeight: 550, gridColumn: 'span 2' }}>
                  Financier Hypothecation Endorsement
                  <input name="hypothecation_bank" defaultValue="HDFC Bank Ltd (Auto Loan Division)" placeholder="e.g. HDFC Bank Ltd / Toyota Financial Services" style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} />
                </label>
              </div>

              {/* Add-ons selection */}
              <div style={{ margin: '14px 0 16px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Selected Policy Add-On Covers</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px', fontSize: '13px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="checkbox" name="add_ons" value="zero_dep" defaultChecked />
                    Nil Depreciation (Zero Dep)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="checkbox" name="add_ons" value="engine_protect" defaultChecked />
                    Engine & Gearbox Protection
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="checkbox" name="add_ons" value="return_to_invoice" defaultChecked />
                    Return to Invoice (RTI)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="checkbox" name="add_ons" value="rsa" defaultChecked />
                    24x7 Roadside Assistance
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="checkbox" name="add_ons" value="consumables" defaultChecked />
                    Consumables Cover
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="checkbox" name="add_ons" value="key_replacement" defaultChecked />
                    Key Replacement Cover
                  </label>
                </div>
              </div>

              {/* Policy file upload */}
              <label style={{ display: 'block', margin: '12px 0 16px', fontSize: '13px', fontWeight: 550 }}>
                Attach Official Motor Insurance Policy (PDF or JPEG)
                <input name="policy_file" type="file" accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg" style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }} />
              </label>
            </ActionForm>
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Awaiting the Insurance Desk coordinator to bind and record the motor insurance policy.
          </p>
        )}
      </section>
    )}

    {/* ACCOUNTS DEPARTMENT DOSSIER (SRC-A01 to SRC-A07, Rules D-16, D-17) */}
    {(Boolean(prep?.accounts_dispatched_at) || Boolean(accountsRecord)) && (
      <section className={styles.section} style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Commercial Invoicing & Statutory Taxation (SRC-A01 to SRC-A07, Rules D-16, D-17)
            </span>
            <h2 style={{ margin: '4px 0 6px', fontSize: '20px' }}>Accounts Department Clearance</h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Commercial Vehicle Invoicing (gated on Insurance), FASTag issuance, and Kerala Road Tax e-Treasury payment.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 650,
              background: (prep?.accounts_completed_at || accountsRecord?.status === 'cleared') ? '#e6f4ea' : '#fef7e0',
              color: (prep?.accounts_completed_at || accountsRecord?.status === 'cleared') ? '#137333' : '#b06000'
            }}>
              {(prep?.accounts_completed_at || accountsRecord?.status === 'cleared') ? 'Accounts Clearance Completed' : 'Accounts Processing In Progress'}
            </span>
            {!(prep?.accounts_completed_at || accountsRecord?.status === 'cleared') && (isAccounts || isBO || isSM) && (
              <ActionForm action={fillDemoAccounts} label="Demo: Complete Accounts Clearance" secondary>
                <input type="hidden" name="booking" value={id} />
                <input type="hidden" name="revision" value={b.revision} />
              </ActionForm>
            )}
          </div>
        </div>

        {/* 1. Pre-Invoice Financial Verification Dossier (SRC-A01, SRC-A02) */}
        <div style={{ background: '#f8fafc', border: '1px solid var(--line)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 650 }}>
            1. Pre-Invoice Dossier & Rule D-16 Insurance Gate
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '13px' }}>
            <div>
              <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Customer Legal Name</span>
              <strong>{data.customer_name || 'Customer Name Pending'}</strong>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                Customer ID: {data.customer_code || b.customer_id}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Allocated Vehicle Chassis</span>
              <strong style={{ fontFamily: 'monospace' }}>{submission.data?.allocation_ref || 'Allocation Pending'}</strong>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                Model: {data.model || 'Model Pending'}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Booking Advance & Balance</span>
              <strong>Advance: Rs. {Number(advancePayment?.amount || 0).toLocaleString('en-IN')}</strong>
              <div style={{ fontSize: '11px', color: balancePayment ? '#137333' : '#b06000', marginTop: '2px', fontWeight: 550 }}>
                {balancePayment ? `Balance: Rs. ${Number(balancePayment.amount).toLocaleString('en-IN')} (Cleared)` : 'Balance: Awaiting Clearance'}
              </div>
            </div>
          </div>

          {/* Rule D-16 Gate Banner */}
          <div style={{
            marginTop: '14px',
            padding: '12px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            background: insurancePolicy?.status === 'issued' ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${insurancePolicy?.status === 'issued' ? '#bbf7d0' : '#fef08a'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div>
              <strong style={{ color: insurancePolicy?.status === 'issued' ? '#166534' : '#854d0e' }}>
                {insurancePolicy?.status === 'issued' ? 'Rule D-16 Satisfied: Motor Insurance Policy Bound' : 'Rule D-16 Invariant: Motor Insurance Policy Required Before Invoicing'}
              </strong>
              <div style={{ fontSize: '12px', color: 'var(--ink)', marginTop: '2px' }}>
                {insurancePolicy?.status === 'issued'
                  ? `Policy #${insurancePolicy.policy_number} issued with ${insurancePolicy.company_name} (IDV: Rs. ${Number(insurancePolicy.idv_amount || 0).toLocaleString('en-IN')}). Commercial invoicing unlocked.`
                  : 'Commercial vehicle tax invoicing cannot proceed until Insurance issues and binds the motor insurance policy.'}
              </div>
            </div>
            {policyDoc && (
              <DocumentPreviewModal
                documentId={policyDoc.id}
                label="View Policy PDF"
                title={`Motor Insurance Policy — ${insurancePolicy?.company_name}`}
                subtitle={`Policy #${insurancePolicy?.policy_number}`}
              />
            )}
          </div>
        </div>

        {/* 2. Commercial Vehicle Tax Invoicing (SRC-A03, SRC-A06) */}
        <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 650 }}>
              2. Commercial Vehicle Tax Invoice (SRC-A03, SRC-A06)
            </h3>
            {accountsRecord?.invoice_number && (
              <span style={{ fontSize: '11px', fontWeight: 650, color: '#137333', background: '#e6f4ea', padding: '3px 8px', borderRadius: '4px' }}>
                Invoiced
              </span>
            )}
          </div>

          {accountsRecord?.invoice_number ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px', marginBottom: '12px' }}>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Tax Invoice Number</span>
                  <strong style={{ fontFamily: 'monospace' }}>{accountsRecord.invoice_number}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Invoice Date</span>
                  <span>{accountsRecord.invoice_date}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Ex-Showroom Price</span>
                  <span>Rs. {Number(accountsRecord.ex_showroom_amount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>TCS Amount (1%)</span>
                  <span>Rs. {Number(accountsRecord.tcs_amount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Total Invoice Amount</span>
                  <strong style={{ color: '#137333' }}>Rs. {Number(accountsRecord.total_invoice_amount || 0).toLocaleString('en-IN')}</strong>
                </div>
              </div>
              {invoiceDoc && (
                <div style={{ marginTop: '8px' }}>
                  <DocumentPreviewModal
                    documentId={invoiceDoc.id}
                    label="View Commercial Invoice PDF"
                    title={`Commercial Tax Invoice — ${accountsRecord.invoice_number}`}
                    subtitle={`Amount: Rs. ${Number(accountsRecord.total_invoice_amount || 0).toLocaleString('en-IN')}`}
                  />
                </div>
              )}
            </div>
          ) : insurancePolicy?.status !== 'issued' ? (
            <p style={{ margin: 0, fontSize: '13px', color: '#b06000' }}>
              Tax invoicing form is locked pending Insurance policy issuance under Rule D-16.
            </p>
          ) : isAccounts ? (
            <ActionForm action={recordVehicleInvoice} label="Record Commercial Vehicle Invoice">
              <input type="hidden" name="booking" value={id} />
              <input type="hidden" name="operation" value={randomUUID()} />
              <input type="hidden" name="revision" value={b.revision} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
                <label>
                  Tax Invoice Number
                  <input
                    name="invoice_number"
                    type="text"
                    required
                    placeholder="e.g. INV-NT-2026-08492"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
                <label>
                  Invoice Date
                  <input
                    name="invoice_date"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
                <label>
                  Ex-Showroom Price (Rs.)
                  <input
                    name="ex_showroom_amount"
                    type="number"
                    step="1"
                    required
                    defaultValue="1850000"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
                <label>
                  TCS Amount (Rs.)
                  <input
                    name="tcs_amount"
                    type="number"
                    step="1"
                    defaultValue="18500"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
                <label>
                  Total Commercial Invoice Amount (Rs.)
                  <input
                    name="total_invoice_amount"
                    type="number"
                    step="1"
                    required
                    defaultValue="1868500"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
              </div>

              <label style={{ display: 'block', margin: '12px 0 16px', fontSize: '13px', fontWeight: 550 }}>
                Attach Official Commercial Invoice (PDF or JPEG)
                <input
                  name="invoice_file"
                  type="file"
                  accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg"
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                />
              </label>
            </ActionForm>
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Awaiting Accounts coordinator to record the commercial vehicle tax invoice.
            </p>
          )}
        </div>

        {/* 3. FASTag RFID Tag Issuance & Cashier Handover (SRC-A04, SRC-A06, SRC-C01, SRC-H09) */}
        <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 650 }}>
              3. FASTag RFID Issuance & Cash Counter Handover (SRC-A04, SRC-C01, SRC-H09)
            </h3>
            {accountsRecord?.fastag_tag_id && (
              <span style={{ fontSize: '11px', fontWeight: 650, color: '#1a73e8', background: '#e8f0fe', padding: '3px 8px', borderRadius: '4px' }}>
                {accountsRecord.fastag_handover_status === 'handed_over' ? 'Handed Over' : 'Tag Issued'}
              </span>
            )}
          </div>

          {accountsRecord?.fastag_tag_id ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px', marginBottom: '12px' }}>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>RFID Tag Barcode / ID</span>
                  <strong style={{ fontFamily: 'monospace' }}>{accountsRecord.fastag_tag_id}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Issuing Partner Bank</span>
                  <span>{accountsRecord.fastag_bank}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Security Deposit</span>
                  <span>Rs. {accountsRecord.fastag_security_deposit}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Initial Wallet Balance</span>
                  <span>Rs. {accountsRecord.fastag_wallet_balance}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Cash Counter Handover</span>
                  <span style={{ color: accountsRecord.fastag_handover_status === 'handed_over' ? '#137333' : '#b06000', fontWeight: 600 }}>
                    {accountsRecord.fastag_handover_status === 'handed_over' ? 'Handed Over by Cashier' : 'Pending Handover at Counter'}
                  </span>
                </div>
              </div>

              {accountsRecord.fastag_handover_status === 'pending_handover' && (isCashier || isAccounts) && (
                <div style={{ marginTop: '12px', padding: '12px', background: '#fafbfc', border: '1px solid var(--line)', borderRadius: '6px' }}>
                  <ActionForm action={acknowledgeFastagHandover} label="Acknowledge Physical FASTag Handover">
                    <input type="hidden" name="booking" value={id} />
                    <input type="hidden" name="operation" value={randomUUID()} />
                    <input type="hidden" name="revision" value={b.revision} />
                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '8px' }}>
                      Handover Notes (Optional)
                      <input
                        name="notes"
                        type="text"
                        placeholder="Tag affixed on windscreen / Handed over to SO"
                        style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                      />
                    </label>
                  </ActionForm>
                </div>
              )}
            </div>
          ) : isAccounts ? (
            <ActionForm action={recordFastagIssuance} label="Issue FASTag RFID Tag">
              <input type="hidden" name="booking" value={id} />
              <input type="hidden" name="operation" value={randomUUID()} />
              <input type="hidden" name="revision" value={b.revision} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
                <label>
                  FASTag RFID ID / Barcode
                  <input
                    name="fastag_tag_id"
                    type="text"
                    required
                    placeholder="e.g. 607417-TAG-882910"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
                <label>
                  Issuing Bank
                  <select
                    name="fastag_bank"
                    required
                    defaultValue="ICICI Bank (NETC FASTag)"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  >
                    <option value="ICICI Bank (NETC FASTag)">ICICI Bank (NETC FASTag)</option>
                    <option value="IDFC First Bank">IDFC First Bank</option>
                    <option value="State Bank of India">State Bank of India</option>
                    <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                    <option value="HDFC Bank">HDFC Bank</option>
                  </select>
                </label>
                <label>
                  Security Deposit (Rs.)
                  <input
                    name="fastag_security_deposit"
                    type="number"
                    step="1"
                    defaultValue="200"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
                <label>
                  Initial Wallet Balance (Rs.)
                  <input
                    name="fastag_wallet_balance"
                    type="number"
                    step="1"
                    defaultValue="300"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
              </div>
            </ActionForm>
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Awaiting Accounts coordinator to allocate and record the FASTag RFID tag.
            </p>
          )}
        </div>

        {/* 4. Kerala Road Tax & e-Treasury Payment (SRC-A05, SRC-A06, SRC-H07) */}
        <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 650 }}>
              4. Kerala Road Tax & Statutory Statutory Payment (SRC-A05, SRC-A06, SRC-H07)
            </h3>
            {accountsRecord?.road_tax_receipt_no && (
              <span style={{ fontSize: '11px', fontWeight: 650, color: '#137333', background: '#e6f4ea', padding: '3px 8px', borderRadius: '4px' }}>
                Tax Paid
              </span>
            )}
          </div>

          {accountsRecord?.road_tax_receipt_no ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px', marginBottom: '12px' }}>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>e-Treasury Challan / Receipt #</span>
                  <strong style={{ fontFamily: 'monospace' }}>{accountsRecord.road_tax_receipt_no}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Road Tax Amount Paid</span>
                  <strong style={{ color: '#137333' }}>Rs. {Number(accountsRecord.road_tax_amount || 0).toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Payment Mode</span>
                  <span>{accountsRecord.road_tax_payment_mode === 'e_treasury_netbanking' ? 'e-Treasury Net Banking' : 'VAHAN e-Challan'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Date Paid</span>
                  <span>{accountsRecord.road_tax_paid_date}</span>
                </div>
              </div>
              {roadTaxDoc && (
                <div style={{ marginTop: '8px' }}>
                  <DocumentPreviewModal
                    documentId={roadTaxDoc.id}
                    label="View Road Tax Challan PDF"
                    title={`Kerala Road Tax Challan — ${accountsRecord.road_tax_receipt_no}`}
                    subtitle={`Tax Amount: Rs. ${Number(accountsRecord.road_tax_amount || 0).toLocaleString('en-IN')}`}
                  />
                </div>
              )}
            </div>
          ) : isAccounts ? (
            <ActionForm action={recordRoadTaxPayment} label="Record Kerala Road Tax Payment">
              <input type="hidden" name="booking" value={id} />
              <input type="hidden" name="operation" value={randomUUID()} />
              <input type="hidden" name="revision" value={b.revision} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
                <label>
                  e-Treasury Challan / Receipt Number
                  <input
                    name="road_tax_receipt_no"
                    type="text"
                    required
                    placeholder="e.g. KL-ETR-2026-98124"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
                <label>
                  Road Tax Amount (Rs.)
                  <input
                    name="road_tax_amount"
                    type="number"
                    step="1"
                    required
                    defaultValue="277500"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
                <label>
                  Payment Mode
                  <select
                    name="road_tax_payment_mode"
                    required
                    defaultValue="e_treasury_netbanking"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  >
                    <option value="e_treasury_netbanking">Kerala e-Treasury Net Banking</option>
                    <option value="vahan_challan">VAHAN e-Challan Portal</option>
                    <option value="dd">Demand Draft to RTO</option>
                  </select>
                </label>
                <label>
                  Payment Date
                  <input
                    name="road_tax_paid_date"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
              </div>

              <label style={{ display: 'block', margin: '12px 0 16px', fontSize: '13px', fontWeight: 550 }}>
                Attach Official Road Tax Challan / Receipt (PDF or JPEG)
                <input
                  name="road_tax_file"
                  type="file"
                  accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg"
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                />
              </label>
            </ActionForm>
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Awaiting Accounts coordinator to record the statutory road tax payment.
            </p>
          )}
        </div>

        {/* 5. Complete Accounts Clearance & Return File to BO (SRC-A06, SRC-H06, SRC-T04) */}
        <div style={{
          background: (prep?.accounts_completed_at || accountsRecord?.status === 'cleared') ? '#f0fdf4' : '#fafbfc',
          border: `1px solid ${(prep?.accounts_completed_at || accountsRecord?.status === 'cleared') ? '#bbf7d0' : 'var(--line)'}`,
          borderRadius: '8px',
          padding: '16px'
        }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 650 }}>
            5. Final Accounts Clearance & File Return (SRC-A06, SRC-H06, SRC-T04)
          </h3>
          {(prep?.accounts_completed_at || accountsRecord?.status === 'cleared') ? (
            <p style={{ margin: 0, fontSize: '13px', color: '#166534' }}>
              Accounts Clearance is finalized. Commercial Tax Invoice, FASTag RFID allocation, and Kerala Road Tax e-Treasury payments are completed and returned to Back Office for registration & delivery dispatch.
            </p>
          ) : accountsRecord?.invoice_number && accountsRecord?.fastag_tag_id && accountsRecord?.road_tax_receipt_no ? (
            <div>
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--ink)' }}>
                All Accounts prerequisites (Commercial Invoice, FASTag, Road Tax) are satisfied. Click below to complete accounts clearance and hand the file back to Back Office.
              </p>
              {isAccounts && (
                <ActionForm action={completeAccountsClearance} label="Complete Accounts Clearance & Return File to BO">
                  <input type="hidden" name="booking" value={id} />
                  <input type="hidden" name="operation" value={randomUUID()} />
                  <input type="hidden" name="revision" value={b.revision} />
                </ActionForm>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              <span>Pending Accounts Prerequisites:</span>
              <ul style={{ margin: '6px 0 0', paddingLeft: '20px' }}>
                <li style={{ color: accountsRecord?.invoice_number ? '#137333' : '#b06000' }}>
                  Commercial Tax Invoice: {accountsRecord?.invoice_number ? 'Completed' : 'Pending'}
                </li>
                <li style={{ color: accountsRecord?.fastag_tag_id ? '#137333' : '#b06000' }}>
                  FASTag RFID Allocation: {accountsRecord?.fastag_tag_id ? 'Completed' : 'Pending'}
                </li>
                <li style={{ color: accountsRecord?.road_tax_receipt_no ? '#137333' : '#b06000' }}>
                  Kerala Road Tax Payment: {accountsRecord?.road_tax_receipt_no ? 'Completed' : 'Pending'}
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* 6. Final Financial Closure & Dispatch to Security (SRC-X09, SRC-T07) */}
        <div style={{
          marginTop: '16px',
          background: deliveryRecord?.financial_closure_at ? '#f0fdf4' : '#fafbfc',
          border: `1px solid ${deliveryRecord?.financial_closure_at ? '#bbf7d0' : 'var(--line)'}`,
          borderRadius: '8px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 650 }}>
              6. Final Commercial Financial Closure (SRC-X09, SRC-T07)
            </h3>
            <span style={{
              fontSize: '11px',
              fontWeight: 650,
              color: deliveryRecord?.financial_closure_at ? '#137333' : '#b06000',
              background: deliveryRecord?.financial_closure_at ? '#e6f4ea' : '#fef7e0',
              padding: '3px 8px',
              borderRadius: '4px'
            }}>
              {deliveryRecord?.financial_closure_at ? 'Financially Closed' : 'Pending Financial Closure'}
            </span>
          </div>

          {deliveryRecord?.financial_closure_at ? (
            <div>
              <p style={{ margin: 0, fontSize: '13px', color: '#166534' }}>
                Financial closure recorded on {new Date(deliveryRecord.financial_closure_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}. Vehicle invoice, FASTag, road tax, and accessory bills audited and verified. File cleared for showroom security release.
              </p>
              {deliveryRecord.financial_closure_notes && (
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                  Notes: {deliveryRecord.financial_closure_notes}
                </p>
              )}
            </div>
          ) : (prep?.accounts_completed_at || accountsRecord?.status === 'cleared') ? (
            <div>
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--ink)' }}>
                Accounts clearance is complete. Click below to confirm final financial settlement and release the vehicle file to the Security Desk for gate pass issuance.
              </p>
              {(isAccounts || isAdmin) && (
                <ActionForm action={recordFinancialClosure} label="Confirm Financial Closure & Release to Security">
                  <input type="hidden" name="booking" value={id} />
                  <input type="hidden" name="operation" value={randomUUID()} />
                  <input type="hidden" name="revision" value={b.revision} />
                  <label style={{ display: 'block', margin: '0 0 8px', fontSize: '12px' }}>
                    Reconciliation Notes (Optional)
                    <input
                      name="notes"
                      type="text"
                      placeholder="Vehicle invoice, accessories, road tax reconciled in full"
                      style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                    />
                  </label>
                </ActionForm>
              )}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Complete Accounts clearance (Invoicing, FASTag, and Road Tax) before recording final commercial closure.
            </p>
          )}
        </div>
      </section>
    )}

    {Boolean(prep?.accessories_dispatched_at || accessoriesRecord) && (
      <section className={styles.boSection} id="accessories">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Pre-Delivery Fitment & Requisition (SRC-X01 to SRC-X08, SRC-H10, SRC-H11)
            </span>
            <h2 style={{ margin: '4px 0 6px', fontSize: '20px' }}>Accessories Department — Fitment & Commercial Billing</h2>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
              Checklist verification, stock availability (partial vs full), commercial accessory billing, and mandatory margin sign-off.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={accessoriesRecord?.status === 'forwarded_bo' || accessoriesRecord?.status === 'completed' ? styles.badgePassed : accessoriesRecord?.margin_signed ? styles.badgePassed : styles.badgePending}>
              {accessoriesRecord?.status === 'forwarded_bo' || accessoriesRecord?.status === 'completed'
                ? 'Forwarded to Accounts'
                : accessoriesRecord?.status === 'submitted_so'
                ? 'Handed Over to BO'
                : accessoriesRecord?.margin_signed
                ? 'Margin Signed'
                : accessoriesRecord?.bill_number
                ? 'Margin Unsigned'
                : 'Fitment & Billing In Progress'}
            </span>
            {(!accessoriesRecord || !accessoriesRecord.bill_number) && (isAccessories || isBO || isAdmin) && (
              <ActionForm action={fillDemoAccessories} label="Demo: Pre-fill Accessories (Fitted & Billed)" secondary>
                <input type="hidden" name="booking" value={id} />
                <input type="hidden" name="revision" value={b.revision} />
              </ActionForm>
            )}
          </div>
        </div>

        {/* 1. Item Checklist & Stock Status (SRC-X01, SRC-X02, SRC-X03) */}
        <div style={{ padding: '16px 20px', background: '#f8fafc', border: '1px solid var(--line)', borderRadius: '8px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 650, margin: '0 0 2px' }}>1. Pre-Delivery Fitment & Stock Checklist (SRC-X01, SRC-X02, SRC-X03)</h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
                Verification of accessory requisitions, stock availability, and partial work execution.
              </p>
            </div>
            <span className={accessoriesRecord?.stock_status === 'full_stock' ? styles.badgePassed : accessoriesRecord?.stock_status === 'partial_stock' ? styles.badgePending : styles.badgeRework}>
              {accessoriesRecord?.stock_status === 'full_stock' ? 'Full Stock Fitted' : accessoriesRecord?.stock_status === 'partial_stock' ? 'Partial Stock (Work Executed)' : 'Stock Check Pending'}
            </span>
          </div>

          {Array.isArray(accessoriesRecord?.items) && (accessoriesRecord.items as unknown as AccessoryItem[]).length > 0 ? (
            <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: '6px', overflow: 'hidden', marginTop: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f1f3f5', textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                    <th style={{ padding: '8px 12px', fontWeight: 650 }}>Accessory Item</th>
                    <th style={{ padding: '8px 12px', fontWeight: 650 }}>Part Number</th>
                    <th style={{ padding: '8px 12px', fontWeight: 650 }}>Qty</th>
                    <th style={{ padding: '8px 12px', fontWeight: 650 }}>Fitment Status</th>
                    <th style={{ padding: '8px 12px', fontWeight: 650 }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {(accessoriesRecord.items as unknown as AccessoryItem[]).map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f3f5' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{item.part_no || '-'}</td>
                      <td style={{ padding: '8px 12px' }}>{item.qty || 1}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ color: item.fitted ? '#166534' : '#b06000', fontWeight: 600 }}>
                          {item.fitted ? 'Fitted' : 'Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{item.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ marginTop: '10px' }}>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                No accessories checklist recorded yet for this booking.
              </p>
            </div>
          )}

          {(isAccessories || isAdmin) && (
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
              <ActionForm action={recordAccessoriesWork} label="Save Accessories Checklist & Stock Status">
                <input type="hidden" name="booking" value={id} />
                <input type="hidden" name="operation" value={randomUUID()} />
                <input type="hidden" name="revision" value={b.revision} />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px', fontSize: '13px' }}>
                  <label>
                    Stock Availability Status
                    <select
                      name="stock_status"
                      defaultValue={accessoriesRecord?.stock_status || 'full_stock'}
                      style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                    >
                      <option value="full_stock">Full Stock (All accessories available & fitted)</option>
                      <option value="partial_stock">Partial Stock (Work carried out with available items)</option>
                    </select>
                  </label>
                  <label>
                    Checklist JSON Items (or customize default set)
                    <input
                      name="items_json"
                      defaultValue={accessoriesRecord?.items ? JSON.stringify(accessoriesRecord.items) : JSON.stringify([
                        { name: 'Toyota Genuine 7D Premium Floor Mats', part_no: 'PZ001-0K001', qty: 1, fitted: true, remarks: 'Fitted' },
                        { name: 'Mud Flaps Contoured Set (Front & Rear)', part_no: 'PZ002-0K002', qty: 1, fitted: true, remarks: 'Fitted' },
                        { name: 'Door Visor Set with Chrome Beading', part_no: 'PZ003-0K003', qty: 1, fitted: true, remarks: 'Fitted' },
                        { name: 'Dual-Tone Leatherette Seat Covers', part_no: 'PZ004-0K004', qty: 1, fitted: true, remarks: 'Fitted' }
                      ])}
                      style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)', fontFamily: 'monospace' }}
                    />
                  </label>
                </div>
              </ActionForm>
            </div>
          )}
        </div>

        {/* 2. Accessories Commercial Tax Invoice (SRC-X04, SRC-X05) */}
        <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 650 }}>
              2. Accessories Commercial Tax Invoice (SRC-X04, SRC-X05)
            </h3>
            {accessoriesRecord?.bill_number && (
              <span style={{ fontSize: '11px', fontWeight: 650, color: '#137333', background: '#e6f4ea', padding: '3px 8px', borderRadius: '4px' }}>
                Bill Recorded (#{accessoriesRecord.bill_number})
              </span>
            )}
          </div>

          {accessoriesRecord?.bill_number ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '13px', marginBottom: '12px' }}>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Invoice Number</span>
                  <strong style={{ fontFamily: 'monospace' }}>{accessoriesRecord.bill_number}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Invoice Date</span>
                  <span>{accessoriesRecord.bill_date}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Parts Amount</span>
                  <span>Rs. {Number(accessoriesRecord.parts_amount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Labour Amount</span>
                  <span>Rs. {Number(accessoriesRecord.labour_amount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Total Bill Amount</span>
                  <strong style={{ color: '#137333', fontSize: '15px' }}>Rs. {Number(accessoriesRecord.total_bill_amount || 0).toLocaleString('en-IN')}</strong>
                </div>
              </div>

              {accessoriesBillDoc && (
                <div style={{ marginTop: '8px' }}>
                  <DocumentPreviewModal
                    documentId={accessoriesBillDoc.id}
                    label="View Accessories Invoice PDF"
                    title={`Accessories Commercial Tax Invoice — ${accessoriesRecord.bill_number}`}
                    subtitle={`Total: Rs. ${Number(accessoriesRecord.total_bill_amount || 0).toLocaleString('en-IN')}`}
                  />
                </div>
              )}
            </div>
          ) : (isAccessories || isAdmin) ? (
            <ActionForm action={recordAccessoriesBill} label="Record Accessory Commercial Tax Invoice">
              <input type="hidden" name="booking" value={id} />
              <input type="hidden" name="operation" value={randomUUID()} />
              <input type="hidden" name="revision" value={b.revision} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '13px' }}>
                <label>
                  Accessory Bill Number
                  <input
                    name="bill_number"
                    type="text"
                    required
                    placeholder="e.g. ACC-INV-2026-10492"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
                <label>
                  Bill Date
                  <input
                    name="bill_date"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
                <label>
                  Parts Amount (Rs.)
                  <input
                    name="parts_amount"
                    type="number"
                    step="1"
                    defaultValue="42000"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
                <label>
                  Labour Amount (Rs.)
                  <input
                    name="labour_amount"
                    type="number"
                    step="1"
                    defaultValue="3500"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
                <label>
                  Total Bill Amount (Rs.)
                  <input
                    name="total_amount"
                    type="number"
                    step="1"
                    required
                    defaultValue="45500"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
                <label>
                  Department Cost (Rs.)
                  <input
                    name="cost_amount"
                    type="number"
                    step="1"
                    defaultValue="36000"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
              </div>

              <label style={{ display: 'block', margin: '12px 0 16px', fontSize: '13px', fontWeight: 550 }}>
                Attach Official Accessory Invoice Copy (PDF or JPEG)
                <input
                  name="bill_file"
                  type="file"
                  accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg"
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                />
              </label>
            </ActionForm>
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Awaiting Accessories team to issue and record the commercial accessory tax invoice.
            </p>
          )}
        </div>

        {/* 3. Profit / Loss Calculation & Margin Sign-off (SRC-X06) */}
        <div style={{
          background: accessoriesRecord?.margin_signed ? '#f0fdf4' : '#fafbfc',
          border: `1px solid ${accessoriesRecord?.margin_signed ? '#bbf7d0' : 'var(--line)'}`,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 650 }}>
              3. Profit / Loss Calculation & Margin Sign-off (SRC-X06)
            </h3>
            <span style={{
              fontSize: '11px',
              fontWeight: 650,
              color: accessoriesRecord?.margin_signed ? '#137333' : '#b06000',
              background: accessoriesRecord?.margin_signed ? '#e6f4ea' : '#fef7e0',
              padding: '3px 8px',
              borderRadius: '4px'
            }}>
              {accessoriesRecord?.margin_signed ? 'Margin Signed' : 'Margin Signature Required'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', fontSize: '13px', margin: '12px 0' }}>
            <div>
              <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Cost to Dealer</span>
              <span>Rs. {Number(accessoriesRecord?.cost_amount || 0).toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Billed Amount</span>
              <span>Rs. {Number(accessoriesRecord?.total_bill_amount || 0).toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Gross Profit</span>
              <strong style={{ color: '#137333' }}>Rs. {Number(accessoriesRecord?.profit_loss_amount || 0).toLocaleString('en-IN')}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Profit Margin</span>
              <strong style={{ color: '#137333' }}>{accessoriesRecord?.margin_percentage || 0}%</strong>
            </div>
          </div>

          {accessoriesRecord?.margin_signed ? (
            <p style={{ margin: 0, fontSize: '13px', color: '#166534' }}>
              Margin details confirmed and ink/digital sign-off recorded. Requirement satisfied prior to vehicle delivery.
            </p>
          ) : (accessoriesRecord?.bill_number && (isAccessories || isSM || isAdmin)) ? (
            <div style={{ marginTop: '10px' }}>
              <p style={{ fontSize: '13px', color: 'var(--ink)', margin: '0 0 10px' }}>
                Review the calculated gross profit and profit margin percentage above. Click below to sign off on the margin prior to delivery.
              </p>
              <ActionForm action={signAccessoriesMargin} label="Sign Off Accessory Profit Margin">
                <input type="hidden" name="booking" value={id} />
                <input type="hidden" name="operation" value={randomUUID()} />
                <input type="hidden" name="revision" value={b.revision} />
              </ActionForm>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Commercial bill must be recorded before margin sign-off can take place.
            </p>
          )}
        </div>

        {/* 4. Multi-stage Handoff & Inter-departmental Tracking (SRC-X07, SRC-X08, SRC-H10, SRC-H11) */}
        <div style={{ background: '#f8fafc', border: '1px solid var(--line)', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 650 }}>
            4. Departmental Movement: SO → Back Office → Accounts (SRC-X07, SRC-X08, SRC-H10, SRC-H11)
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 14px' }}>
            Physical accessory bill collection and file transit between Sales Officer, Back Office, and Accounts for final reconciliation.
          </p>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Step 1: SO Collection */}
            {accessoriesRecord?.margin_signed && accessoriesRecord?.status === 'billed' && (isSO || isAdmin) && (
              <ActionForm action={submitAccessoriesToBO} label="SO: Collect Accessory Bill & Submit to BO">
                <input type="hidden" name="booking" value={id} />
                <input type="hidden" name="operation" value={randomUUID()} />
                <input type="hidden" name="revision" value={b.revision} />
              </ActionForm>
            )}

            {/* Step 2: BO Forward to Accounts */}
            {accessoriesRecord?.status === 'submitted_so' && (isBO || isAdmin) && (
              <ActionForm action={forwardAccessoriesToAccounts} label="BO: Forward Accessory Bills to Accounts">
                <input type="hidden" name="booking" value={id} />
                <input type="hidden" name="operation" value={randomUUID()} />
                <input type="hidden" name="revision" value={b.revision} />
              </ActionForm>
            )}

            {/* Step 3: Forwarded state */}
            {(accessoriesRecord?.status === 'forwarded_bo' || accessoriesRecord?.status === 'completed') && (
              <div style={{ fontSize: '13px', color: '#166534', fontWeight: 600 }}>
                Accessory bills forwarded to Accounts. Handover completed for final financial review & delivery clearance.
              </div>
            )}

            {/* Waiting message if earlier steps incomplete */}
            {!accessoriesRecord?.margin_signed && (
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Awaiting accessory fitment, commercial billing, and margin sign-off before SO handover.
              </div>
            )}
          </div>
        </div>
      </section>
    )}

    {Boolean(deliveryRecord?.financial_closure_at || deliveryRecord) && (
      <section className={styles.boSection} id="delivery">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Final Fulfilment & Custody (SRC-X10, SRC-T07, SRC-A07, R-15)
            </span>
            <h2 style={{ margin: '4px 0 6px', fontSize: '20px' }}>Security Gate Pass, Vehicle Delivery & Final Archive</h2>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
              Showroom gate pass issuance, physical delivery handover to customer, folder return from Security to Accounts, and permanent archive storage.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={deliveryRecord?.status === 'archived' ? styles.badgePassed : deliveryRecord?.status === 'delivered' ? styles.badgePassed : styles.badgePending}>
              {deliveryRecord?.status === 'archived'
                ? 'Completed & Archived'
                : deliveryRecord?.status === 'file_returned'
                ? 'File Returned to Accounts'
                : deliveryRecord?.status === 'delivered'
                ? 'Vehicle Delivered'
                : deliveryRecord?.status === 'gate_pass_issued'
                ? 'Gate Pass Issued'
                : 'Ready for Gate Pass'}
            </span>
            {(!deliveryRecord || deliveryRecord.status !== 'archived') && (isSecurity || isAccounts || isBO || isAdmin) && (
              <ActionForm action={fillDemoDeliveryAndArchive} label="Demo: Complete Delivery & Archive" secondary>
                <input type="hidden" name="booking" value={id} />
                <input type="hidden" name="revision" value={b.revision} />
              </ActionForm>
            )}
          </div>
        </div>

        {/* 1. Showroom Security Gate Pass (SRC-X10, SRC-T07) */}
        <div style={{ padding: '16px 20px', background: '#f8fafc', border: '1px solid var(--line)', borderRadius: '8px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 650, margin: '0 0 2px' }}>1. Showroom Security Gate Pass (SRC-X10, SRC-T07)</h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
                Verification of financial clearance, vehicle chassis, and gate exit authorization.
              </p>
            </div>
            <span className={deliveryRecord?.gate_pass_no ? styles.badgePassed : styles.badgePending}>
              {deliveryRecord?.gate_pass_no ? 'Gate Pass Issued' : 'Awaiting Gate Pass'}
            </span>
          </div>

          {deliveryRecord?.gate_pass_no ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', background: 'white', padding: '14px 16px', border: '1px solid var(--line)', borderRadius: '6px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Gate Pass Number</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#166534', marginTop: '2px', fontFamily: 'monospace' }}>
                    {deliveryRecord.gate_pass_no}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Issued At</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
                    {deliveryRecord.gate_pass_issued_at ? new Date(deliveryRecord.gate_pass_issued_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Security Officer</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>
                    {deliveryRecord.security_officer_name || 'Main Gate Security Officer'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Odometer at Gate</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', marginTop: '2px' }}>
                    {deliveryRecord.odometer_reading || 15} km
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Link
                  href={`/bookings/${b.id}/print-gate-pass`}
                  target="_blank"
                  className={styles.secondaryButton}
                  style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                >
                  Print Official Gate Pass (with QR)
                </Link>
                {gatePassDoc && (
                  <DocumentPreviewModal
                    documentId={gatePassDoc.id}
                    label="View Scanned Gate Pass PDF"
                    title={`Security Gate Pass — ${deliveryRecord.gate_pass_no}`}
                    subtitle={`Customer: ${data.registration_name || data.customer_name || 'Customer'}`}
                  />
                )}
              </div>
            </div>
          ) : (isSecurity || isAdmin) ? (
            <ActionForm action={issueGatePass} label="Issue Official Security Gate Pass">
              <input type="hidden" name="booking" value={id} />
              <input type="hidden" name="operation" value={randomUUID()} />
              <input type="hidden" name="revision" value={b.revision} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
                <label>
                  Gate Pass Number
                  <input
                    name="gate_pass_no"
                    type="text"
                    required
                    placeholder="e.g. GP-NT-2026-1049"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
                <label>
                  Security Officer Name
                  <input
                    name="officer_name"
                    type="text"
                    required
                    defaultValue="Babu K. (Gate Security Supervisor)"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
                <label>
                  Odometer Exit Reading (km)
                  <input
                    name="odometer"
                    type="number"
                    step="1"
                    defaultValue="18"
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
              </div>

              <label style={{ display: 'block', margin: '12px 0 16px', fontSize: '13px', fontWeight: 550 }}>
                Attach Signed Physical Gate Pass Copy (Optional PDF or JPEG)
                <input
                  name="gate_pass_file"
                  type="file"
                  accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg"
                  style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                />
              </label>
            </ActionForm>
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Awaiting Security Counter Officer to inspect vehicle and issue gate pass.
            </p>
          )}
        </div>

        {/* 2. Customer Vehicle Delivery Handover (R-15, Q-10 - distinct fact from gate pass) */}
        <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 650 }}>
                2. Customer Vehicle Delivery Handover (R-15, Q-10)
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
                Physical handover of vehicle keys, owner manual, FASTag kit, and customer sign-off.
              </p>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 650,
              color: deliveryRecord?.delivered_at ? '#137333' : '#b06000',
              background: deliveryRecord?.delivered_at ? '#e6f4ea' : '#fef7e0',
              padding: '3px 8px',
              borderRadius: '4px'
            }}>
              {deliveryRecord?.delivered_at ? 'Vehicle Delivered' : 'Awaiting Customer Handover'}
            </span>
          </div>

          {deliveryRecord?.delivered_at ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', fontSize: '13px', marginBottom: '10px' }}>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Recipient Name</span>
                  <strong style={{ color: '#166534' }}>{deliveryRecord.recipient_name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Relationship</span>
                  <span>{deliveryRecord.recipient_relationship || 'Self'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Handover Status</span>
                  <span>{deliveryRecord.keys_handed_over ? 'Keys & Kit Handed Over' : 'Keys Pending'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Delivery Timestamp</span>
                  <span>{new Date(deliveryRecord.delivered_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
              </div>

              {deliveryRecord.delivery_notes && (
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--ink)' }}>
                  Delivery Notes: {deliveryRecord.delivery_notes}
                </p>
              )}

              {deliveryDoc && (
                <div style={{ marginTop: '10px' }}>
                  <DocumentPreviewModal
                    documentId={deliveryDoc.id}
                    label="View Delivery Acknowledgment Document"
                    title="Customer Delivery Acknowledgment Receipt"
                    subtitle={`Delivered to: ${deliveryRecord.recipient_name}`}
                  />
                </div>
              )}
            </div>
          ) : deliveryRecord?.gate_pass_no ? (
            (isSO || isBO || isSecurity || isAdmin) ? (
              <ActionForm action={recordVehicleDelivery} label="Record Customer Vehicle Delivery Handover">
                <input type="hidden" name="booking" value={id} />
                <input type="hidden" name="operation" value={randomUUID()} />
                <input type="hidden" name="revision" value={b.revision} />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
                  <label>
                    Recipient Name (Customer or Authorized Rep)
                    <input
                      name="recipient_name"
                      type="text"
                      required
                      defaultValue={data.registration_name || data.customer_name || 'Customer'}
                      style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                    />
                  </label>
                  <label>
                    Relationship
                    <select
                      name="relationship"
                      defaultValue="Self"
                      style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                    >
                      <option value="Self">Self (Registered Owner)</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Family Member">Family Member</option>
                      <option value="Authorized Representative">Authorized Representative</option>
                    </select>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px' }}>
                    <input type="checkbox" name="keys_handed_over" defaultChecked />
                    <span>Keys & Delivery Kit Handed Over</span>
                  </label>
                </div>

                <label style={{ display: 'block', margin: '12px 0', fontSize: '13px' }}>
                  Delivery Remarks / Handover Notes
                  <input
                    name="notes"
                    type="text"
                    defaultValue="Vehicle delivered in immaculate condition. Both keys, toolkit, owner manual, and FASTag verified."
                    style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                  />
                </label>
              </ActionForm>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
                Awaiting Sales Officer or Security to record actual customer vehicle handover.
              </p>
            )
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Gate pass must be issued prior to vehicle delivery release.
            </p>
          )}
        </div>

        {/* 3. Physical File Return to Accounts & Final Archive Storage (SRC-A07, SRC-T07, R-15) */}
        <div style={{
          background: deliveryRecord?.status === 'archived' ? '#f0fdf4' : '#fafbfc',
          border: `1px solid ${deliveryRecord?.status === 'archived' ? '#bbf7d0' : 'var(--line)'}`,
          borderRadius: '8px',
          padding: '16px'
        }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 650 }}>
            3. Physical File Return & Showroom Archive (SRC-A07, SRC-T07, R-15)
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 14px' }}>
            Physical folder return from Security to Accounts, verification of all paper originals, and permanent record room archiving.
          </p>

          {deliveryRecord?.status === 'archived' ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#166534' }}>
                  File Permanently Archived in Showroom Records
                </span>
                <span style={{ fontSize: '12px', background: '#dcfce7', color: '#14532d', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  Location: {deliveryRecord.archive_location}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#166534' }}>
                Physical folder audited and archived on {new Date(deliveryRecord.archived_at || '').toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}. All statutory originals, commercial invoices, and gate pass documents preserved in branch record room.
              </p>
              <div style={{ marginTop: '12px' }}>
                <Link
                  href={`/bookings/${b.id}/print-archive-label`}
                  target="_blank"
                  className={styles.secondaryButton}
                  style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                >
                  Print Dossier Jacket Label (with QR)
                </Link>
              </div>
            </div>
          ) : deliveryRecord?.security_file_returned_at ? (
            <div>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: '#166534', fontWeight: 600 }}>
                  Physical customer file returned by Security to Accounts on {new Date(deliveryRecord.security_file_returned_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.
                </span>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--ink)' }}>
                  Accounts officer must now audit all paper documents in the folder and record its permanent archive location.
                </p>
              </div>

              {(isAccounts || isAdmin) && (
                <ActionForm action={recordFinalArchive} label="Audit Originals & Archive Customer File">
                  <input type="hidden" name="booking" value={id} />
                  <input type="hidden" name="operation" value={randomUUID()} />
                  <input type="hidden" name="revision" value={b.revision} />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', fontSize: '13px', marginBottom: '12px' }}>
                    <label>
                      Physical Archive Location Reference
                      <input
                        name="location"
                        type="text"
                        required
                        defaultValue={`Rack B4 / Shelf 3 / Box 2026-NOV / File-${b.id.slice(0, 6)}`}
                        style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)' }}
                      />
                    </label>
                    <label>
                      Physical Originals Checklist JSON
                      <input
                        name="audit_json"
                        type="text"
                        defaultValue={JSON.stringify({
                          obf_original: true,
                          kyc_aadhaar_pan: true,
                          receipts_advance_balance: true,
                          insurance_policy_copy: true,
                          commercial_tax_invoice: true,
                          road_tax_challan: true,
                          accessories_bills: true,
                          form20_signed: true,
                          disclaimer_signed: true,
                          gate_pass_copy: true
                        })}
                        style={{ display: 'block', width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--line)', fontFamily: 'monospace' }}
                      />
                    </label>
                  </div>
                </ActionForm>
              )}
            </div>
          ) : deliveryRecord?.delivered_at ? (
            <div>
              <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--ink)' }}>
                Vehicle delivery is complete. Security must return the physical customer folder back to Accounts for final audit and storage.
              </p>
              {(isSecurity || isAdmin) && (
                <ActionForm action={returnFileToAccounts} label="Security: Return Physical File to Accounts">
                  <input type="hidden" name="booking" value={id} />
                  <input type="hidden" name="operation" value={randomUUID()} />
                  <input type="hidden" name="revision" value={b.revision} />
                </ActionForm>
              )}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Awaiting vehicle delivery and security exit before file is returned to Accounts for archive storage.
            </p>
          )}
        </div>
      </section>
    )}

    <section className={styles.history}><h2>Save history</h2><ol>{history.data.map(v=><li key={v.revision}><span>Version {v.revision} · {v.actor_name} · {v.document_ids.length} documents</span><small>{new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(v.recorded_at))}</small></li>)}</ol><p className={styles.note}>Showing the latest 20 saves. Earlier versions are retained.</p></section>
  </WorkspaceShell>;
}
