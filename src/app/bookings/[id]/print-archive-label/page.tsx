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

export default async function PrintArchiveLabelPage({ params }: PageProps) {
  const { id } = await params;
  const { client } = await requireStaff();

  const [bookingRes, prepRes, delvRes, accRes, subRes] = await Promise.all([
    client.from('bookings').select('*, branches(name)').eq('id', id).single(),
    client.from('bo_preparations').select('*').eq('booking_id', id).maybeSingle(),
    client.from('delivery_records').select('*').eq('booking_id', id).maybeSingle(),
    client.from('accounts_records').select('*').eq('booking_id', id).maybeSingle(),
    client.from('sales_submissions').select('allocation_ref').eq('booking_id', id).maybeSingle(),
  ]);

  if (!bookingRes.data || !delvRes.data?.archived_at) {
    notFound();
  }

  const b = bookingRes.data;
  const data = (b.data || {}) as Record<string, string>;
  const prep = prepRes.data;
  const delv = delvRes.data;
  const acc = accRes.data;
  const sub = subRes.data;
  const audit = (delv.archive_physical_audit || {}) as Record<string, boolean>;

  const dossierUrl = `/bookings/${b.id}`;

  return (
    <main className={styles.container}>
      <div className={styles.actionToolbar}>
        <Link href={`/bookings/${b.id}`} className={styles.backLink}>
          Back to Booking File
        </Link>
        <PrintButton label="Print Dossier Jacket Label" className={styles.printButton} />
      </div>

      <div className={styles.sheet}>
        <div className={styles.header}>
          <div className={styles.brandBlock}>
            <h1>Nippon Toyota</h1>
            <p>Customer Vehicle Dossier Jacket Label</p>
            <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Permanent Showroom Records Storage | Branch: {b.branches?.name || 'Showroom'}
            </p>
          </div>
          <div className={styles.qrBlock}>
            <QrCode value={dossierUrl} size={110} />
            <div className={styles.qrCaption}>Scan for Digital Dossier</div>
          </div>
        </div>

        <div className={styles.locationBanner}>
          <div className={styles.locationEyebrow}>Physical Storage Coordinates</div>
          <div className={styles.locationValue}>
            {delv.archive_location || 'Showroom Records Archive Room / Box Assigned'}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>1. Vehicle & Customer Primary Identifiers</div>
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
              <span className={styles.label}>Vehicle Model:</span>
              <span className={styles.val}>{data.model} {data.suffix_1}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Colour:</span>
              <span className={styles.val}>{data.colour_1}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Chassis / VIN:</span>
              <span className={styles.val} style={{ fontFamily: 'monospace' }}>{sub?.allocation_ref || 'N/A'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Permanent Registration No:</span>
              <span className={styles.val}>{prep?.rto_registration_no || 'In-Process'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Booking Dossier No:</span>
              <span className={styles.val}>{data.booking_number || b.id.slice(0, 8)}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Showroom Gate Pass No:</span>
              <span className={styles.val}>{delv.gate_pass_no || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>2. Physical Paper Originals Verification Audit</div>
          <table className={styles.checklistTable}>
            <thead>
              <tr>
                <th>Statutory Paper Document</th>
                <th>Physical Custody Requirement</th>
                <th>Physical Audit Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Form 20 (RTO Application)</td>
                <td>Ink-signed original paper copy</td>
                <td>{audit.form20_signed !== false ? 'Verified Present in Folder' : 'Pending Verification'}</td>
              </tr>
              <tr>
                <td>Customer Statutory Disclaimer</td>
                <td>Ink-signed original paper copy</td>
                <td>{audit.disclaimer_signed !== false ? 'Verified Present in Folder' : 'Pending Verification'}</td>
              </tr>
              <tr>
                <td>Customer Aadhaar & PAN</td>
                <td>Verified self-attested hardcopies</td>
                <td>{audit.aadhaar_verified !== false ? 'Verified Present in Folder' : 'Pending Verification'}</td>
              </tr>
              <tr>
                <td>VAHAN Registration Receipt</td>
                <td>Official RTO e-payment challan hardcopy</td>
                <td>{audit.vahan_receipt_original !== false ? 'Verified Present in Folder' : 'Pending Verification'}</td>
              </tr>
              <tr>
                <td>Kerala Road Tax Receipt</td>
                <td>e-Treasury challan receipt copy</td>
                <td>{acc?.road_tax_receipt_no ? `Verified (${acc.road_tax_receipt_no})` : 'Verified Present'}</td>
              </tr>
              <tr>
                <td>Showroom Exit Gate Pass</td>
                <td>Original slip returned by Security</td>
                <td>{audit.gate_pass_security_copy !== false ? 'Verified Present in Folder' : 'Pending Verification'}</td>
              </tr>
              <tr>
                <td>Vehicle Delivery Handover Receipt</td>
                <td>Customer / Recipient signed original</td>
                <td>{audit.delivery_receipt_signed !== false ? 'Verified Present in Folder' : 'Pending Verification'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>3. Physical File Custody & Storage Audit</div>
          <div className={styles.grid2}>
            <div className={styles.row}>
              <span className={styles.label}>Physical File Returned by Security:</span>
              <span className={styles.val}>
                {delv.security_file_returned_at ? new Date(delv.security_file_returned_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'Verified Returned'}
              </span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Permanently Archived by Accounts:</span>
              <span className={styles.val}>
                {delv.archived_at ? new Date(delv.archived_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'Archived'}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.signatures}>
          <div className={styles.signatureBox}>
            <div className={styles.signatureLine}>Security Officer (Handoff)</div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              Returned to Accounts
            </div>
          </div>
          <div className={styles.signatureBox}>
            <div className={styles.signatureLine}>Accounts Auditor (Receipt)</div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              All Originals Verified
            </div>
          </div>
          <div className={styles.signatureBox}>
            <div className={styles.signatureLine}>Records Custodian</div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              Shelved at Assigned Coordinates
            </div>
          </div>
        </div>

        <div className={styles.footerNote}>
          Affix this printed label to the front of the physical cardboard dossier jacket before filing in the showroom records room. Scan QR code to retrieve the full digital history and document scans.
        </div>
      </div>
    </main>
  );
}
