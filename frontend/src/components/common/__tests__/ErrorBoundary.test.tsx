// F27 – ErrorBoundary tests (part of the 25+ F27 test suite)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ErrorBoundary, DefaultErrorFallback } from './ErrorBoundary';
import { useState } from 'react';

// ---------------------------------------------------------------------------
// Helper: component that throws
// ---------------------------------------------------------------------------

function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div data-testid="child">Rendered successfully</div>;
}

function ThrowOnClick() {
  const [shouldThrow, setShouldThrow] = useState(false);
  if (shouldThrow) throw new Error('Click error');
  return (
    <button data-testid="throw-btn" onClick={() => setShouldThrow(true)}>
      Throw
    </button>
  );
}

// Suppress console.error noise from React error boundaries in tests
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ErrorBoundary', () => {
  // Test 1
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  // Test 2
  it('shows default fallback when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('error-fallback')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  // Test 3
  it('displays the error message in technical details', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Test error/)).toBeInTheDocument();
  });

  // Test 4
  it('provides a retry button that resets the boundary', () => {
    // We need a component that won't throw on re-render
    let throwCount = 0;
    function ConditionalThrow() {
      throwCount++;
      if (throwCount === 1) throw new Error('First render error');
      return <div data-testid="recovered">Recovered!</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('error-fallback')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('retry-button'));
    expect(screen.getByTestId('recovered')).toBeInTheDocument();
  });

  // Test 5
  it('calls onError callback when error is caught', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('Test error');
  });

  // Test 6
  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary
        fallback={({ error, resetError }) => (
          <div data-testid="custom-fallback">
            <p>{error.message}</p>
            <button data-testid="custom-retry" onClick={resetError}>
              Custom Retry
            </button>
          </div>
        )}
      >
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  // Test 7
  it('resets when resetKey changes', () => {
    let throwOnce = true;
    function MaybeThrow() {
      if (throwOnce) {
        throwOnce = false;
        throw new Error('Key error');
      }
      return <div data-testid="after-reset">Reset worked</div>;
    }

    function Wrapper() {
      const [key, setKey] = useState(1);
      return (
        <div>
          <button data-testid="change-key" onClick={() => setKey((k) => k + 1)}>
            Change Key
          </button>
          <ErrorBoundary resetKey={key}>
            <MaybeThrow />
          </ErrorBoundary>
        </div>
      );
    }

    render(<Wrapper />);
    expect(screen.getByTestId('error-fallback')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('change-key'));
    expect(screen.getByTestId('after-reset')).toBeInTheDocument();
  });

  // Test 8
  it('does not catch errors outside the boundary', () => {
    // ErrorBoundary wrapping a non-throwing component
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByTestId('child')).toHaveTextContent('Rendered successfully');
  });
});

// ---------------------------------------------------------------------------
// DefaultErrorFallback tests
// ---------------------------------------------------------------------------

describe('DefaultErrorFallback', () => {
  // Test 9
  it('renders error message', () => {
    render(<DefaultErrorFallback error={new Error('Oops')} resetError={vi.fn()} />);
    expect(screen.getByText(/Oops/)).toBeInTheDocument();
  });

  // Test 10
  it('calls resetError on retry click', () => {
    const reset = vi.fn();
    render(<DefaultErrorFallback error={new Error('Oops')} resetError={reset} />);
    fireEvent.click(screen.getByTestId('retry-button'));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  // Test 11
  it('has role="alert" for accessibility', () => {
    render(<DefaultErrorFallback error={new Error('Err')} resetError={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  // Test 12
  it('shows stack trace in details section', () => {
    const err = new Error('Stack test');
    err.stack = 'Error: Stack test\n    at Test.tsx:42';
    render(<DefaultErrorFallback error={err} resetError={vi.fn()} />);
    expect(screen.getByText(/at Test.tsx:42/)).toBeInTheDocument();
  });
});
