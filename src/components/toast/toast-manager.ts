import type { ToastItem, ToastType } from './toast.types';

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener([...this.toasts]);
    }
  }

  show(type: ToastType, message: string, title?: string, duration = 4000) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: ToastItem = { id, type, message, title, duration };
    // Keep at most 4 simultaneous toasts
    this.toasts = [item, ...this.toasts.slice(0, 3)];
    this.notify();
    return id;
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notify();
  }

  clear() {
    this.toasts = [];
    this.notify();
  }
}

export const toastManager = new ToastManager();

export const toast = {
  success: (message: string, title?: string, duration?: number) =>
    toastManager.show('success', message, title, duration),
  error: (message: string, title?: string, duration?: number) =>
    toastManager.show('error', message, title, duration || 5000),
  info: (message: string, title?: string, duration?: number) =>
    toastManager.show('info', message, title, duration),
  warning: (message: string, title?: string, duration?: number) =>
    toastManager.show('warning', message, title, duration || 4500),
  dismiss: (id: string) => toastManager.dismiss(id),
};
