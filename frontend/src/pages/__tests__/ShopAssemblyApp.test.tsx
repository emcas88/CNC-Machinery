import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ShopAssemblyApp from './ShopAssemblyApp';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockGetAssembly = vi.fn();
const mockGetProgress = vi.fn();
const mockMarkPartComplete = vi.fn();

vi.mock('@/services/shop', () => ({
  shopService: {
    getAssembly: (...args: unknown[]) => mockGetAssembly(...args),
    getProgress: (...args: unknown[]) => mockGetProgress(...args),
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
const MOCK_TASKS = [
  {
    id: 't1',
    partId: 'part-1',
    productName: 'Base Cabinet',
    steps: [
      { id: 's1', description: 'Attach sides', completed: true },
      { id: 's2', description: 'Install shelf', completed: false },
    ],
    assignedWorker: 'John',
    priority: 'high' as const,
    status: 'in_progress' as const,
  },
  {
    id: 't2',
    partId: 'part-2',
    productName: 'Wall Cabinet',
    steps: [
      { id: 's3', description: 'Attach back panel', completed: false },
      { id: 's4', description: 'Mount hinges', completed: false },
    ],
    assignedWorker: 'Maria',
    priority: 'medium' as const,
    status: 'pending' as const,
  },
  {
    id: 't3',
    partId: 'part-3',
    productName: 'Drawer Unit',
    steps: [
      { id: 's5', description: 'Assemble box', completed: true },
      { id: 's6', description: 'Install slides', completed: true },
    ],
    assignedWorker: 'Sam',
    priority: 'low' as const,
    status: 'completed' as const,
  },
];

const MOCK_PROGRESS = {
  total: 10,
  cut: 8,
  assembled: 5,
  percent: 50,
};

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
describe('ShopAssemblyApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeCurrentJob = mockCurrentJob;
    mockGetAssembly.mockResolvedValue(MOCK_TASKS);
    mockGetProgress.mockResolvedValue(MOCK_PROGRESS);
    mockMarkPartComplete.mockResolvedValue({ success: true });
  });

  // ── No Job ─────────────────────────────────────────────────────────────────
  it('shows no-job message when no currentJob', () => {
    storeCurrentJob = null;
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    expect(screen.getByTestId('no-job-message')).toBeInTheDocument();
    expect(screen.getByText('No Job Selected')).toBeInTheDocument();
  });

  // ── Loading ────────────────────────────────────────────────────────────────
  it('shows loading skeleton while fetching', () => {
    mockGetAssembly.mockReturnValue(new Promise(() => {}));
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  // ── Error ──────────────────────────────────────────────────────────────────
  it('shows error when assembly fetch fails', async () => {
    mockGetAssembly.mockRejectedValue(new Error('Network fail'));
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });
  });

  // ── Render Tasks ─────────────────────────────────────────────────────────────
  it('renders task cards after loading', async () => {
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('tasks-grid')).toBeInTheDocument();
    });
    expect(screen.getByText('Base Cabinet')).toBeInTheDocument();
    expect(screen.getByText('Wall Cabinet')).toBeInTheDocument();
    expect(screen.getByText('Drawer Unit')).toBeInTheDocument();
  });

  it('displays job name in header', async () => {
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Kitchen Cabinets')).toBeInTheDocument();
    });
  });

  // ── Progress Bar ─────────────────────────────────────────────────────────────
  it('renders progress bar with correct values', async () => {
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('progress-bar'));

    const bar = screen.getByTestId('progress-bar');
    expect(bar).toHaveTextContent('50%');
    expect(bar).toHaveTextContent('Total: 10');
    expect(bar).toHaveTextContent('Cut: 8');
    expect(bar).toHaveTextContent('Assembled: 5');
  });

  it('progress fill has correct width', async () => {
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('progress-fill'));
    expect(screen.getByTestId('progress-fill')).toHaveStyle({ width: '50%' });
  });

  // ── Task Card Details ────────────────────────────────────────────────────────
  it('shows worker, priority, and status on task cards', async () => {
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('tasks-grid'));

    const card = screen.getByTestId('task-card-t1');
    expect(card).toHaveTextContent('Worker: John');
    expect(screen.getByTestId('priority-badge-t1')).toHaveTextContent('high');
    expect(screen.getByTestId('status-badge-t1')).toHaveTextContent('In Progress');
  });

  it('shows assembly steps with completion indicators', async () => {
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('tasks-grid'));

    const stepsList = screen.getByTestId('steps-list-t1');
    expect(stepsList).toHaveTextContent('Attach sides');
    expect(stepsList).toHaveTextContent('Install shelf');
  });

  // ── Filter Tabs ──────────────────────────────────────────────────────────────
  it('filters tasks by status', async () => {
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('tasks-grid'));

    // Pending
    await userEvent.click(screen.getByTestId('tab-pending'));
    expect(screen.getByText('Wall Cabinet')).toBeInTheDocument();
    expect(screen.queryByText('Base Cabinet')).not.toBeInTheDocument();
    expect(screen.queryByText('Drawer Unit')).not.toBeInTheDocument();

    // In Progress
    await userEvent.click(screen.getByTestId('tab-in_progress'));
    expect(screen.getByText('Base Cabinet')).toBeInTheDocument();
    expect(screen.queryByText('Wall Cabinet')).not.toBeInTheDocument();

    // Completed
    await userEvent.click(screen.getByTestId('tab-completed'));
    expect(screen.getByText('Drawer Unit')).toBeInTheDocument();

    // All
    await userEvent.click(screen.getByTestId('tab-all'));
    expect(screen.getByText('Base Cabinet')).toBeInTheDocument();
    expect(screen.getByText('Wall Cabinet')).toBeInTheDocument();
    expect(screen.getByText('Drawer Unit')).toBeInTheDocument();
  });

  // ── Sort ───────────────────────────────────────────────────────────────────
  it('sorts tasks by priority (default)', async () => {
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('tasks-grid'));

    const grid = screen.getByTestId('tasks-grid');
    const cards = grid.querySelectorAll('[data-testid^="task-card-"]');
    // high first, then medium, then low
    expect(cards[0]).toHaveAttribute('data-testid', 'task-card-t1');
    expect(cards[1]).toHaveAttribute('data-testid', 'task-card-t2');
    expect(cards[2]).toHaveAttribute('data-testid', 'task-card-t3');
  });

  it('sorts tasks by name', async () => {
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('tasks-grid'));

    await userEvent.selectOptions(screen.getByTestId('sort-select'), 'name');

    const grid = screen.getByTestId('tasks-grid');
    const cards = grid.querySelectorAll('[data-testid^="task-card-"]');
    // Base Cabinet, Drawer Unit, Wall Cabinet
    expect(cards[0]).toHaveAttribute('data-testid', 'task-card-t1');
    expect(cards[1]).toHaveAttribute('data-testid', 'task-card-t3');
    expect(cards[2]).toHaveAttribute('data-testid', 'task-card-t2');
  });

  it('sorts tasks by status', async () => {
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('tasks-grid'));

    await userEvent.selectOptions(screen.getByTestId('sort-select'), 'status');

    const grid = screen.getByTestId('tasks-grid');
    const cards = grid.querySelectorAll('[data-testid^="task-card-"]');
    // pending first, in_progress, completed
    expect(cards[0]).toHaveAttribute('data-testid', 'task-card-t2');
    expect(cards[1]).toHaveAttribute('data-testid', 'task-card-t1');
    expect(cards[2]).toHaveAttribute('data-testid', 'task-card-t3');
  });

  // ── Mark Complete ────────────────────────────────────────────────────────────
  it('marks task complete via button click', async () => {
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('tasks-grid'));

    await userEvent.click(screen.getByTestId('complete-btn-t1'));

    await waitFor(() => {
      expect(mockMarkPartComplete).toHaveBeenCalledWith('part-1');
    });
  });

  it('does not show complete button for completed tasks', async () => {
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('tasks-grid'));
    expect(screen.queryByTestId('complete-btn-t3')).not.toBeInTheDocument();
  });

  it('shows complete error when mutation fails', async () => {
    mockMarkPartComplete.mockRejectedValue(new Error('Update failed'));
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('tasks-grid'));

    await userEvent.click(screen.getByTestId('complete-btn-t1'));

    await waitFor(() => {
      expect(screen.getByTestId('complete-error')).toBeInTheDocument();
    });
  });

  // ── Empty State ──────────────────────────────────────────────────────────────
  it('shows empty state when no tasks', async () => {
    mockGetAssembly.mockResolvedValue([]);
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('empty-tasks')).toBeInTheDocument();
    });
  });

  // ── API Calls ────────────────────────────────────────────────────────────────
  it('fetches assembly with correct job id', async () => {
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(mockGetAssembly).toHaveBeenCalledWith('job-1');
    });
  });

  it('fetches progress with correct job id', async () => {
    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(mockGetProgress).toHaveBeenCalledWith('job-1');
    });
  });

  // ── Disable button during update ──────────────────────────────────────────────
  it('disables complete button while updating', async () => {
    let resolveComplete: (value: unknown) => void;
    mockMarkPartComplete.mockReturnValue(
      new Promise((res) => {
        resolveComplete = res;
      }),
    );

    render(<ShopAssemblyApp />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('tasks-grid'));

    await userEvent.click(screen.getByTestId('complete-btn-t1'));

    await waitFor(() => {
      expect(screen.getByTestId('complete-btn-t1')).toBeDisabled();
      expect(screen.getByTestId('complete-btn-t1')).toHaveTextContent('Updating…');
    });

    resolveComplete!({ success: true });
    await waitFor(() => {
      expect(screen.getByTestId('complete-btn-t1')).not.toBeDisabled();
    });
  });
});
