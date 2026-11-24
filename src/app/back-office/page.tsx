import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/modules/identity/session';
import { WorkspaceShell } from '@/components/workspace/shell';
import { Icon } from '@/components/workspace/icon';
import { bookingData } from '@/modules/bookings/fields';
import styles from './back-office.module.css';

interface SearchParams {
  tab?: string;
  q?: string;
}

export default async function BackOfficePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireStaff();
  const boMembership = session.memberships.find(m => ['BO', 'SM', 'Admin'].includes(m.role));
  if (!boMembership) redirect('/workspace');

  const branchId = boMembership.branch_id;
  const branchName = boMembership.branches?.name || 'Showroom';
  const params = await searchParams;
  const activeTab = params.tab || 'all';
  const queryText = (params.q || '').trim().toLowerCase();

  // Query bookings in this branch that are with Back Office or currently allocated
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
        pdi_status,
        pdi_inspector_name,
        pdi_notes,
        pdi_completed_at,
        vahan_app_no,
        vahan_entered_at,
        form20_signed,
        disclaimer_signed,
        insurance_dispatched_at,
        accounts_dispatched_at,
        accessories_dispatched_at
      ),
      sales_submissions (
        allocation_ref,
        allocated_at
      )
    `)
    .eq('branch_id', branchId)
    .in('state', ['bo_review', 'allocated'])
    .order('updated_at', { ascending: false });

  if (error) throw new Error('Back Office queue unavailable');

  const allBookings = (bookingsData || []).map(b => {
    const prep = Array.isArray(b.bo_preparations) ? b.bo_preparations[0] : b.bo_preparations;
    const sub = Array.isArray(b.sales_submissions) ? b.sales_submissions[0] : b.sales_submissions;
    const data = bookingData(b.data);
    return {
      ...b,
      prep,
      sub,
      data,
    };
  });

  // Calculate metrics
  const totalFiles = allBookings.length;
  const pdiPassedCount = allBookings.filter(b => b.prep?.pdi_status === 'passed').length;
  const pdiPendingCount = allBookings.filter(b => !b.prep?.pdi_status || b.prep.pdi_status === 'pending' || b.prep.pdi_status === 'rework').length;
  const vahanStagedCount = allBookings.filter(b => Boolean(b.prep?.vahan_app_no && b.prep?.form20_signed)).length;
  const fullyDispatchedCount = allBookings.filter(b => b.prep?.insurance_dispatched_at && b.prep?.accounts_dispatched_at && b.prep?.accessories_dispatched_at).length;

  // Filter bookings based on active tab and search query
  let filtered = allBookings;
  if (activeTab === 'pdi_pending') {
    filtered = filtered.filter(b => !b.prep?.pdi_status || b.prep.pdi_status === 'pending' || b.prep.pdi_status === 'rework');
  } else if (activeTab === 'vahan_pending') {
    filtered = filtered.filter(b => !b.prep?.vahan_app_no || !b.prep?.form20_signed || !b.prep?.disclaimer_signed);
  } else if (activeTab === 'ready_dispatch') {
    filtered = filtered.filter(b => b.prep?.pdi_status === 'passed' && (!b.prep?.insurance_dispatched_at || !b.prep?.accounts_dispatched_at || !b.prep?.accessories_dispatched_at));
  } else if (activeTab === 'dispatched') {
    filtered = filtered.filter(b => b.prep?.insurance_dispatched_at && b.prep?.accounts_dispatched_at && b.prep?.accessories_dispatched_at);
  }

  if (queryText) {
    filtered = filtered.filter(b =>
      (b.customer_id && b.customer_id.toLowerCase().includes(queryText)) ||
      (b.data.customer_name && b.data.customer_name.toLowerCase().includes(queryText)) ||
      (b.sub?.allocation_ref && b.sub.allocation_ref.toLowerCase().includes(queryText)) ||
      (b.data.model && b.data.model.toLowerCase().includes(queryText))
    );
  }

  return (
    <WorkspaceShell {...session} page="back-office">
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Fulfilment & Operations / Back Office</span>
            <h1>Back Office Desk</h1>
            <p>{branchName} · Vehicle preparation, PDI inspection, VAHAN staging, and departmental dispatches</p>
          </div>
        </div>

        {/* Metric Cards */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Total BO Queue</span>
            <span className={styles.metricValue}>{totalFiles}</span>
            <span className={styles.metricSub}>Active files in preparation</span>
          </div>

          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>PDI Passed</span>
            <span className={styles.metricValue} style={{ color: '#166534' }}>{pdiPassedCount}</span>
            <span className={styles.metricSub}>{pdiPendingCount} awaiting inspection / rework</span>
          </div>

          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>VAHAN Staged</span>
            <span className={styles.metricValue} style={{ color: '#1d4ed8' }}>{vahanStagedCount}</span>
            <span className={styles.metricSub}>Form 20 ink signatures verified</span>
          </div>

          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Fully Dispatched</span>
            <span className={styles.metricValue} style={{ color: '#7c3aed' }}>{fullyDispatchedCount}</span>
            <span className={styles.metricSub}>Sent to Insurance, Accounts & Accessories</span>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div className={styles.filterBar}>
          <Link
            href="/back-office"
            className={`${styles.filterTab} ${activeTab === 'all' ? styles.filterTabActive : ''}`}
          >
            All Files <span className={styles.tabBadge}>{totalFiles}</span>
          </Link>
          <Link
            href="/back-office?tab=pdi_pending"
            className={`${styles.filterTab} ${activeTab === 'pdi_pending' ? styles.filterTabActive : ''}`}
          >
            Pending PDI <span className={styles.tabBadge}>{pdiPendingCount}</span>
          </Link>
          <Link
            href="/back-office?tab=vahan_pending"
            className={`${styles.filterTab} ${activeTab === 'vahan_pending' ? styles.filterTabActive : ''}`}
          >
            Pending VAHAN / Signatures <span className={styles.tabBadge}>{totalFiles - vahanStagedCount}</span>
          </Link>
          <Link
            href="/back-office?tab=ready_dispatch"
            className={`${styles.filterTab} ${activeTab === 'ready_dispatch' ? styles.filterTabActive : ''}`}
          >
            Ready to Dispatch
          </Link>
          <Link
            href="/back-office?tab=dispatched"
            className={`${styles.filterTab} ${activeTab === 'dispatched' ? styles.filterTabActive : ''}`}
          >
            Fully Dispatched <span className={styles.tabBadge}>{fullyDispatchedCount}</span>
          </Link>
        </div>

        {/* Files Table / List */}
        <div className={styles.list}>
          <div className={styles.listHeader}>
            <span>Customer & ID</span>
            <span>Vehicle & VIN / Chassis</span>
            <span>PDI Inspection</span>
            <span>VAHAN & Signatures</span>
            <span>Dispatches</span>
            <span>Action</span>
          </div>

          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <Icon name="folder" style={{ width: '32px', height: '32px', opacity: 0.5 }} />
              <h3>No booking files in this view</h3>
              <p>Files handed over by Sales Managers will appear here for Back Office coordination.</p>
            </div>
          ) : (
            filtered.map(b => {
              const pdiStatus = b.prep?.pdi_status || 'pending';
              const isVahanDone = Boolean(b.prep?.vahan_app_no && b.prep?.form20_signed);

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
                    <small>{b.data.colour_1 || 'Colour not entered'}</small>
                    {b.sub?.allocation_ref ? (
                      <span className={styles.vinBadge}>VIN: {b.sub.allocation_ref}</span>
                    ) : (
                      <small style={{ color: '#b45309' }}>VIN Allocation Pending</small>
                    )}
                  </div>

                  {/* PDI Column */}
                  <div>
                    {pdiStatus === 'passed' ? (
                      <div>
                        <span className={styles.badgePassed}>Passed</span>
                        {b.prep?.pdi_inspector_name && (
                          <small style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                            {b.prep.pdi_inspector_name}
                          </small>
                        )}
                      </div>
                    ) : pdiStatus === 'rework' ? (
                      <div>
                        <span className={styles.badgeRework}>Rework Required</span>
                        {b.prep?.pdi_notes && (
                          <small style={{ display: 'block', fontSize: '11px', color: '#991b1b', marginTop: '2px' }}>
                            {b.prep.pdi_notes}
                          </small>
                        )}
                      </div>
                    ) : pdiStatus === 'failed' ? (
                      <span className={styles.badgeRework}>Failed</span>
                    ) : (
                      <span className={styles.badgePending}>Pending Inspection</span>
                    )}
                  </div>

                  {/* VAHAN & Signatures Column */}
                  <div>
                    {isVahanDone ? (
                      <div>
                        <span className={styles.badgePassed}>Staged</span>
                        <small style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                          App: {b.prep?.vahan_app_no}
                        </small>
                      </div>
                    ) : (
                      <div>
                        <span className={styles.badgePending}>Action Required</span>
                        <small style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                          {!b.prep?.vahan_app_no ? 'No VAHAN App' : !b.prep?.form20_signed ? 'Form 20 Unsigned' : 'Pending'}
                        </small>
                      </div>
                    )}
                  </div>

                  {/* Departmental Dispatches Column */}
                  <div className={styles.dispatchPills}>
                    <div className={`${styles.dispatchPill} ${b.prep?.insurance_dispatched_at ? styles.dispatchPillDone : styles.dispatchPillPending}`}>
                      <span>Insurance</span>
                      <span>{b.prep?.insurance_dispatched_at ? 'Yes' : '—'}</span>
                    </div>
                    <div className={`${styles.dispatchPill} ${b.prep?.accounts_dispatched_at ? styles.dispatchPillDone : styles.dispatchPillPending}`}>
                      <span>Accounts</span>
                      <span>{b.prep?.accounts_dispatched_at ? 'Yes' : '—'}</span>
                    </div>
                    <div className={`${styles.dispatchPill} ${b.prep?.accessories_dispatched_at ? styles.dispatchPillDone : styles.dispatchPillPending}`}>
                      <span>Accessories</span>
                      <span>{b.prep?.accessories_dispatched_at ? 'Yes' : '—'}</span>
                    </div>
                  </div>

                  {/* Action Column */}
                  <div>
                    <Link href={`/bookings/${b.id}`} className={styles.openButton}>
                      Open File →
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
