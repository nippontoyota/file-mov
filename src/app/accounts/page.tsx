import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/modules/identity/session';
import { WorkspaceShell } from '@/components/workspace/shell';
import { Icon } from '@/components/workspace/icon';
import { bookingData } from '@/modules/bookings/fields';
import styles from './accounts.module.css';

interface SearchParams {
  tab?: string;
  q?: string;
}

export default async function AccountsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireStaff();
  const accountsMembership = session.memberships.find(m => ['Accounts', 'Cashier', 'BO', 'SM', 'Admin'].includes(m.role));
  if (!accountsMembership) redirect('/workspace');

  const branchId = accountsMembership.branch_id;
  const branchName = accountsMembership.branches?.name || 'Showroom';
  const params = await searchParams;
  const activeTab = params.tab || 'all';
  const queryText = (params.q || '').trim().toLowerCase();

  // Query bookings in this branch dispatched to Accounts or having an accounts record
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
        accounts_dispatched_at,
        accounts_completed_at
      ),
      sales_submissions (
        allocation_ref,
        allocated_at
      ),
      insurance_policies (
        id,
        status,
        company_name,
        policy_number
      ),
      accounts_records (
        id,
        status,
        invoice_number,
        invoice_date,
        total_invoice_amount,
        fastag_tag_id,
        fastag_bank,
        fastag_handover_status,
        road_tax_receipt_no,
        road_tax_amount,
        updated_at
      )
    `)
    .eq('branch_id', branchId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error('Accounts queue unavailable');

  const allDispatched = (bookingsData || []).map(b => {
    const prep = Array.isArray(b.bo_preparations) ? b.bo_preparations[0] : b.bo_preparations;
    const sub = Array.isArray(b.sales_submissions) ? b.sales_submissions[0] : b.sales_submissions;
    const policy = Array.isArray(b.insurance_policies) ? b.insurance_policies[0] : b.insurance_policies;
    const accounts = Array.isArray(b.accounts_records) ? b.accounts_records[0] : b.accounts_records;
    const data = bookingData(b.data);
    return {
      ...b,
      prep,
      sub,
      policy,
      accounts,
      data,
    };
  }).filter(b => Boolean(b.prep?.accounts_dispatched_at || b.accounts));

  // Compute metrics
  const totalFiles = allDispatched.length;
  const pendingInvoiceCount = allDispatched.filter(b => !b.accounts?.invoice_number).length;
  const pendingFastagCount = allDispatched.filter(b => !b.accounts?.fastag_tag_id).length;
  const pendingRoadTaxCount = allDispatched.filter(b => !b.accounts?.road_tax_receipt_no).length;
  const clearedCount = allDispatched.filter(b => Boolean(b.prep?.accounts_completed_at) || b.accounts?.status === 'cleared').length;

  // Filter based on active tab
  let filtered = allDispatched;
  if (activeTab === 'pending_invoice') {
    filtered = filtered.filter(b => !b.accounts?.invoice_number);
  } else if (activeTab === 'pending_fastag') {
    filtered = filtered.filter(b => !b.accounts?.fastag_tag_id);
  } else if (activeTab === 'pending_road_tax') {
    filtered = filtered.filter(b => !b.accounts?.road_tax_receipt_no);
  } else if (activeTab === 'cleared') {
    filtered = filtered.filter(b => Boolean(b.prep?.accounts_completed_at) || b.accounts?.status === 'cleared');
  }

  // Filter by search text
  if (queryText) {
    filtered = filtered.filter(b => {
      const matchName = (b.data?.customer_name || '').toLowerCase().includes(queryText);
      const matchBooking = (b.data?.booking_number || '').toLowerCase().includes(queryText);
      const matchCustomer = (b.customer_id || '').toLowerCase().includes(queryText);
      const matchChassis = (b.sub?.allocation_ref || '').toLowerCase().includes(queryText);
      const matchInvoice = (b.accounts?.invoice_number || '').toLowerCase().includes(queryText);
      return matchName || matchBooking || matchCustomer || matchChassis || matchInvoice;
    });
  }

  return (
    <WorkspaceShell {...session} page="accounts">
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Accounts Department — {branchName}</span>
            <h1>Accounts Desk</h1>
            <p>Commercial Invoicing, FASTag Issuance, and Kerala Road Tax (SRC-A01 to SRC-A07, Rule D-16, D-17)</p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Total Files</span>
            <span className={styles.metricValue}>{totalFiles}</span>
            <span className={styles.metricSub}>Dispatched from Back Office</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Pending Invoice</span>
            <span className={styles.metricValue} style={{ color: pendingInvoiceCount > 0 ? '#b06000' : 'var(--ink)' }}>
              {pendingInvoiceCount}
            </span>
            <span className={styles.metricSub}>Gated on Insurance issuance</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Pending FASTag</span>
            <span className={styles.metricValue}>{pendingFastagCount}</span>
            <span className={styles.metricSub}>Awaiting RFID tag allocation</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Pending Road Tax</span>
            <span className={styles.metricValue}>{pendingRoadTaxCount}</span>
            <span className={styles.metricSub}>e-Treasury statutory payment</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Accounts Cleared</span>
            <span className={styles.metricValue} style={{ color: '#137333' }}>
              {clearedCount}
            </span>
            <span className={styles.metricSub}>Ready for RTO / Accessories</span>
          </div>
        </div>

        {/* Filter bar */}
        <div className={styles.filterBar}>
          <div className={styles.tabs}>
            <Link
              href="/accounts?tab=all"
              className={`${styles.tabItem} ${activeTab === 'all' ? styles.tabItemActive : ''}`}
            >
              All Files
              <span className={styles.tabBadge}>{totalFiles}</span>
            </Link>
            <Link
              href="/accounts?tab=pending_invoice"
              className={`${styles.tabItem} ${activeTab === 'pending_invoice' ? styles.tabItemActive : ''}`}
            >
              Pending Invoice
              <span className={styles.tabBadge}>{pendingInvoiceCount}</span>
            </Link>
            <Link
              href="/accounts?tab=pending_fastag"
              className={`${styles.tabItem} ${activeTab === 'pending_fastag' ? styles.tabItemActive : ''}`}
            >
              Pending FASTag
              <span className={styles.tabBadge}>{pendingFastagCount}</span>
            </Link>
            <Link
              href="/accounts?tab=pending_road_tax"
              className={`${styles.tabItem} ${activeTab === 'pending_road_tax' ? styles.tabItemActive : ''}`}
            >
              Pending Road Tax
              <span className={styles.tabBadge}>{pendingRoadTaxCount}</span>
            </Link>
            <Link
              href="/accounts?tab=cleared"
              className={`${styles.tabItem} ${activeTab === 'cleared' ? styles.tabItemActive : ''}`}
            >
              Accounts Cleared
              <span className={styles.tabBadge}>{clearedCount}</span>
            </Link>
          </div>

          <form method="GET" action="/accounts" className={styles.searchForm}>
            <input type="hidden" name="tab" value={activeTab} />
            <input
              type="search"
              name="q"
              placeholder="Search customer, booking, chassis, invoice..."
              defaultValue={queryText}
              className={styles.searchInput}
            />
          </form>
        </div>

        {/* Files Table */}
        <div className={styles.tableCard}>
          {filtered.length === 0 ? (
            <div className={styles.emptyState}>
              <Icon name="card" />
              <p>No customer booking files found matching this filter.</p>
            </div>
          ) : (
            <table className={styles.queueTable}>
              <thead>
                <tr>
                  <th>Booking & Customer</th>
                  <th>Allocated Chassis</th>
                  <th>Insurance Status</th>
                  <th>Commercial Invoice</th>
                  <th>FASTag RFID</th>
                  <th>Kerala Road Tax</th>
                  <th>Clearance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const isCleared = Boolean(b.prep?.accounts_completed_at) || b.accounts?.status === 'cleared';
                  const hasInsurance = b.policy?.status === 'issued';
                  const hasInvoice = Boolean(b.accounts?.invoice_number);
                  const hasFastag = Boolean(b.accounts?.fastag_tag_id);
                  const hasRoadTax = Boolean(b.accounts?.road_tax_receipt_no);

                  return (
                    <tr key={b.id}>
                      <td>
                        <Link href={`/bookings/${b.id}`} className={styles.fileLink}>
                          {b.data?.booking_number || b.customer_id}
                        </Link>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                          {b.data?.customer_name || 'Customer'}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontFamily: 'monospace', fontWeight: 650, fontSize: '12px' }}>
                          {b.sub?.allocation_ref || 'Pending Allocation'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          {b.data?.model || 'Vehicle Model'}
                        </div>
                      </td>

                      <td>
                        {hasInsurance ? (
                          <span className={`${styles.badge} ${styles.badgeGreen}`}>
                            Policy Issued
                          </span>
                        ) : (
                          <span className={`${styles.badge} ${styles.badgeAmber}`}>
                            Awaiting Insurance
                          </span>
                        )}
                        {b.policy?.policy_number && (
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                            {b.policy.policy_number}
                          </div>
                        )}
                      </td>

                      <td>
                        {hasInvoice ? (
                          <div>
                            <span className={`${styles.badge} ${styles.badgeGreen}`}>
                              {b.accounts?.invoice_number}
                            </span>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                              Rs. {Number(b.accounts?.total_invoice_amount || 0).toLocaleString('en-IN')}
                            </div>
                          </div>
                        ) : (
                          <span className={`${styles.badge} ${styles.badgeGray}`}>
                            Pending Invoice
                          </span>
                        )}
                      </td>

                      <td>
                        {hasFastag ? (
                          <div>
                            <span className={`${styles.badge} ${styles.badgeBlue}`}>
                              {b.accounts?.fastag_tag_id}
                            </span>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                              {b.accounts?.fastag_handover_status === 'handed_over' ? 'Handed Over' : 'Pending Handover'}
                            </div>
                          </div>
                        ) : (
                          <span className={`${styles.badge} ${styles.badgeGray}`}>
                            Pending Tag
                          </span>
                        )}
                      </td>

                      <td>
                        {hasRoadTax ? (
                          <div>
                            <span className={`${styles.badge} ${styles.badgeGreen}`}>
                              {b.accounts?.road_tax_receipt_no}
                            </span>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                              Rs. {Number(b.accounts?.road_tax_amount || 0).toLocaleString('en-IN')}
                            </div>
                          </div>
                        ) : (
                          <span className={`${styles.badge} ${styles.badgeGray}`}>
                            Pending Tax
                          </span>
                        )}
                      </td>

                      <td>
                        {isCleared ? (
                          <span className={`${styles.badge} ${styles.badgeGreen}`}>
                            Cleared
                          </span>
                        ) : (
                          <span className={`${styles.badge} ${styles.badgeAmber}`}>
                            In Progress
                          </span>
                        )}
                      </td>

                      <td>
                        <Link href={`/bookings/${b.id}`} className={styles.fileLink}>
                          Review File →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
