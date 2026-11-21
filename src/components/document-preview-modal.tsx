'use client';
import { useState, useEffect } from 'react';
import { Icon } from '@/components/workspace/icon';
import styles from './document-preview-modal.module.css';

export interface DocumentPreviewModalProps {
  documentId: string;
  label?: string;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function DocumentPreviewModal({
  documentId,
  label = 'Preview payment slip',
  title = 'Payment Proof Slip',
  subtitle,
  className,
}: DocumentPreviewModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [docState, setDocState] = useState<{
    loading: boolean;
    error: string | null;
    objectUrl: string | null;
    isPdf: boolean;
  }>({
    loading: false,
    error: null,
    objectUrl: null,
    isPdf: true,
  });

  const openModal = () => {
    setDocState({ loading: true, error: null, objectUrl: null, isPdf: true });
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    let url: string | null = null;

    fetch(`/api/booking-documents/${documentId}`)
      .then(async res => {
        if (!res.ok) throw new Error('Document could not be loaded from vault.');
        const blob = await res.blob();
        if (!active) return;
        url = URL.createObjectURL(blob);
        setDocState({
          loading: false,
          error: null,
          objectUrl: url,
          isPdf: blob.type.includes('pdf'),
        });
      })
      .catch(err => {
        if (active) {
          setDocState(prev => ({
            ...prev,
            loading: false,
            error: err.message || 'Error loading document',
          }));
        }
      });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      active = false;
      window.removeEventListener('keydown', handleKeyDown);
      if (url) URL.revokeObjectURL(url);
    };
  }, [isOpen, documentId]);

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={className || styles.triggerBtn}
        aria-label={label}
      >
        <Icon name="eye" />
        <span>{label}</span>
      </button>

      {isOpen && (
        <div
          className={styles.overlay}
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.headerTitle}>
                <Icon name="document" />
                <div>
                  <h3>{title}</h3>
                  {subtitle && <p>{subtitle}</p>}
                </div>
              </div>
              <div className={styles.headerActions}>
                <a
                  href={`/api/booking-documents/${documentId}`}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.externalLink}
                  download
                >
                  Download raw ↗
                </a>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className={styles.closeBtn}
                  aria-label="Close modal"
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>

            <div className={styles.modalBody}>
              {docState.loading && (
                <div className={styles.loading}>
                  <p>Loading document preview from vault…</p>
                </div>
              )}
              {docState.error && (
                <div className={styles.error}>
                  <p>{docState.error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setDocState({ loading: true, error: null, objectUrl: null, isPdf: true });
                    }}
                    className={styles.externalLink}
                  >
                    Retry
                  </button>
                </div>
              )}
              {!docState.loading && !docState.error && docState.objectUrl && (
                docState.isPdf ? (
                  <iframe
                    src={docState.objectUrl}
                    className={styles.pdfFrame}
                    title={title}
                  />
                ) : (
                  <div className={styles.imageWrap}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={docState.objectUrl}
                      alt={title}
                      className={styles.previewImg}
                    />
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
