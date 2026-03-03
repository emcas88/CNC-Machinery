// F27 – ErrorBoundary: React error boundary with fallback UI, retry, and reporting.

import { Component, type ErrorInfo, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI. Receives the error and a reset function. */
  fallback?: (props: { error: Error; resetError: () => void }) => ReactNode;
  /** Called when an error is caught. Use for logging/reporting. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Key that, when changed, resets the error boundary. */
  resetKey?: string | number;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ---------------------------------------------------------------------------
// Default fallback component
// ---------------------------------------------------------------------------

export function DefaultErrorFallback({
  error,
  resetError,
}: {
  error: Error;
  resetError: () => void;
}) {
  return (
    <div
      role="alert"
      data-testid="error-fallback"
      className="flex flex-col items-center justify-center min-h-[200px] p-8 bg-red-950/20 border border-red-900/30 rounded-lg"
    >
      <svg
        className="w-12 h-12 text-red-400 mb-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>

      <h2 className="text-lg font-semibold text-red-300 mb-2">Something went wrong</h2>
      <p className="text-sm text-gray-400 mb-4 text-center max-w-md">
        An unexpected error occurred. You can try again or contact support if the problem persists.
      </p>

      {/* Error details (collapsed by default) */}
      <details className="mb-4 w-full max-w-md">
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">
          Technical details
        </summary>
        <pre className="mt-2 p-3 bg-gray-900 rounded text-xs text-red-400 overflow-auto max-h-32">
          {error.message}
          {error.stack && `\n\n${error.stack}`}
        </pre>
      </details>

      <button
        onClick={resetError}
        className="px-4 py-2 bg-red-900/50 text-red-200 rounded hover:bg-red-900/70 transition-colors text-sm"
        data-testid="retry-button"
      >
        Try Again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ErrorBoundary class component
// ---------------------------------------------------------------------------

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.hasError &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          resetError: this.resetError,
        });
      }
      return (
        <DefaultErrorFallback
          error={this.state.error}
          resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
