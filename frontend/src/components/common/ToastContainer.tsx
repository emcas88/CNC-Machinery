// F27 – ToastContainer: Renders toast notifications with auto-dismiss.

import { useEffect, useCallback, useState, useRef, type ReactNode } from 'react';
import type { Toast, ToastType, GlobalErrorState } from '@/hooks/useGlobalError';

// ---------------------------------------------------------------------------
// Icons per toast type
// ---------------------------------------------------------------------------

const TOAST_ICONS: Record<ToastType, ReactNode> = {
  success: (
    <svg className="w-5 h-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'bg-green-950/90 border-green-800/50',
  error: 'bg-red-950/90 border-red-800/50',
  warning: 'bg-yellow-950/90 border-yellow-800/50',
  info: 'bg-blue-950/90 border-blue-800/50',
};

// ---------------------------------------------------------------------------
// Single toast component
// ---------------------------------------------------------------------------

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

export function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const dismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 200); // wait for exit animation
  }, [toast.id, onDismiss]);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      timerRef.current = setTimeout(dismiss, toast.duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.duration, dismiss]);

  // Pause timer on hover
  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleMouseLeave = () => {
    if (toast.duration && toast.duration > 0) {
      timerRef.current = setTimeout(dismiss, toast.duration / 2);
    }
  };

  return (
    <div
      data-testid={`toast-${toast.id}`}
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 p-3 rounded-lg border shadow-lg backdrop-blur-sm
        transition-all duration-200 max-w-sm w-full
        ${TOAST_STYLES[toast.type]}
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">{TOAST_ICONS[toast.type]}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-100">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-gray-400 mt-0.5">{toast.message}</p>
        )}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="text-xs text-blue-400 hover:text-blue-300 mt-1 underline"
            data-testid={`toast-action-${toast.id}`}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Dismiss button */}
      {toast.dismissible !== false && (
        <button
          onClick={dismiss}
          className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
          aria-label="Dismiss notification"
          data-testid={`toast-dismiss-${toast.id}`}
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Container component
// ---------------------------------------------------------------------------

export interface ToastContainerProps {
  /** The global error store to read toasts from. */
  store: Pick<GlobalErrorState, 'toasts' | 'removeToast'>;
  /** Position on screen. Default: top-right. */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

const POSITION_CLASSES: Record<NonNullable<ToastContainerProps['position']>, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

export function ToastContainer({ store, position = 'top-right' }: ToastContainerProps) {
  if (store.toasts.length === 0) return null;

  return (
    <div
      className={`fixed z-50 flex flex-col gap-2 ${POSITION_CLASSES[position]}`}
      data-testid="toast-container"
      aria-label="Notifications"
    >
      {store.toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={store.removeToast} />
      ))}
    </div>
  );
}

export default ToastContainer;
