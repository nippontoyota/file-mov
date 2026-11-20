import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/modules/identity/session';
import { WorkspaceShell } from '@/components/workspace/shell';
import { Icon, type IconName } from '@/components/workspace/icon';
import { ActionForm } from '@/components/action-form';
import { verifyPayment } from '@/modules/cashier/actions';
import { bookingData } from '@/modules/bookings/fields';
import styles from './cashier.module.css';

const methods = [
  { key: 'card', label: 'Card Payment', icon: 'card' as IconName, sub: 'POS Debit & Credit Card Slips' },
  { key: 'upi', label: 'UPI Transfer', icon: 'upi' as IconName, sub: 'QR, PhonePe, GPay, Paytm UTR' },
  { key: 'cheque', label: 'Cheque & DD', icon: 'cheque' as IconName, sub: 'Bank Clearing Instruments' },
  { key: 'cash', label: 'Cash Counter', icon: 'cash' as IconName, sub: 'Physical Counter Currency' },
] as const;

export default async function CashierPage({ searchParams }: { searchParams: Promise<{ method?: string }> }) {
  const session = await requireStaff();
  const cashierMembership = session.memberships.find(m => m.role === 'Cashier');
  if (!cashierMembership) redirect('/workspace');

  const branchId = cashierMembership.branch_id;
  const branchName = cashierMembership.branches?.name || 'Showroom';
  const params = await searchParams;
  const activeMethod = ['card', 'upi', 'cheque', 'cash'].includes(params.method || '') ? params.method : null;

  const { data: payments, error } = await session.client
    .from('booking_payments')
    .select('id,booking_id,amount,payment_method,reference_no,proof_document_id,status,receipt_no,verified_at,created_at,bookings(customer_id,data),booking_documents(id,filename,status)')
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

  const filtered = activeMethod ? allPayments.filter(p => p.payment_method === activeMethod) : allPayments;
  const totalPending = allPayments.filter(p => p.status === 'pending_verification').length;

  return (
    <WorkspaceShell {...session} page="cashier">
      <div className={styles.container}>
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
            const isActive = activeMethod === m.key;
            return (
              <Link
                key={m.key}
                href={isActive ? '/cashier' : `/cashier?method=${m.key}`}
                className={`${styles.card} ${styles[`card_${m.key}`]} ${isActive ? styles.cardActive : ''}`}
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
                        {data.pendingCount} Pending
                      </span>
                    ) : (
                      <span className={styles.countBadgeClear}>Verified</span>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className={styles.cardTitle}>{m.label}</h2>
                  <p className={styles.cardAmount}>₹{data.total.toLocaleString('en-IN')}</p>
                  <p className={styles.cardSub}>{m.sub}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <span style={{ fontSize: '13px', fontWeight: 650, color: 'var(--muted)' }}>Filter queue:</span>
          <Link href="/cashier" className={`${styles.filterPill} ${!activeMethod ? styles.filterPillActive : ''}`}>
            All Collections ({allPayments.length})
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
        </div>

        {/* Transactions Table */}
        <h3 className={styles.sectionTitle}>
          {activeMethod ? `${methods.find(m => m.key === activeMethod)?.label} Transactions` : 'All Showroom Booking Collections'}
        </h3>

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
              <p>When Sales Officers record booking advances, they will appear here for verification.</p>
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
                          <a href={`/api/booking-documents/${pay.proof_document_id}`} target="_blank" rel="noreferrer" className={styles.proofLink}>
                            View verified document
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div style={{ marginBottom: '8px' }}>
                        {hasProof ? (
                          <a href={`/api/booking-documents/${pay.proof_document_id}`} target="_blank" rel="noreferrer" className={styles.proofLink}>
                            View customer payment slip
                          </a>
                        ) : (
                          <span className={styles.proofMissing}>Physical proof required</span>
                        )}
                      </div>

                      <ActionForm action={verifyPayment} label={hasProof ? 'Confirm & Issue Receipt' : 'Attach Proof & Confirm'}>
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
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </WorkspaceShell>
  );
}
