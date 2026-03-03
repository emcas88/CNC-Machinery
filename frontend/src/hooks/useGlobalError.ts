// F27 – useGlobalError: Zustand store for toast notifications.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  createdAt: number;
}

export interface GlobalErrorState {
  toasts: Toast[];
  maxToasts: number;

  // Actions
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;

  // Convenience methods
  success: (title: string, message?: string, duration?: number) => string;
  error: (title: string, message?: string, duration?: number) => string;
  warning: (title: string, message?: string, duration?: number) => string;
  info: (title: string, message?: string, duration?: number) => string;
}

// ---------------------------------------------------------------------------
// ID generator
// ---------------------------------------------------------------------------

let counter = 0;
export function generateToastId(): string {
  counter += 1;
  return `toast-${Date.now()}-${counter}`;
}

// ---------------------------------------------------------------------------
// Default durations (ms)
// ---------------------------------------------------------------------------

export const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4000,
  error: 8000,
  warning: 6000,
  info: 5000,
};

// ---------------------------------------------------------------------------
// Store factory (Zustand-compatible – can be used with `create` from zustand)
//
// We export the state creator function so it works with Zustand's `create()`.
// For environments without Zustand, we also provide a standalone store.
// ---------------------------------------------------------------------------

export type GlobalErrorStore = GlobalErrorState;

export function createGlobalErrorStore(
  set: (fn: (state: GlobalErrorState) => Partial<GlobalErrorState>) => void,
  get: () => GlobalErrorState
): GlobalErrorState {
  const addToast = (toast: Omit<Toast, 'id' | 'createdAt'>): string => {
    const id = generateToastId();
    const newToast: Toast = {
      ...toast,
      id,
      createdAt: Date.now(),
      duration: toast.duration ?? DEFAULT_DURATIONS[toast.type],
      dismissible: toast.dismissible ?? true,
    };

    set((state) => {
      const toasts = [...state.toasts, newToast];
      // Trim to maxToasts
      while (toasts.length > state.maxToasts) {
        toasts.shift();
      }
      return { toasts };
    });

    return id;
  };

  const removeToast = (id: string): void => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  };

  const clearAllToasts = (): void => {
    set(() => ({ toasts: [] }));
  };

  const success = (title: string, message?: string, duration?: number): string =>
    addToast({ type: 'success', title, message, duration });

  const error = (title: string, message?: string, duration?: number): string =>
    addToast({ type: 'error', title, message, duration });

  const warning = (title: string, message?: string, duration?: number): string =>
    addToast({ type: 'warning', title, message, duration });

  const info = (title: string, message?: string, duration?: number): string =>
    addToast({ type: 'info', title, message, duration });

  return {
    toasts: [],
    maxToasts: 5,
    addToast,
    removeToast,
    clearAllToasts,
    success,
    error,
    warning,
    info,
  };
}

// ---------------------------------------------------------------------------
// Standalone store (for use without Zustand or in tests)
// ---------------------------------------------------------------------------

export class StandaloneGlobalErrorStore implements GlobalErrorState {
  toasts: Toast[] = [];
  maxToasts = 5;
  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  addToast = (toast: Omit<Toast, 'id' | 'createdAt'>): string => {
    const id = generateToastId();
    const newToast: Toast = {
      ...toast,
      id,
      createdAt: Date.now(),
      duration: toast.duration ?? DEFAULT_DURATIONS[toast.type],
      dismissible: toast.dismissible ?? true,
    };
    this.toasts = [...this.toasts, newToast];
    while (this.toasts.length > this.maxToasts) {
      this.toasts.shift();
    }
    this.notify();
    return id;
  };

  removeToast = (id: string): void => {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  };

  clearAllToasts = (): void => {
    this.toasts = [];
    this.notify();
  };

  success = (title: string, message?: string, duration?: number): string =>
    this.addToast({ type: 'success', title, message, duration });

  error = (title: string, message?: string, duration?: number): string =>
    this.addToast({ type: 'error', title, message, duration });

  warning = (title: string, message?: string, duration?: number): string =>
    this.addToast({ type: 'warning', title, message, duration });

  info = (title: string, message?: string, duration?: number): string =>
    this.addToast({ type: 'info', title, message, duration });
}

// ---------------------------------------------------------------------------
// Hook (for use with Zustand)
//
// Usage:
//   import { create } from 'zustand';
//   export const useGlobalError = create<GlobalErrorState>(createGlobalErrorStore);
//
// Then in components:
//   const { success, error } = useGlobalError();
//   success('Saved', 'Part was saved successfully');
// ---------------------------------------------------------------------------
