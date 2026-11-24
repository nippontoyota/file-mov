'use client';

import { useRef, useActionState, useEffect } from 'react';
import { softDeleteBooking } from '@/modules/bookings/actions';
import { toast } from '@/components/toast';
import styles from './delete-booking.module.css';

interface DeleteBookingButtonProps {
  bookingId: string;
  customerName?: string;
  bookingNumber?: string;
  customerId?: string | null;
}

export function DeleteBookingButton({
  bookingId,
  customerName,
  bookingNumber,
  customerId,
}: DeleteBookingButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(softDeleteBooking, {});

  const openModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dialogRef.current?.showModal();
  };

  const closeModal = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    dialogRef.current?.close();
  };

  useEffect(() => {
    if (state.success) {
      toast.success(state.success, 'Booking Removed');
      dialogRef.current?.close();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        className={styles.deleteTrigger}
        onClick={openModal}
        title="Remove booking from active list"
        aria-label={`Delete booking ${bookingNumber || bookingId.slice(0, 8)}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
        <span>Delete</span>
      </button>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        onClick={(e) => {
          if (e.target === dialogRef.current) closeModal();
        }}
      >
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <div className={styles.dangerIconWrapper}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <div>
              <h3>Remove Booking from List</h3>
              <p>This booking will be hidden from the active application view.</p>
            </div>
          </div>

          <div className={styles.detailsCard}>
            <div className={styles.detailRow}>
              <span>Customer:</span>
              <strong>{customerName || 'Customer name not entered'}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Booking Number:</span>
              <strong>{bookingNumber || 'Draft'}</strong>
            </div>
            {customerId && (
              <div className={styles.detailRow}>
                <span>Customer ID:</span>
                <span>{customerId}</span>
              </div>
            )}
          </div>

          <div className={styles.complianceNotice}>
            <strong>Append-only audit safety:</strong>
            <p>
              In compliance with dealership statutory audit and RTO requirements, this record is not purged from the database. It is safely archived and removed from your daily view.
            </p>
          </div>

          <form action={formAction}>
            <input type="hidden" name="booking_id" value={bookingId} />
            <input type="hidden" name="reason" value="Removed from active workspace view by user" />

            {state.error && <p className={styles.errorText} role="alert">{state.error}</p>}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={closeModal}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.confirmDeleteButton}
                disabled={pending}
              >
                {pending ? 'Removing...' : 'Confirm Delete'}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
