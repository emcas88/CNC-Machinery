import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RemakeBin from './RemakeBin';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockRemakeBin = vi.fn();
const mockAddToRemakeBin = vi.fn();
const mockMarkPartComplete = vi.fn();

vi.mock('@/services/shop', () => ({
  shopService: {
    remakeBin: (...args: unknown[]) => mockRemakeBin(...args),
    addToRemakeBin: (...args: unknown[]) => mockAddToRemakeBin(...args),
    markPartComplete: (...args: unknown[]) => mockMarkPartComplete(...args),
  },
}));

const mockCurrentJob = { id: 'job-1', name: 'Kitchen Cabinets' };
let storeCurrentJob: typeof mockCurrentJob | null = mockCurrentJob;

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ currentJob: storeCurrentJob }),
}));

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------
const MOCK_ITEMS = [
  {
    id: 'r1',
    partId: 'part-1',
    partName: 'Side Panel A',
    material: 'Maple Plywood',
    dimensions: '24" x 36" x 0.75"',
    reason: 'Damaged',
    status: 'pending' as const,
    quantity: 2,
    notes: 'Chipped corner',
  },
  {
    id: 'r2',
    partId: 'part-2',
    partName: 'Shelf B',
    material: 'Oak Plywood',
    dimensions: '18" x 24" x 0.75"',
    reason: 'Wrong Dimensions',
    status: 'in_progress' as const,
    quantity: 1,
  },
  {
    id: 'r3',
    partId: 'part-3',
    partName: 'Door Panel C',
    material: 'Walnut',
    dimensions: '20" x 30" x 0.5"',
    reason: 'Material Defect',
    status: 'completed' as const,
    quantity: 1,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('RemakeBin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeCurrentJob = mockCurrentJob;
    mockRemakeBin.mockResolvedValue(MOCK_ITEMS);
    mockAddToRemakeBin.mockResolvedValue({ success: true });
    mockMarkPartComplete.mockResolvedValue({ success: true });
  });

  // ── No Job ─────────────────────────────────────────────────────────────
  it('shows no-job message when no currentJob', () => {
    storeCurrentJob = null;
    render(<RemakeBin />, { wrapper: createWrapper() });
    expect(screen.getByTestId('no-job-message')).toBeInTheDocument();
    expect(screen.getByText('No Job Selected')).toBeInTheDocument();
  });

  // ── Loading ────────────────────────────────────────────────────────────
  it('shows loading skeleton while fetching', () => {
    mockRemakeBin.mockReturnValue(new Promise(() => {}));
    render(<RemakeBin />, { wrapper: createWrapper() });
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  // ── Error ──────────────────────────────────────────────────────────────
  it('shows error when fetch fails', async () => {
    mockRemakeBin.mockRejectedValue(new Error('Fetch failed'));
    render(<RemakeBin />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });
  });

  // ── Render Items ─────────────────────────────────────────────────────────
  it('renders all remake items after loading', async () => {
    render(<RemakeBin />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('items-list')).toBeInTheDocument();
    });
    expect(screen.getByText('Side Panel A')).toBeInTheDocument();
    expect(screen.getByText('Shelf B')).toBeInTheDocument();
    expect(screen.getByText('Door Panel C')).toBeInTheDocument();
  });

  it('displays job name in header', async () => {
    render(<RemakeBin />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Kitchen Cabinets')).toBeInTheDocument();
    });
  });

  // ── Summary Stats ────────────────────────────────────────────────────────
  it('displays summary statistics', async () => {
    render(<RemakeBin />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('summary-stats'));

    const statsEl = screen.getByTestId('summary-stats');
    expect(statsEl).toHaveTextContent('3'); // total
    expect(statsEl).toHaveTextContent('1'); // pending (one item)
  });

  // ── Filter Tabs ──────────────────────────────────────────────────────────
  it('filters items by status tab', async () => {
    render(<RemakeBin />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('items-list'));

    // Click "Pending" tab
    await userEvent.click(screen.getByTestId('tab-pending'));
    expect(screen.getByText('Side Panel A')).toBeInTheDocument();
    expect(screen.queryByText('Shelf B')).not.toBeInTheDocument();
    expect(screen.queryByText('Door Panel C')).not.toBeInTheDocument();

    // Click "In Progress"
    await userEvent.click(screen.getByTestId('tab-in_progress'));
    expect(screen.queryByText('Side Panel A')).not.toBeInTheDocument();
    expect(screen.getByText('Shelf B')).toBeInTheDocument();

    // Click "Completed"
    await userEvent.click(screen.getByTestId('tab-completed'));
    expect(screen.getByText('Door Panel C')).toBeInTheDocument();
    expect(screen.queryByText('Side Panel A')).not.toBeInTheDocument();

    // Click "All" to reset
    await userEvent.click(screen.getByTestId('tab-all'));
    expect(screen.getByText('Side Panel A')).toBeInTheDocument();
    expect(screen.getByText('Shelf B')).toBeInTheDocument();
    expect(screen.getByText('Door Panel C')).toBeInTheDocument();
  });

  // ── Search ─────────────────────────────────────────────────────────────
  it('filters items by search term', async () => {
    render(<RemakeBin />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('items-list'));

    await userEvent.type(screen.getByTestId('search-input'), 'Maple');
    expect(screen.getByText('Side Panel A')).toBeInTheDocument();
    expect(screen.queryByText('Shelf B')).not.toBeInTheDocument();
    expect(screen.queryByText('Door Panel C')).not.toBeInTheDocument();
  });

  it('shows empty message when search has no results', async () => {
    render(<RemakeBin />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('items-list'));

    await userEvent.type(screen.getByTestId('search-input'), 'nonexistentpart');
    expect(screen.getByTestId('empty-items')).toBeInTheDocument();
    expect(screen.getByText('No items match your search.')).toBeInTheDocument();
  });

  // ── Empty State (no items) ─────────────────────────────────────────────
  it('shows empty state when no items exist', async () => {
    mockRemakeBin.mockResolvedValue([]);
    render(<RemakeBin />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('empty-items')).toBeInTheDocument();
    });
  });

  // ── Flag Part Modal ──────────────────────────────────────────────────────
  it('opens flag part modal and submits', async () => {
    render(<RemakeBin />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('items-list'));

    await userEvent.click(screen.getByTestId('flag-part-btn'));
    expect(screen.getByTestId('flag-modal')).toBeInTheDocument();

    // Fill form
    await userEvent.type(screen.getByTestId('flag-part-id'), 'part-99');
    await userEvent.selectOptions(screen.getByTestId('flag-reason'), 'Wrong Dimensions');
    await userEvent.clear(screen.getByTestId('flag-quantity'));
    await userEvent.type(screen.getByTestId('flag-quantity'), '3');
    await userEvent.type(screen.getByTestId('flag-notes'), 'Recut needed');

    await userEvent.click(screen.getByTestId('flag-submit-btn'));

    await waitFor(() => {
      expect(mockAddToRemakeBin).toHaveBeenCalledWith('part-99', 'Wrong Dimensions', 3);
    });
  });

  it('cancels flag modal without submitting', async () => {
    render(<RemakeBin />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('items-list'));

    await userEvent.click(screen.getByTestId('flag-part-btn'));
    expect(screen.getByTestId('flag-modal')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('flag-modal')).not.toBeInTheDocument();
    expect(mockAddToRemakeBin).not.toHaveBeenCalled();
  });

  it('shows add error when flagging fails', async () => {
    mockAddToRemakeBin.mockRejectedValue(new Error('Add failed'));
    render(<RemakeBin />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('items-list'));

    await userEvent.click(screen.getByTestId('flag-part-btn'));
    await userEvent.type(screen.getByTestId('flag-part-id'), 'part-bad');
    await userEvent.click(screen.getByTestId('flag-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('add-error')).toBeInTheDocument();
    });
  });

  // ── Status Change ────────────────────────────────────────────────────────
  it('marks item as completed via status dropdown', async () => {
    render(<RemakeBin />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('items-list'));

    const select = screen.getByTestId('status-select-r1');
    await userEvent.selectOptions(select, 'completed');

    await waitFor(() => {
      expect(mockMarkPartComplete).toHaveBeenCalledWith('part-1');
    });
  });

  it('does not show status select for completed items', async () => {
    render(<RemakeBin />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('items-list'));

    expect(screen.queryByTestId('status-select-r3')).not.toBeInTheDocument();
  });

  it('shows complete error when marking fails', async () => {
    mockMarkPartComplete.mockRejectedValue(new Error('Complete failed'));
    render(<RemakeBin />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('items-list'));

    await userEvent.selectOptions(screen.getByTestId('status-select-r1'), 'completed');

    await waitFor(() => {
      expect(screen.getByTestId('complete-error')).toBeInTheDocument();
    });
  });

  // ── Item Card Content ────────────────────────────────────────────────────
  it('displays part details on item cards', async () => {
    render(<RemakeBin />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('items-list'));

    const item = screen.getByTestId('remake-item-r1');
    expect(item).toHaveTextContent('Maple Plywood');
    expect(item).toHaveTextContent('24" x 36" x 0.75"');
    expect(item).toHaveTextContent('Damaged');
    expect(item).toHaveTextContent('Qty: 2');
    expect(item).toHaveTextContent('Chipped corner');
  });

  it('shows status badges for items', async () => {
    render(<RemakeBin />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('items-list'));

    expect(screen.getByTestId('status-badge-r1')).toHaveTextContent('Pending');
    expect(screen.getByTestId('status-badge-r2')).toHaveTextContent('In Progress');
    expect(screen.getByTestId('status-badge-r3')).toHaveTextContent('Completed');
  });

  // ── API calls with correct job ID ────────────────────────────────────────
  it('fetches remake bin with current job id', async () => {
    render(<RemakeBin />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(mockRemakeBin).toHaveBeenCalledWith('job-1');
    });
  });
});
