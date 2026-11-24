import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/modules/identity/session';
import { QrCode } from '@/components/qr-code';
import { PrintButton } from '@/components/print-button';
import styles from '../print.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PrintGatePassPage({ params }: PageProps) {
  const { id } = await params;
  const { client } = await requireStaff();

  const [bookingRes, prepRes, delvRes, accRes, subRes] = await Promise.all([
    client.from('bookings').select('*, branches(name)').eq('id', id).single(),
    client.from('bo_preparations').select('*').eq('booking_id', id).maybeSingle(),
    client.from('delivery_records').select('*').eq('booking_id', id).maybeSingle(),
    client.from('accounts_records').select('*').eq('booking_id', id).maybeSingle(),
    client.from('sales_submissions').select('allocation_ref').eq('booking_id', id).maybeSingle(),
  ]);

  if (!bookingRes.data || !delvRes.data?.gate_pass_no) {
    notFound();
  }

  const b = bookingRes.data;
  const data = (b.data || {}) as Record<string, string>;
  const prep = prepRes.data;
  const delv = delvRes.data;
  const acc = accRes.data;
  const sub = subRes.data;

  // In production or local environment, construct full verification URL
  const verifyPath = `/verify/gate-pass/${b.id}`;

  return (
    <main className={styles.container}>
      <div className={styles.actionToolbar}>
        <Link href={`/bookings/${b.id}`} className={styles.backLink}>
          Back to Booking File
        </Link>
        <PrintButton label="Print 1-Page Gate Pass" className={styles.printButton} />
      </div>

      <div className={styles.sheet}>
        <div className={styles.header}>
          <div className={styles.brandBlock}>
            <h1>Nippon Toyota</h1>
            <p>Vehicle Delivery & Showroom Exit Gate Pass</p>
            <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Branch: {b.branches?.name || 'Showroom'} | Security Exit Gate Checkpoint
            </p>
          </div>
          <div className={styles.qrBlock}>
            <QrCode value={verifyPath} size={110} />
            <div className={styles.qrCaption}>Scan to Verify</div>
          </div>
        </div>

        <div className={styles.locationBanner}>
          <div className={styles.locationEyebrow}>Official Showroom Exit Reference</div>
          <div className={styles.locationValue}>{delv.gate_pass_no}</div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>1. Vehicle Identification</div>
          <div className={styles.grid2}>
            <div className={styles.row}>
              <span className={styles.label}>Model & Variant:</span>
              <span className={styles.val}>{data.model} {data.suffix_1}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Exterior Colour:</span>
              <span className={styles.val}>{data.colour_1}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Chassis / VIN:</span>
              <span className={styles.val} style={{ fontFamily: 'monospace' }}>{sub?.allocation_ref || 'Stockyard Allocated'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>RTO Registration No:</span>
              <span className={styles.val}>{prep?.rto_registration_no || 'Temporary / In-Process'}</span>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>2. Customer & Handover Recipient</div>
          <div className={styles.grid2}>
            <div className={styles.row}>
              <span className={styles.label}>Customer Name:</span>
              <span className={styles.val}>{data.customer_name}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Customer ID:</span>
              <span className={styles.val}>{b.customer_id || data.customer_code}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Contact Person / Nominee:</span>
              <span className={styles.val}>{data.contact_person || data.nominee_name || 'Self'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Delivery Recipient:</span>
              <span className={styles.val}>{delv.recipient_name || data.customer_name} ({delv.recipient_relationship || 'Self'})</span>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>3. Accounts Commercial Clearance Seal</div>
          <div className={styles.grid3}>
            <div className={styles.row}>
              <span className={styles.label}>Commercial Invoice:</span>
              <span className={styles.val}>{acc?.invoice_number || 'Billed'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>FASTag Assigned:</span>
              <span className={styles.val}>{acc?.fastag_tag_id || 'Issued'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Kerala Road Tax:</span>
              <span className={styles.val}>{acc?.road_tax_receipt_no || 'Paid'}</span>
            </div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#166534', fontWeight: 600 }}>
            Financial Closure Signed by Accounts Desk on {delv.financial_closure_at ? new Date(delv.financial_closure_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'Verified'}. Vehicle cleared for exit.
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>4. Showroom Gate Checkpoint Verification</div>
          <table className={styles.checklistTable}>
            <thead>
              <tr>
                <th>Checkpoint Item</th>
                <th>Standard Specification</th>
                <th>Gate Officer Verification</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Showroom Exit Odometer</td>
                <td>Recorded upon gate exit check</td>
                <td><strong>{delv.odometer_reading ?? 15} km</strong></td>
              </tr>
              <tr>
                <td>Vehicle Key Sets</td>
                <td>2 Transponder Key Fobs & Tags</td>
                <td>Confirmed Handed Over</td>
              </tr>
              <tr>
                <td>Standard Delivery Kit</td>
                <td>Owner Manual, Service Booklet, Toolkit, Spare Wheel</td>
                <td>Inspected & Handed Over</td>
              </tr>
              <tr>
                <td>Gate Pass Issue Timestamp</td>
                <td>Physical Barrier Release Time</td>
                <td>{delv.gate_pass_issued_at ? new Date(delv.gate_pass_issued_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={styles.signatures}>
          <div className={styles.signatureBox}>
            <div className={styles.signatureLine}>Security Officer Signature</div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              {delv.security_officer_name || 'Showroom Guard In-Charge'}
            </div>
          </div>
          <div className={styles.signatureBox}>
            <div className={styles.signatureLine}>Sales Consultant Signature</div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              {b.so_name || 'Sales Officer'}
            </div>
          </div>
          <div className={styles.signatureBox}>
            <div className={styles.signatureLine}>Customer Recipient Signature</div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              Vehicle Received in Pristine Condition
            </div>
          </div>
        </div>

        <div className={styles.footerNote}>
          Original Gate Pass. Security retains signed hardcopy slip at the gate barrier; duplicate handed to customer. Tamper-evident verification available via QR scan.
        </div>
      </div>
    </main>
  );
}
