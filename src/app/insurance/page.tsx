import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/modules/identity/session';
import { WorkspaceShell } from '@/components/workspace/shell';
import { Icon } from '@/components/workspace/icon';
import { bookingData } from '@/modules/bookings/fields';
import styles from './insurance.module.css';

interface SearchParams {
  tab?: string;
  q?: string;
}

export default async function InsurancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireStaff();
  const insuranceMembership = session.memberships.find(m => ['Insurance', 'BO', 'SM', 'Admin'].includes(m.role));
  if (!insuranceMembership) redirect('/workspace');

  const branchId = insuranceMembership.branch_id;
  const branchName = insuranceMembership.branches?.name || 'Showroom';
  const params = await searchParams;
  const activeTab = params.tab || 'all';
  const queryText = (params.q || '').trim().toLowerCase();

  // Query bookings in this branch dispatched to Insurance or having an insurance policy
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
        insurance_dispatched_at,
        insurance_completed_at
      ),
      sales_submissions (
        allocation_ref,
        allocated_at
      ),
      insurance_policies (
        id,
        status,
        company_name,
        policy_number,
        idv_amount,
        premium_amount,
        issued_at,
        hypothecation_bank,
        document_id
      )
    `)
    .eq('branch_id', branchId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error('Insurance queue unavailable');

  const allDispatched = (bookingsData || []).map(b => {
    const prep = Array.isArray(b.bo_preparations) ? b.bo_preparations[0] : b.bo_preparations;
    const sub = Array.isArray(b.sales_submissions) ? b.sales_submissions[0] : b.sales_submissions;
    const policy = Array.isArray(b.insurance_policies) ? b.insurance_policies[0] : b.insurance_policies;
    const data = bookingData(b.data);
    return {
      ...b,
      prep,
      sub,
      policy,
      data,
    };
  }).filter(b => Boolean(b.prep?.insurance_dispatched_at || b.policy));

  // Compute metrics
  const totalFiles = allDispatched.length;
  const issuedCount = allDispatched.filter(b => b.policy?.status === 'issued').length;
  const pendingCount = allDispatched.filter(b => !b.policy || b.policy.status !== 'issued').length;
  const financedCount = allDispatched.filter(b => Boolean(b.policy?.hypothecation_bank)).length;

  // Filter based on active tab
  let filtered = allDispatched;
  if (activeTab === 'pending') {
    filtered = filtered.filter(b => !b.policy || b.policy.status !== 'issued');
  } else if (activeTab === 'issued') {
    filtered = filtered.filter(b => b.policy?.status === 'issued');
  } else if (activeTab === 'financed') {
    filtered = filtered.filter(b => Boolean(b.policy?.hypothecation_bank));
  }

  if (queryText) {
    filtered = filtered.filter(b =>
      (b.customer_id && b.customer_id.toLowerCase().includes(queryText)) ||
      (b.data.customer_name && b.data.customer_name.toLowerCase().includes(queryText)) ||
      (b.sub?.allocation_ref && b.sub.allocation_ref.toLowerCase().includes(queryText)) ||
      (b.data.model && b.data.model.toLowerCase().includes(queryText)) ||
      (b.policy?.policy_number && b.policy.policy_number.toLowerCase().includes(queryText))
    );
  }

  return (
    <WorkspaceShell {...session} page="insurance">
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Statutory Fulfilment / Toyota Insurance Broking</span>
            <h1>Insurance Desk</h1>
            <p>{branchName} · Motor insurance policy quotation, underwriter binding, and policy certificate delivery</p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Total In Queue</span>
            <span className={styles.metricValue}>{totalFiles}</span>
            <span className={styles.metricSub}>Dispatched from Back Office</span>
          </div>

          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Policies Bound & Issued</span>
            <span className={styles.metricValue} style={{ color: '#166534' }}>{issuedCount}</span>
            <span className={styles.metricSub}>Approved for Accounts tax invoicing</span>
          </div>

          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Awaiting Issuance</span>
            <span className={styles.metricValue} style={{ color: '#854d0e' }}>{pendingCount}</span>
            <span className={styles.metricSub}>Awaiting underwriter binding</span>
          </div>

          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Financed / Loan Endorsed</span>
            <span className={styles.metricValue} style={{ color: '#1d4ed8' }}>{financedCount}</span>
            <span className={styles.metricSub}>Bank hypothecation required</span>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div className={styles.filterBar}>
          <Link
            href="/insurance"
            className={`${styles.filterTab} ${activeTab === 'all' ? styles.filterTabActive : ''}`}
          >
            All Files <span className={styles.tabBadge}>{totalFiles}</span>
          </Link>
          <Link
            href="/insurance?tab=pending"
            className={`${styles.filterTab} ${activeTab === 'pending' ? styles.filterTabActive : ''}`}
          >
            Awaiting Issuance <span className={styles.tabBadge}>{pendingCount}</span>
          </Link>
          <Link
            href="/insurance?tab=issued"
            className={`${styles.filterTab} ${activeTab === 'issued' ? styles.filterTabActive : ''}`}
          >
            Policies Issued <span className={styles.tabBadge}>{issuedCount}</span>
          </Link>
          <Link
            href="/insurance?tab=financed"
            className={`${styles.filterTab} ${activeTab === 'financed' ? styles.filterTabActive : ''}`}
          >
            Financed Vehicles <span className={styles.tabBadge}>{financedCount}</span>
          </Link>
        </div>

        {/* Files Table / List */}
        <div className={styles.list}>
          <div className={styles.listHeader}>
            <span>Customer & ID</span>
            <span>Vehicle & Stockyard Chassis</span>
            <span>Underwriter & Policy</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <Icon name="shield" style={{ width: '32px', height: '32px', opacity: 0.5 }} />
              <h3>No insurance files in this view</h3>
              <p>Files dispatched by Back Office will appear here for motor insurance binding.</p>
            </div>
          ) : (
            filtered.map(b => {
              const isIssued = b.policy?.status === 'issued';

              return (
                <div key={b.id} className={styles.row}>
                  {/* Customer Column */}
                  <div className={styles.customerCol}>
                    <strong>{b.data.customer_name || 'Customer'}</strong>
                    <small>ID: {b.customer_id || 'Not entered'}</small>
                    <small>SO: {b.so_name}</small>
                  </div>

                  {/* Vehicle Column */}
                  <div className={styles.vehicleCol}>
                    <strong>{b.data.model || 'Toyota Vehicle'} {b.data.suffix_1 ? `(${b.data.suffix_1})` : ''}</strong>
                    <small>{b.data.colour_1 || 'Standard Colour'} · 7 Seater</small>
                    {b.sub?.allocation_ref ? (
                      <span className={styles.vinBadge}>Chassis: {b.sub.allocation_ref}</span>
                    ) : (
                      <small style={{ color: '#b45309' }}>VIN Allocation Pending</small>
                    )}
                  </div>

                  {/* Underwriter & Policy Column */}
                  <div>
                    {isIssued ? (
                      <div>
                        <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>{b.policy?.company_name}</strong>
                        <small style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                          #{b.policy?.policy_number}
                        </small>
                        <small style={{ display: 'block', fontSize: '11px', color: '#166534', marginTop: '2px', fontWeight: 600 }}>
                          IDV: ₹{Number(b.policy?.idv_amount || 0).toLocaleString('en-IN')} · Prem: ₹{Number(b.policy?.premium_amount || 0).toLocaleString('en-IN')}
                        </small>
                      </div>
                    ) : (
                      <div>
                        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Quote / Underwriter Pending</span>
                        <small style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                          Dispatched {b.prep?.insurance_dispatched_at ? new Date(b.prep.insurance_dispatched_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'recently'}
                        </small>
                      </div>
                    )}
                  </div>

                  {/* Status Column */}
                  <div>
                    {isIssued ? (
                      <div>
                        <span className={styles.badgePassed}>Policy Issued</span>
                        {b.policy?.issued_at && (
                          <small style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                            {new Date(b.policy.issued_at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                          </small>
                        )}
                      </div>
                    ) : (
                      <span className={styles.badgePending}>Awaiting Policy</span>
                    )}
                  </div>

                  {/* Action Column */}
                  <div>
                    <Link href={`/bookings/${b.id}#insurance`} className={styles.openButton}>
                      {isIssued ? 'View Policy →' : 'Issue Policy →'}
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
