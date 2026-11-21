import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/modules/identity/session';
import { WorkspaceShell } from '@/components/workspace/shell';
import { Icon, type IconName } from '@/components/workspace/icon';
import { ActionForm } from '@/components/action-form';
import { verifyPayment } from '@/modules/cashier/actions';
import { bookingData } from '@/modules/bookings/fields';
import { DocumentPreviewModal } from '@/components/document-preview-modal';
import styles from './cashier.module.css';

const methods = [
  { key: 'card', label: 'Card', icon: 'card' as IconName, sub: 'POS Debit & Credit' },
  { key: 'upi', label: 'UPI', icon: 'upi' as IconName, sub: 'QR, PhonePe, GPay, UTR' },
  { key: 'cheque', label: 'Cheque', icon: 'cheque' as IconName, sub: 'Bank Instruments & DD' },
  { key: 'cash', label: 'Cash', icon: 'cash' as IconName, sub: 'Counter Physical Currency' },
] as const;

export default async function CashierPage({ searchParams }: { searchParams: Promise<{ method?: string }> }) {
  const session = await requireStaff();
  const cashierMembership = session.memberships.find(m => m.role === 'Cashier');
  if (!cashierMembership) redirect('/workspace');

  const branchId = cashierMembership.branch_id;
  const branchName = cashierMembership.branches?.name || 'Showroom';
  const params = await searchParams;
  const rawMethod = params.method || '';
  const activeMethod = ['card', 'upi', 'cheque', 'cash', 'all'].includes(rawMethod) ? rawMethod : null;
  const isDetail = Boolean(activeMethod);
  const activeMethodObj = methods.find(m => m.key === activeMethod);

  const { data: payments, error } = await session.client
    .from('booking_payments')
    .select('id,booking_id,amount,payment_method,payment_type,reference_no,proof_document_id,status,receipt_no,verified_at,created_at,bookings(customer_id,data),booking_documents(id,filename,status)')
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false });

  if (error) throw new Error('Cashier payments queue unavailable');

  const allPayments = payments || [];

  // Compute metrics per payment method
  const stats = Object.fromEntries(methods.map(m => {
    const list = allPayments.filter(p => p.payment_method === m.key);
    const pending = list.filter(p => p.status === 'pending_verification');
    const total = list.reduce((sum, p) => sum + Number(p.amount), 0);
    return [m.key, { total, count: list.length, pendingCount: pending.length }];
  }));

  const filtered = activeMethod && activeMethod !== 'all'
    ? allPayments.filter(p => p.payment_method === activeMethod)
    : allPayments;
  const totalPending = allPayments.filter(p => p.status === 'pending_verification').length;

  return (
    <WorkspaceShell {...session} page="cashier">
      <div className={styles.container}>
        {!isDetail ? (
          <>
            <div className={styles.header}>
              <div>
                <span className={styles.eyebrow}>Financial Collections / Cash Counter</span>
                <h1>Cashier</h1>
                <p>{branchName} · {totalPending} payment{totalPending === 1 ? '' : 's'} awaiting receipt confirmation</p>
              </div>
            </div>

            {/* 2x2 Category Grid matching wireframe drawing */}
            <div className={styles.grid}>
              {methods.map(m => {
                const data = stats[m.key] || { total: 0, count: 0, pendingCount: 0 };
                return (
                  <Link
                    key={m.key}
                    href={`/cashier?method=${m.key}`}
                    className={`${styles.card} ${styles[`card_${m.key}`]}`}
                    aria-label={`${m.label}: ${data.pendingCount} pending verification`}
                  >
                    <div className={styles.cardTop}>
                      <span className={styles.iconWrap}>
                        <Icon name={m.icon} />
                      </span>
                      <div className={styles.badgeWrap}>
                        {data.pendingCount > 0 ? (
                          <span className={styles.countBadge}>
                            <span className={styles.ball} />
                            {data.pendingCount} pending
                          </span>
                        ) : (
                          <span className={styles.countBadgeClear}>0 pending</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h2 className={styles.cardTitle}>{m.label}</h2>
                      <p className={styles.cardAmount}>₹{data.total.toLocaleString('en-IN')}</p>
                      <p className={styles.cardSub}>{data.count} payment{data.count === 1 ? '' : 's'} · {m.sub}</p>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <Link href="/cashier?method=all" className={styles.viewAllBtn}>
                View all showroom collections ({allPayments.length}) →
              </Link>
            </div>
          </>
        ) : (
          <>
            <Link href="/cashier" className={styles.backLink}>
              ← Back to Cashier Categories
            </Link>

            <div className={styles.header}>
              <div>
                <span className={styles.eyebrow}>
                  {activeMethodObj ? `${activeMethodObj.label} Payments` : 'All Collections'}
                </span>
                <h1>{activeMethodObj ? `${activeMethodObj.label} Transactions` : 'All Showroom Collections'}</h1>
                <p>
                  {filtered.length} collection{filtered.length === 1 ? '' : 's'} ·{' '}
                  {filtered.filter(p => p.status === 'pending_verification').length} awaiting receipt confirmation
                </p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className={styles.filterBar}>
              <Link href="/cashier" className={styles.filterPill}>
                ← Categories
              </Link>
              {methods.map(m => (
                <Link
                  key={m.key}
                  href={`/cashier?method=${m.key}`}
                  className={`${styles.filterPill} ${activeMethod === m.key ? styles.filterPillActive : ''}`}
                >
                  {m.label} ({stats[m.key]?.count || 0})
                </Link>
              ))}
              <Link
                href="/cashier?method=all"
                className={`${styles.filterPill} ${activeMethod === 'all' ? styles.filterPillActive : ''}`}
              >
                All ({allPayments.length})
              </Link>
            </div>

            {/* Transactions Table ONLY */}
            <div className={styles.list}>
              <div className={styles.tableHeader} aria-hidden="true">
                <span>Customer & Booking</span>
                <span>Payment Mode</span>
                <span>Reference & Date</span>
                <span>Amount</span>
                <span>Verification / Receipt</span>
              </div>

              {!filtered.length && (
                <div className={styles.empty}>
                  <Icon name="receipt" />
                  <h3>No collections found</h3>
                  <p>No transactions recorded under this payment category.</p>
                </div>
              )}

              {filtered.map(pay => {
                const bData = bookingData(pay.bookings?.data);
                const isVerified = pay.status === 'verified';
                const hasProof = Boolean(pay.proof_document_id);

                return (
                  <div key={pay.id} className={styles.row}>
                    <div className={styles.customerCell}>
                      <strong>{bData.customer_name || 'Customer Name'}</strong>
                      <small>ID: {pay.bookings?.customer_id || 'Not entered'} · Booking: {bData.booking_number || 'Pending'}</small>
                      <small>{bData.model || 'Toyota Vehicle'}</small>
                    </div>

                    <div>
                      <span className={styles.methodBadge}>{pay.payment_method}</span>
                      <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: pay.payment_type === 'balance_payment' ? '#eff6ff' : '#f1f5f9', color: pay.payment_type === 'balance_payment' ? '#1d4ed8' : '#475569' }}>
                        {pay.payment_type === 'balance_payment' ? 'Balance' : 'Advance'}
                      </span>
                    </div>

                    <div>
                      <div style={{ fontWeight: 600 }}>{pay.reference_no}</div>
                      <small style={{ color: 'var(--muted)', fontSize: '12px' }}>
                        {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(pay.created_at))}
                      </small>
                    </div>

                    <div className={styles.amountCell}>
                      ₹{Number(pay.amount).toLocaleString('en-IN')}
                    </div>

                    <div className={styles.actionCell}>
                      {isVerified ? (
                        <div>
                          <span className={styles.statusVerified}>Receipt Issued</span>
                          <div style={{ marginTop: '4px', fontSize: '13px', fontWeight: 600 }}>Receipt #{pay.receipt_no}</div>
                          {hasProof && (
                            <div style={{ marginTop: '4px' }}>
                              <DocumentPreviewModal
                                documentId={pay.proof_document_id!}
                                label="Preview verified slip"
                                title={`Verified Payment Slip · ${bData.customer_name || 'Customer'}`}
                                subtitle={`Receipt #${pay.receipt_no} · ${pay.payment_method?.toUpperCase()} · ₹${Number(pay.amount).toLocaleString('en-IN')}`}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          {hasProof ? (
                            <>
                              <div style={{ marginBottom: '6px' }}>
                                <span className={styles.proofAttachedBadge}>
                                  <Icon name="check" /> Slip Attached
                                </span>
                              </div>
                              <div style={{ marginBottom: '8px' }}>
                                <DocumentPreviewModal
                                  documentId={pay.proof_document_id!}
                                  label="Preview customer payment slip"
                                  title={`Payment Slip · ${bData.customer_name || 'Customer'}`}
                                  subtitle={`${pay.payment_method?.toUpperCase()} · ₹${Number(pay.amount).toLocaleString('en-IN')} · Ref: ${pay.reference_no}`}
                                />
                              </div>

                              <ActionForm action={verifyPayment} label="Confirm & Issue Receipt">
                                <input type="hidden" name="operation" value={randomUUID()} />
                                <input type="hidden" name="payment_id" value={pay.id} />
                                <input
                                  name="receipt_no"
                                  required
                                  placeholder="Receipt No (e.g. RCP-00821)"
                                  className={styles.receiptInput}
                                  maxLength={50}
                                />
                              </ActionForm>
                            </>
                          ) : (
                            <>
                              <div style={{ marginBottom: '6px' }}>
                                <span className={styles.proofMissingBadge}>
                                  <Icon name="alert" /> Proof Missing
                                </span>
                              </div>
                              <p className={styles.instructionText}>
                                Proof required before approval. Attach counter slip:
                              </p>

                              <ActionForm action={verifyPayment} label="Attach Proof & Confirm">
                                <input type="hidden" name="operation" value={randomUUID()} />
                                <input type="hidden" name="payment_id" value={pay.id} />
                                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>
                                  Counter Slip (PDF or JPEG)
                                  <input
                                    type="file"
                                    name="proof_file"
                                    required
                                    accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg"
                                    className={styles.fileInput}
                                  />
                                </label>
                                <input
                                  name="receipt_no"
                                  required
                                  placeholder="Receipt No (e.g. RCP-00821)"
                                  className={styles.receiptInput}
                                  maxLength={50}
                                />
                              </ActionForm>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}
