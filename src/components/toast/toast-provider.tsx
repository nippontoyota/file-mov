'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ToastItem, ToastType } from './toast.types';
import { toastManager, toast } from './toast-manager';
import { SuccessIcon, ErrorIcon, InfoIcon, WarningIcon, CloseIcon } from './toast-icons';
import { UrlToastListener } from './url-toast-listener';
import styles from './toast.module.css';

interface ToastContextValue {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
  show: (type: ToastType, message: string, title?: string, duration?: number) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toasts: [],
      dismiss: toast.dismiss,
      show: (type: ToastType, message: string, title?: string, duration?: number) =>
        toastManager.show(type, message, title, duration),
      success: toast.success,
      error: toast.error,
      info: toast.info,
      warning: toast.warning,
    };
  }
  return {
    ...ctx,
    success: toast.success,
    error: toast.error,
    info: toast.info,
    warning: toast.warning,
  };
}

function ToastItemCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [isPaused, setIsPaused] = useState(false);
  const remainingTimeRef = useRef(item.duration || 4000);
  const startTimeRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (startTimeRef.current > 0) {
        remainingTimeRef.current -= Date.now() - startTimeRef.current;
      }
    } else {
      startTimeRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        onDismiss(item.id);
      }, Math.max(500, remainingTimeRef.current));
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPaused, item.id, onDismiss]);

  const typeClass =
    item.type === 'success'
      ? styles.toastSuccess
      : item.type === 'error'
      ? styles.toastError
      : item.type === 'warning'
      ? styles.toastWarning
      : styles.toastInfo;

  const iconClass =
    item.type === 'success'
      ? styles.iconSuccess
      : item.type === 'error'
      ? styles.iconError
      : item.type === 'warning'
      ? styles.iconWarning
      : styles.iconInfo;

  const progressClass =
    item.type === 'success'
      ? styles.progressSuccess
      : item.type === 'error'
      ? styles.progressError
      : item.type === 'warning'
      ? styles.progressWarning
      : styles.progressInfo;

  return (
    <div
      className={`${styles.toast} ${typeClass}`}
      role={item.type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className={`${styles.iconWrapper} ${iconClass}`}>
        {item.type === 'success' && <SuccessIcon />}
        {item.type === 'error' && <ErrorIcon />}
        {item.type === 'warning' && <WarningIcon />}
        {item.type === 'info' && <InfoIcon />}
      </div>

      <div className={styles.body}>
        {item.title && <div className={styles.title}>{item.title}</div>}
        <div className={styles.message}>{item.message}</div>
      </div>

      <button
        type="button"
        className={styles.closeButton}
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
      >
        <CloseIcon />
      </button>

      <div
        className={`${styles.progressBar} ${progressClass}`}
        style={{
          animationDuration: `${item.duration || 4000}ms`,
          animationPlayState: isPaused ? 'paused' : 'running',
        }}
      />
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toastManager.subscribe(setToasts);
  }, []);

  const dismiss = (id: string) => {
    toastManager.dismiss(id);
  };

  const show = (type: ToastType, message: string, title?: string, duration?: number) => {
    return toastManager.show(type, message, title, duration);
  };

  return (
    <ToastContext.Provider value={{ toasts, dismiss, show }}>
      {children}
      <UrlToastListener />
      {toasts.length > 0 && (
        <div className={styles.container} aria-label="Notifications" role="region">
          {toasts.map(item => (
            <ToastItemCard key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
