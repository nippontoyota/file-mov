import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/modules/identity/session';
import { WorkspaceShell } from '@/components/workspace/shell';
import { Icon } from '@/components/workspace/icon';
import { bookingData } from '@/modules/bookings/fields';
import styles from './security.module.css';

interface SearchParams {
  tab?: string;
  q?: string;
}

export default async function SecurityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireStaff();
  const securityMembership = session.memberships.find(m =>
    ['Security', 'BO', 'Accounts', 'Cashier', 'SM', 'Admin'].includes(m.role)
  );
  if (!securityMembership) redirect('/workspace');

  const branchId = securityMembership.branch_id;
  const branchName = securityMembership.branches?.name || 'Showroom';
  const params = await searchParams;
  const activeTab = params.tab || 'all';
  const queryText = (params.q || '').trim().toLowerCase();

  const { data: bookingsData, error } = await session.client
    .from('bookings')
    .select(`
      id,
      customer_id,
      state,
      revision,
      updated_at,
      so_name,
      data,
      bo_preparations (
        rto_registration_no,
        rto_location,
        hsrp_status
      ),
      sales_submissions (
        allocation_ref,
        allocated_at
      ),
      delivery_records (
        id,
        financial_closure_at,
        financial_closure_notes,
        gate_pass_no,
        gate_pass_issued_at,
        security_officer_name,
        odometer_reading,
        delivered_at,
        recipient_name,
        keys_handed_over,
        security_file_returned_at,
        archived_at,
        archive_location,
        status,
        updated_at
      )
    `)
    .eq('branch_id', branchId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error('Security queue unavailable');

  const allCleared = (bookingsData || []).map(b => {
    const prep = Array.isArray(b.bo_preparations) ? b.bo_preparations[0] : b.bo_preparations;
    const sub = Array.isArray(b.sales_submissions) ? b.sales_submissions[0] : b.sales_submissions;
    const del = Array.isArray(b.delivery_records) ? b.delivery_records[0] : b.delivery_records;
    const data = bookingData(b.data);
    return {
      ...b,
      prep,
      sub,
      del,
      data,
    };
  }).filter(b => Boolean(b.del?.financial_closure_at));

  // Compute metrics
  const totalFiles = allCleared.length;
  const pendingPassCount = allCleared.filter(b => !b.del?.gate_pass_no).length;
  const awaitingDeliveryCount = allCleared.filter(b => Boolean(b.del?.gate_pass_no) && !b.del?.delivered_at).length;
  const awaitingReturnCount = allCleared.filter(b => Boolean(b.del?.delivered_at) && !b.del?.security_file_returned_at).length;
  const archivedCount = allCleared.filter(b => Boolean(b.del?.archived_at)).length;

  // Filter based on active tab
  let filtered = allCleared;
  if (activeTab === 'pending_pass') {
    filtered = filtered.filter(b => !b.del?.gate_pass_no);
  } else if (activeTab === 'awaiting_delivery') {
    filtered = filtered.filter(b => Boolean(b.del?.gate_pass_no) && !b.del?.delivered_at);
  } else if (activeTab === 'awaiting_return') {
    filtered = filtered.filter(b => Boolean(b.del?.delivered_at) && !b.del?.security_file_returned_at);
  } else if (activeTab === 'archived') {
    filtered = filtered.filter(b => Boolean(b.del?.archived_at));
  }

  // Text search
  if (queryText) {
    filtered = filtered.filter(b =>
      b.data.booking_number?.toLowerCase().includes(queryText) ||
      b.data.customer_name?.toLowerCase().includes(queryText) ||
      b.data.model?.toLowerCase().includes(queryText) ||
      b.del?.gate_pass_no?.toLowerCase().includes(queryText) ||
      b.prep?.rto_registration_no?.toLowerCase().includes(queryText)
    );
  }

  return (
    <WorkspaceShell profile={session.profile} memberships={session.memberships} page="security">
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Showroom Gate Operations</span>
            <h1>Security Desk</h1>
            <p>
              Showroom gate pass issuance, exit odometer verification, customer delivery verification, and file return for {branchName}.
            </p>
          </div>
        </div>

        {/* Metric summary cards */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Total Cleared</span>
            <span className={styles.metricValue}>{totalFiles}</span>
            <span className={styles.metricSub}>Financially closed</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Gate Pass Pending</span>
            <span className={styles.metricValue}>{pendingPassCount}</span>
            <span className={styles.metricSub}>Awaiting gate pass</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Awaiting Handover</span>
            <span className={styles.metricValue}>{awaitingDeliveryCount}</span>
            <span className={styles.metricSub}>Pass issued, key pending</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Awaiting File Return</span>
            <span className={styles.metricValue}>{awaitingReturnCount}</span>
            <span className={styles.metricSub}>Return folder to Accounts</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Fully Archived</span>
            <span className={styles.metricValue}>{archivedCount}</span>
            <span className={styles.metricSub}>In records room</span>
          </div>
        </div>

        {/* Filter bar */}
        <div className={styles.filterBar}>
          <div className={styles.tabs}>
            <Link
              href="/security?tab=all"
              className={`${styles.tabItem} ${activeTab === 'all' ? styles.tabItemActive : ''}`}
            >
              All Files ({totalFiles})
            </Link>
            <Link
              href="/security?tab=pending_pass"
              className={`${styles.tabItem} ${activeTab === 'pending_pass' ? styles.tabItemActive : ''}`}
            >
              Pass Pending ({pendingPassCount})
            </Link>
            <Link
              href="/security?tab=awaiting_delivery"
              className={`${styles.tabItem} ${activeTab === 'awaiting_delivery' ? styles.tabItemActive : ''}`}
            >
              Awaiting Handover ({awaitingDeliveryCount})
            </Link>
            <Link
              href="/security?tab=awaiting_return"
              className={`${styles.tabItem} ${activeTab === 'awaiting_return' ? styles.tabItemActive : ''}`}
            >
              Return Folder ({awaitingReturnCount})
            </Link>
            <Link
              href="/security?tab=archived"
              className={`${styles.tabItem} ${activeTab === 'archived' ? styles.tabItemActive : ''}`}
            >
              Archived ({archivedCount})
            </Link>
          </div>

          <form method="GET" action="/security" className={styles.searchBox}>
            <input type="hidden" name="tab" value={activeTab} />
            <input
              type="text"
              name="q"
              defaultValue={queryText}
              placeholder="Search order, customer, gate pass..."
              className={styles.searchInput}
            />
          </form>
        </div>

        {/* Files queue */}
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No booking files match this filter at the Security Desk.</p>
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map(b => {
              const hasPass = Boolean(b.del?.gate_pass_no);
              const isDelivered = Boolean(b.del?.delivered_at);
              const isReturned = Boolean(b.del?.security_file_returned_at);
              const isArchived = Boolean(b.del?.archived_at);

              return (
                <div key={b.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div className={styles.bookingInfo}>
                      <Link href={`/bookings/${b.id}`} className={styles.orderNumber}>
                        {b.data.booking_number || 'Booking File'}
                      </Link>
                      <span className={styles.customerMeta}>
                        Customer: {b.data.customer_name || 'Customer'} (ID: {b.customer_id}) | SO: {b.so_name || 'Sales Officer'}
                      </span>
                      <span className={styles.vehicleSpec}>
                        {b.data.model || 'Model'} {b.data.suffix_1 || ''} - {b.data.colour_1 || 'Colour'}
                        {b.sub?.allocation_ref ? ` (VIN: ${b.sub.allocation_ref})` : ''}
                      </span>
                    </div>

                    <div className={styles.statusBadges}>
                      {hasPass ? (
                        <span className={`${styles.badge} ${styles.badgeSuccess}`}>Gate Pass Issued</span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeWarning}`}>Pass Pending</span>
                      )}

                      {isDelivered ? (
                        <span className={`${styles.badge} ${styles.badgeSuccess}`}>Delivered</span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeNeutral}`}>Awaiting Handover</span>
                      )}

                      {isReturned ? (
                        <span className={`${styles.badge} ${styles.badgeSuccess}`}>File Returned</span>
                      ) : isDelivered ? (
                        <span className={`${styles.badge} ${styles.badgeWarning}`}>File with Security</span>
                      ) : null}

                      {isArchived && (
                        <span className={`${styles.badge} ${styles.badgeSuccess}`}>Archived</span>
                      )}
                    </div>
                  </div>

                  <div className={styles.cardGrid}>
                    <div className={styles.gridItem}>
                      <span className={styles.gridLabel}>Vehicle Plates</span>
                      <span className={styles.gridValue}>
                        {b.prep?.rto_registration_no ? b.prep.rto_registration_no : 'Pending Registration'}
                      </span>
                    </div>

                    <div className={styles.gridItem}>
                      <span className={styles.gridLabel}>Gate Pass Number</span>
                      <span className={styles.gridValue}>
                        {b.del?.gate_pass_no ? `${b.del.gate_pass_no} (Odo: ${b.del.odometer_reading || 15} km)` : 'Not issued yet'}
                      </span>
                    </div>

                    <div className={styles.gridItem}>
                      <span className={styles.gridLabel}>Customer Delivery</span>
                      <span className={styles.gridValue}>
                        {b.del?.delivered_at ? `${b.del.recipient_name || 'Customer'} (Keys Given)` : 'Awaiting handover'}
                      </span>
                    </div>

                    <div className={styles.gridItem}>
                      <span className={styles.gridLabel}>Physical File Transit</span>
                      <span className={styles.gridValue}>
                        {isArchived
                          ? `Archived (${b.del?.archive_location || 'Storage'})`
                          : isReturned
                          ? 'Returned to Accounts'
                          : isDelivered
                          ? 'At Security Counter'
                          : 'Cleared for Release'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    <span className={styles.timestamp}>
                      Financial clearance: {b.del?.financial_closure_at ? new Date(b.del.financial_closure_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Pending'}
                    </span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {hasPass && (
                        <Link
                          href={`/bookings/${b.id}/print-gate-pass`}
                          target="_blank"
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#1e293b',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            padding: '6px 10px',
                            textDecoration: 'none',
                          }}
                        >
                          Print Pass (QR)
                        </Link>
                      )}
                      <Link href={`/bookings/${b.id}`} className={styles.actionButton}>
                        Open File <Icon name="arrow" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
