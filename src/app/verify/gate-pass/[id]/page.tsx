import React from 'react';
import { notFound } from 'next/navigation';
import { userClient } from '@/lib/supabase/server';
import styles from './verify.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface VerificationResult {
  valid: boolean;
  reason?: string;
  gate_pass_no?: string;
  gate_pass_issued_at?: string;
  security_officer_name?: string;
  odometer_reading?: number;
  financial_closure_at?: string;
  delivered_at?: string;
  recipient_name?: string;
  keys_handed_over?: boolean;
  status?: string;
  customer_name?: string;
  booking_number?: string;
  model?: string;
  variant?: string;
  colour?: string;
  chassis_number?: string;
  registration_no?: string;
}

export default async function VerifyGatePassPage({ params }: PageProps) {
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    notFound();
  }

  const client = await userClient();
  const { data: rawResult, error } = await client.rpc('verify_public_gate_pass', {
    p_booking_id: id,
  });

  if (error || !rawResult) {
    return (
      <main className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <span className={styles.eyebrow}>Nippon Toyota Fulfilment Ledger</span>
            <h1 className={styles.title}>Showroom Gate Pass Verification</h1>
          </div>
          <div className={styles.badgeInvalid}>Invalid or Unrecognized Gate Pass</div>
          <div className={styles.content}>
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
              No authorized showroom exit gate pass was found for this code. Vehicle release is strictly prohibited without verified Accounts closure and Gate Pass issuance.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const result = rawResult as unknown as VerificationResult;

  if (!result.valid) {
    return (
      <main className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <span className={styles.eyebrow}>Nippon Toyota Fulfilment Ledger</span>
            <h1 className={styles.title}>Showroom Gate Pass Verification</h1>
          </div>
          <div className={styles.badgeInvalid}>Unverified / Pending Gate Clearance</div>
          <div className={styles.content}>
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
              Gate pass records are pending or not yet issued for this vehicle. Contact Showroom Security Desk or Accounts Department.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>Nippon Toyota Showroom Exit Control</span>
          <h1 className={styles.title}>Official Vehicle Exit Gate Pass</h1>
        </div>

        <div className={styles.badgeValid}>Verified and Authorized Showroom Exit</div>

        <div className={styles.content}>
          <div className={styles.passNumberBanner}>
            <div className={styles.passLabel}>Gate Pass Reference Number</div>
            <div className={styles.passValue}>{result.gate_pass_no}</div>
          </div>

          <div className={styles.sectionTitle}>Vehicle Identification</div>
          <div className={styles.grid}>
            <div>
              <div className={styles.itemLabel}>Model & Variant</div>
              <div className={styles.itemValue}>{result.model} {result.variant}</div>
            </div>
            <div>
              <div className={styles.itemLabel}>Exterior Colour</div>
              <div className={styles.itemValue}>{result.colour}</div>
            </div>
            <div>
              <div className={styles.itemLabel}>Chassis / VIN Number</div>
              <div className={styles.itemValue} style={{ fontFamily: 'monospace' }}>{result.chassis_number || 'Stockyard Allocated'}</div>
            </div>
            <div>
              <div className={styles.itemLabel}>Official Registration No.</div>
              <div className={styles.itemValue}>{result.registration_no}</div>
            </div>
          </div>

          <div className={styles.sectionTitle}>Gate Release Details</div>
          <div className={styles.grid}>
            <div>
              <div className={styles.itemLabel}>Gate Pass Issued At</div>
              <div className={styles.itemValue}>
                {result.gate_pass_issued_at ? new Date(result.gate_pass_issued_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}
              </div>
            </div>
            <div>
              <div className={styles.itemLabel}>Security Officer In-Charge</div>
              <div className={styles.itemValue}>{result.security_officer_name || 'Showroom Security'}</div>
            </div>
            <div>
              <div className={styles.itemLabel}>Showroom Exit Odometer</div>
              <div className={styles.itemValue}>{result.odometer_reading ?? '15'} km</div>
            </div>
            <div>
              <div className={styles.itemLabel}>Accounts Commercial Clearance</div>
              <div className={styles.itemValue} style={{ color: '#166534' }}>
                {result.financial_closure_at ? `Audited & Cleared on ${new Date(result.financial_closure_at).toLocaleDateString('en-IN')}` : 'Cleared'}
              </div>
            </div>
          </div>

          <div className={styles.sectionTitle}>Customer Handover Status</div>
          <div className={styles.grid}>
            <div>
              <div className={styles.itemLabel}>Registered Customer</div>
              <div className={styles.itemValue}>{result.customer_name}</div>
            </div>
            <div>
              <div className={styles.itemLabel}>Delivery Recipient</div>
              <div className={styles.itemValue}>{result.recipient_name || result.customer_name}</div>
            </div>
            <div>
              <div className={styles.itemLabel}>Keys & Delivery Kit Handover</div>
              <div className={styles.itemValue} style={{ color: result.keys_handed_over ? '#166534' : '#64748b' }}>
                {result.keys_handed_over ? 'Handed Over to Customer' : 'Pending Handover'}
              </div>
            </div>
            <div>
              <div className={styles.itemLabel}>Booking Dossier Reference</div>
              <div className={styles.itemValue}>{result.booking_number || id.slice(0, 8)}</div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          Official Nippon Toyota Live Verification Ledger. This digital record authenticates physical paper gate pass #{result.gate_pass_no}.
        </div>
      </div>
    </main>
  );
}
