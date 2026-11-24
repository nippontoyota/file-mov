'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from './toast-manager';

const KNOWN_MESSAGES: Record<string, { type: 'success' | 'info'; title?: string; message: string }> = {
  saved: { type: 'success', title: 'Draft Saved', message: 'Booking details updated. No approval or handoff recorded.' },
  submitted: { type: 'success', title: 'File Submitted', message: 'Booking submitted to Team Leader for review.' },
  approved: { type: 'success', title: 'Approval Recorded', message: 'File reviewed and approved.' },
  allocated: { type: 'success', title: 'Vehicle Allocated', message: 'Chassis VIN allocated and customer intimation recorded.' },
  dispatched: { type: 'success', title: 'Department Dispatch', message: 'File forwarded to parallel processing desks.' },
  policy_issued: { type: 'success', title: 'Insurance Policy Issued', message: 'Motor insurance policy verified and attached.' },
  invoiced: { type: 'success', title: 'Invoice Generated', message: 'Vehicle commercial tax invoice recorded.' },
  fastag: { type: 'success', title: 'FASTag Assigned', message: 'RFID tag assigned and cleared for handover.' },
  road_tax: { type: 'success', title: 'Road Tax Paid', message: 'Kerala e-Treasury tax challan payment recorded.' },
  clearance: { type: 'success', title: 'Accounts Clearance', message: 'Commercial vehicle accounts clearance completed.' },
  accessories: { type: 'success', title: 'Accessories Recorded', message: 'Fitment and billing recorded with margin sign-off.' },
  rto: { type: 'success', title: 'RTO Registration Completed', message: 'Official vehicle registration and HSRP plates recorded.' },
  financial_closure: { type: 'success', title: 'Financial Closure Complete', message: 'Commercial accounts audited. Cleared for vehicle release.' },
  gate_pass: { type: 'success', title: 'Gate Pass Issued', message: 'Showroom exit gate pass generated.' },
  delivered: { type: 'success', title: 'Vehicle Delivered', message: 'Keys and delivery kit presented to customer.' },
  file_returned: { type: 'success', title: 'File Returned', message: 'Physical folder returned by Security to Accounts.' },
  archived: { type: 'success', title: 'File Archived', message: 'Customer folder audited and filed in showroom records.' },
};

function UrlToastInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const toastParam = searchParams.get('toast');
    const toastSuccess = searchParams.get('toast_success');
    const toastError = searchParams.get('toast_error');
    const isSaved = searchParams.get('saved') === '1';

    let triggered = false;

    if (toastParam && KNOWN_MESSAGES[toastParam]) {
      const { type, title, message } = KNOWN_MESSAGES[toastParam];
      if (type === 'success') toast.success(message, title);
      else toast.info(message, title);
      triggered = true;
    } else if (isSaved) {
      toast.success('Booking draft saved. No approval or handoff recorded.', 'Draft Saved');
      triggered = true;
    } else if (toastSuccess) {
      toast.success(toastSuccess);
      triggered = true;
    } else if (toastError) {
      toast.error(toastError);
      triggered = true;
    }

    if (triggered && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('toast');
      url.searchParams.delete('toast_success');
      url.searchParams.delete('toast_error');
      url.searchParams.delete('saved');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
    }
  }, [searchParams]);

  return null;
}

export function UrlToastListener() {
  return (
    <Suspense fallback={null}>
      <UrlToastInner />
    </Suspense>
  );
}
