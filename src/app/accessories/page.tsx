import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/modules/identity/session';
import { WorkspaceShell } from '@/components/workspace/shell';
import { Icon } from '@/components/workspace/icon';
import { bookingData } from '@/modules/bookings/fields';
import styles from './accessories.module.css';

interface SearchParams {
  tab?: string;
  q?: string;
}

export default async function AccessoriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireStaff();
  const accessoriesMembership = session.memberships.find(m =>
    ['Accessories', 'BO', 'SO', 'TL', 'SM', 'Accounts', 'Cashier', 'Admin'].includes(m.role)
  );
  if (!accessoriesMembership) redirect('/workspace');

  const branchId = accessoriesMembership.branch_id;
  const branchName = accessoriesMembership.branches?.name || 'Showroom';
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
        accessories_dispatched_at,
        accessories_completed_at
      ),
      sales_submissions (
        allocation_ref,
        allocated_at
      ),
      accessories_records (
        id,
        items,
        stock_status,
        bill_number,
        bill_date,
        parts_amount,
        labour_amount,
        total_bill_amount,
        cost_amount,
        profit_loss_amount,
        margin_percentage,
        margin_signed,
        payment_status,
        status,
        so_collected_at,
        bo_forwarded_at,
        updated_at
      )
    `)
    .eq('branch_id', branchId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error('Accessories queue unavailable');

  const allDispatched = (bookingsData || []).map(b => {
    const prep = Array.isArray(b.bo_preparations) ? b.bo_preparations[0] : b.bo_preparations;
    const sub = Array.isArray(b.sales_submissions) ? b.sales_submissions[0] : b.sales_submissions;
    const acc = Array.isArray(b.accessories_records) ? b.accessories_records[0] : b.accessories_records;
    const data = bookingData(b.data);
    return {
      ...b,
      prep,
      sub,
      acc,
      data,
    };
  }).filter(b => Boolean(b.prep?.accessories_dispatched_at || b.acc));

  // Compute metrics
  const totalFiles = allDispatched.length;
  const fittingPendingCount = allDispatched.filter(b => !b.acc || b.acc.stock_status === 'pending' || b.acc.stock_status === 'partial_stock').length;
  const billPendingCount = allDispatched.filter(b => !b.acc?.bill_number).length;
  const marginPendingCount = allDispatched.filter(b => Boolean(b.acc?.bill_number) && !b.acc?.margin_signed).length;
  const forwardedCount = allDispatched.filter(b => Boolean(b.acc?.bo_forwarded_at) || b.acc?.status === 'forwarded_bo' || b.acc?.status === 'completed').length;

  // Filter based on active tab
  let filtered = allDispatched;
  if (activeTab === 'fitting_pending') {
    filtered = filtered.filter(b => !b.acc || b.acc.stock_status === 'pending' || b.acc.stock_status === 'partial_stock');
  } else if (activeTab === 'unsigned_margin') {
    filtered = filtered.filter(b => Boolean(b.acc?.bill_number) && !b.acc?.margin_signed);
  } else if (activeTab === 'ready_so') {
    filtered = filtered.filter(b => Boolean(b.acc?.margin_signed) && !b.acc?.bo_forwarded_at);
  } else if (activeTab === 'forwarded') {
    filtered = filtered.filter(b => Boolean(b.acc?.bo_forwarded_at) || b.acc?.status === 'forwarded_bo' || b.acc?.status === 'completed');
  }

  // Text search
  if (queryText) {
    filtered = filtered.filter(b =>
      b.data.booking_number?.toLowerCase().includes(queryText) ||
      b.data.customer_name?.toLowerCase().includes(queryText) ||
      b.data.model?.toLowerCase().includes(queryText) ||
      b.acc?.bill_number?.toLowerCase().includes(queryText)
    );
  }

  return (
    <WorkspaceShell profile={session.profile} memberships={session.memberships} page="accessories">
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Accessories Operations</span>
            <h1>Accessories Desk</h1>
            <p>
              Pre-delivery accessory checklist, fitment tracking, stock verification, commercial billing, and margin sign-off for {branchName}.
            </p>
          </div>
        </div>

        {/* Metric summary cards */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Total Files</span>
            <span className={styles.metricValue}>{totalFiles}</span>
            <span className={styles.metricSub}>Dispatched to Accessories</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Fitment / Stock Pending</span>
            <span className={styles.metricValue}>{fittingPendingCount}</span>
            <span className={styles.metricSub}>Partial or unverified</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Bill Pending</span>
            <span className={styles.metricValue}>{billPendingCount}</span>
            <span className={styles.metricSub}>Tax invoice unrecorded</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Margin Unsigned</span>
            <span className={styles.metricValue}>{marginPendingCount}</span>
            <span className={styles.metricSub}>Requires sign-off</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Forwarded to Accounts</span>
            <span className={styles.metricValue}>{forwardedCount}</span>
            <span className={styles.metricSub}>Completed files</span>
          </div>
        </div>

        {/* Filter bar */}
        <div className={styles.filterBar}>
          <div className={styles.tabs}>
            <Link
              href="/accessories?tab=all"
              className={`${styles.tabItem} ${activeTab === 'all' ? styles.tabItemActive : ''}`}
            >
              All Files ({totalFiles})
            </Link>
            <Link
              href="/accessories?tab=fitting_pending"
              className={`${styles.tabItem} ${activeTab === 'fitting_pending' ? styles.tabItemActive : ''}`}
            >
              Fitment Pending ({fittingPendingCount})
            </Link>
            <Link
              href="/accessories?tab=unsigned_margin"
              className={`${styles.tabItem} ${activeTab === 'unsigned_margin' ? styles.tabItemActive : ''}`}
            >
              Margin Unsigned ({marginPendingCount})
            </Link>
            <Link
              href="/accessories?tab=ready_so"
              className={`${styles.tabItem} ${activeTab === 'ready_so' ? styles.tabItemActive : ''}`}
            >
              Ready for SO / BO
            </Link>
            <Link
              href="/accessories?tab=forwarded"
              className={`${styles.tabItem} ${activeTab === 'forwarded' ? styles.tabItemActive : ''}`}
            >
              Forwarded ({forwardedCount})
            </Link>
          </div>

          <form method="GET" action="/accessories" className={styles.searchBox}>
            <input type="hidden" name="tab" value={activeTab} />
            <input
              type="text"
              name="q"
              defaultValue={queryText}
              placeholder="Search by order, customer, model..."
              className={styles.searchInput}
            />
          </form>
        </div>

        {/* Files queue */}
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No booking files match this filter at the Accessories desk.</p>
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map(b => {
              const stockStatus = b.acc?.stock_status || 'pending';
              const itemsList = Array.isArray(b.acc?.items) ? b.acc.items : [];
              const hasBill = Boolean(b.acc?.bill_number);
              const marginSigned = Boolean(b.acc?.margin_signed);
              const forwarded = Boolean(b.acc?.bo_forwarded_at);

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
                        {b.sub?.allocation_ref ? ` (VIN / Alloc: ${b.sub.allocation_ref})` : ''}
                      </span>
                    </div>

                    <div className={styles.statusBadges}>
                      {stockStatus === 'full_stock' ? (
                        <span className={`${styles.badge} ${styles.badgeSuccess}`}>Full Stock</span>
                      ) : stockStatus === 'partial_stock' ? (
                        <span className={`${styles.badge} ${styles.badgeWarning}`}>Partial Stock</span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeNeutral}`}>Stock Pending</span>
                      )}

                      {hasBill ? (
                        <span className={`${styles.badge} ${styles.badgeSuccess}`}>Billed</span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeWarning}`}>Bill Pending</span>
                      )}

                      {marginSigned ? (
                        <span className={`${styles.badge} ${styles.badgeSuccess}`}>Margin Signed</span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeNeutral}`}>Margin Unsigned</span>
                      )}

                      {forwarded ? (
                        <span className={`${styles.badge} ${styles.badgeSuccess}`}>Forwarded to Accounts</span>
                      ) : (
                        <span className={`${styles.badge} ${styles.badgeNeutral}`}>In Accessories</span>
                      )}
                    </div>
                  </div>

                  <div className={styles.cardGrid}>
                    <div className={styles.gridItem}>
                      <span className={styles.gridLabel}>Checklist Items</span>
                      <span className={styles.gridValue}>
                        {itemsList.length > 0 ? `${itemsList.length} items logged` : 'Checklist not recorded'}
                      </span>
                    </div>

                    <div className={styles.gridItem}>
                      <span className={styles.gridLabel}>Commercial Bill</span>
                      <span className={styles.gridValue}>
                        {b.acc?.bill_number ? `${b.acc.bill_number} (Rs. ${(b.acc.total_bill_amount || 0).toLocaleString('en-IN')})` : 'Not recorded'}
                      </span>
                    </div>

                    <div className={styles.gridItem}>
                      <span className={styles.gridLabel}>Parts / Labour</span>
                      <span className={styles.gridValue}>
                        {b.acc?.bill_number ? `Parts: Rs. ${(b.acc.parts_amount || 0).toLocaleString('en-IN')} | Lab: Rs. ${(b.acc.labour_amount || 0).toLocaleString('en-IN')}` : '-'}
                      </span>
                    </div>

                    <div className={styles.gridItem}>
                      <span className={styles.gridLabel}>Profit / Margin</span>
                      <span className={styles.gridValue}>
                        {b.acc?.bill_number ? `Rs. ${(b.acc.profit_loss_amount || 0).toLocaleString('en-IN')} (${b.acc.margin_percentage || 0}%)` : '-'}
                      </span>
                    </div>
                  </div>

                  <div className={styles.cardFooter}>
                    <span className={styles.timestamp}>
                      Dispatched by BO: {b.prep?.accessories_dispatched_at ? new Date(b.prep.accessories_dispatched_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Pending'}
                    </span>
                    <Link href={`/bookings/${b.id}`} className={styles.actionButton}>
                      Open File <Icon name="arrow" />
                    </Link>
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
