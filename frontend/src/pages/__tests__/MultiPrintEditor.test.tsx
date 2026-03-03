import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MultiPrintEditor from './MultiPrintEditor';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockGetTemplates = vi.fn();
const mockGenerateLabels = vi.fn();
const mockPrintLabels = vi.fn();

vi.mock('@/services/labels', () => ({
  labelsService: {
    getTemplates: (...args: unknown[]) => mockGetTemplates(...args),
    generateLabels: (...args: unknown[]) => mockGenerateLabels(...args),
    printLabels: (...args: unknown[]) => mockPrintLabels(...args),
  },
}));

vi.mock('@/services/shop', () => ({
  shopService: {
    printLabel: vi.fn().mockResolvedValue({ success: true }),
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
const MOCK_TEMPLATES = [
  {
    id: 'tpl-1',
    name: 'Cutlist Labels',
    description: 'Labels for cutlist parts',
    pageSize: 'Letter',
    orientation: 'portrait' as const,
    labelsPerPage: 10,
    category: 'cutlist',
  },
  {
    id: 'tpl-2',
    name: 'Part Labels',
    description: 'Individual part identification labels',
    pageSize: 'Letter',
    orientation: 'landscape' as const,
    labelsPerPage: 8,
    category: 'part',
  },
  {
    id: 'tpl-3',
    name: 'Shipping Labels',
    description: 'Shipping and tracking labels',
    pageSize: 'A4',
    orientation: 'portrait' as const,
    labelsPerPage: 6,
    category: 'shipping',
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
describe('MultiPrintEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeCurrentJob = mockCurrentJob;
    mockGetTemplates.mockResolvedValue(MOCK_TEMPLATES);
    mockGenerateLabels.mockResolvedValue([{ id: 'label-1' }]);
    mockPrintLabels.mockResolvedValue({ success: true });
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // \u2500\u2500 No Job \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  it('shows no-job message when no currentJob', () => {
    storeCurrentJob = null;
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    expect(screen.getByTestId('no-job-message')).toBeInTheDocument();
    expect(screen.getByText('No Job Selected')).toBeInTheDocument();
  });

  // \u2500\u2500 Loading \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  it('shows loading skeleton while fetching templates', () => {
    mockGetTemplates.mockReturnValue(new Promise(() => {}));
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  // \u2500\u2500 Error \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  it('shows error when templates fail to load', async () => {
    mockGetTemplates.mockRejectedValue(new Error('Network error'));
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });
  });

  // \u2500\u2500 Empty State \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  it('shows empty state when no templates', async () => {
    mockGetTemplates.mockResolvedValue([]);
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('empty-presets')).toBeInTheDocument();
    });
  });

  // \u2500\u2500 Render Presets \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  it('renders preset cards after loading', async () => {
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('presets-list')).toBeInTheDocument();
    });
    expect(screen.getByText('Cutlist Labels')).toBeInTheDocument();
    expect(screen.getByText('Part Labels')).toBeInTheDocument();
    expect(screen.getByText('Shipping Labels')).toBeInTheDocument();
  });

  it('displays job name in header', async () => {
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Kitchen Cabinets')).toBeInTheDocument();
    });
  });

  // \u2500\u2500 Preset Details \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  it('shows preset description, page size, and orientation', async () => {
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('presets-list'));

    const card = screen.getByTestId('preset-card-tpl-1');
    expect(card).toHaveTextContent('Labels for cutlist parts');
    expect(card).toHaveTextContent('Letter');
    expect(card).toHaveTextContent('portrait');
  });

  // \u2500\u2500 Select Preset \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  it('selects preset and shows preview panel', async () => {
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('presets-list'));

    // Initially empty preview
    expect(screen.getByTestId('preview-empty')).toBeInTheDocument();

    // Click a preset
    await userEvent.click(screen.getByTestId('preset-card-tpl-1'));

    await waitFor(() => {
      expect(screen.getByTestId('preview-panel')).toBeInTheDocument();
    });
    expect(screen.getByTestId('preview-panel')).toHaveTextContent('Cutlist Labels');
  });

  // \u2500\u2500 Print Single Preset \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  it('prints a single preset', async () => {
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('presets-list'));

    await userEvent.click(screen.getByTestId('print-btn-tpl-1'));

    await waitFor(() => {
      expect(mockGenerateLabels).toHaveBeenCalledWith({
        templateId: 'tpl-1',
        jobId: 'job-1',
        copies: 1,
      });
    });

    await waitFor(() => {
      expect(mockPrintLabels).toHaveBeenCalledWith({
        labels: [{ id: 'label-1' }],
        printer: '',
      });
    });
  });

  it('shows print success message', async () => {
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('presets-list'));

    await userEvent.click(screen.getByTestId('print-btn-tpl-1'));

    await waitFor(() => {
      expect(screen.getByTestId('print-success')).toBeInTheDocument();
    });
  });

  it('shows print error when single print fails', async () => {
    mockGenerateLabels.mockRejectedValue(new Error('Print fail'));
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('presets-list'));

    await userEvent.click(screen.getByTestId('print-btn-tpl-1'));

    await waitFor(() => {
      expect(screen.getByTestId('print-error')).toBeInTheDocument();
    });
  });

  // \u2500\u2500 Print All \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  it('prints all presets with Print All button', async () => {
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('presets-list'));

    await userEvent.click(screen.getByTestId('print-all-btn'));

    await waitFor(() => {
      // generateLabels called once per preset
      expect(mockGenerateLabels).toHaveBeenCalledTimes(3);
      expect(mockPrintLabels).toHaveBeenCalledTimes(3);
    });
  });

  it('disables Print All when no presets', async () => {
    mockGetTemplates.mockResolvedValue([]);
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('empty-presets'));
    expect(screen.getByTestId('print-all-btn')).toBeDisabled();
  });

  it('shows print all success message', async () => {
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('presets-list'));

    await userEvent.click(screen.getByTestId('print-all-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('print-all-success')).toBeInTheDocument();
    });
  });

  it('shows print all error when batch fails', async () => {
    mockGenerateLabels.mockRejectedValue(new Error('Batch fail'));
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('presets-list'));

    await userEvent.click(screen.getByTestId('print-all-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('print-all-error')).toBeInTheDocument();
    });
  });

  // \u2500\u2500 Settings Panel \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  it('renders settings panel with default values', async () => {
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('settings-panel'));

    expect(screen.getByTestId('printer-input')).toHaveValue('');
    expect(screen.getByTestId('copies-input')).toHaveValue(1);
    expect(screen.getByTestId('label-width-input')).toHaveValue(4);
    expect(screen.getByTestId('label-height-input')).toHaveValue(2);
  });

  it('updates settings values', async () => {
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('settings-panel'));

    const printerInput = screen.getByTestId('printer-input');
    await userEvent.type(printerInput, 'Zebra ZT411');
    expect(printerInput).toHaveValue('Zebra ZT411');

    const copiesInput = screen.getByTestId('copies-input');
    await userEvent.clear(copiesInput);
    await userEvent.type(copiesInput, '5');
    expect(copiesInput).toHaveValue(5);
  });

  it('persists settings to localStorage', async () => {
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('settings-panel'));

    await userEvent.type(screen.getByTestId('printer-input'), 'TestPrinter');

    await waitFor(() => {
      const stored = localStorage.getItem('cnc_print_settings');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.printer).toBe('TestPrinter');
    });
  });

  // \u2500\u2500 Settings affect print call \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  it('uses settings copies value when printing', async () => {
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('presets-list'));

    // Change copies to 3
    const copiesInput = screen.getByTestId('copies-input');
    await userEvent.clear(copiesInput);
    await userEvent.type(copiesInput, '3');

    // Set printer
    await userEvent.type(screen.getByTestId('printer-input'), 'MyPrinter');

    // Print
    await userEvent.click(screen.getByTestId('print-btn-tpl-2'));

    await waitFor(() => {
      expect(mockGenerateLabels).toHaveBeenCalledWith({
        templateId: 'tpl-2',
        jobId: 'job-1',
        copies: 3,
      });
      expect(mockPrintLabels).toHaveBeenCalledWith({
        labels: [{ id: 'label-1' }],
        printer: 'MyPrinter',
      });
    });
  });

  // \u2500\u2500 Preview Panel \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  it('shows empty preview initially', async () => {
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('presets-list'));
    expect(screen.getByTestId('preview-empty')).toBeInTheDocument();
  });

  it('shows preview details when preset selected', async () => {
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('presets-list'));

    await userEvent.click(screen.getByTestId('preset-card-tpl-2'));

    await waitFor(() => {
      const preview = screen.getByTestId('preview-panel');
      expect(preview).toHaveTextContent('Part Labels');
      expect(preview).toHaveTextContent('Letter');
      expect(preview).toHaveTextContent('landscape');
      expect(preview).toHaveTextContent('8 labels/page');
    });
  });

  // \u2500\u2500 Page Count Display \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  it('displays page count on preset cards', async () => {
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('presets-list'));

    const card = screen.getByTestId('preset-card-tpl-1');
    expect(card).toHaveTextContent('1 page');
  });

  // \u2500\u2500 Loading state per print button \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  it('shows loading text on print button during print', async () => {
    let resolvePrint: (value: unknown) => void;
    mockPrintLabels.mockReturnValue(
      new Promise((res) => {
        resolvePrint = res;
      }),
    );

    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('presets-list'));

    await userEvent.click(screen.getByTestId('print-btn-tpl-1'));

    await waitFor(() => {
      expect(screen.getByTestId('print-btn-tpl-1')).toHaveTextContent('Printing\u2026');
      expect(screen.getByTestId('print-btn-tpl-1')).toBeDisabled();
    });

    resolvePrint!({ success: true });
    await waitFor(() => {
      expect(screen.getByTestId('print-btn-tpl-1')).toHaveTextContent('Print');
    });
  });

  // \u2500\u2500 Print All loading state \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  it('shows loading state on Print All button', async () => {
    let resolvePrint: (value: unknown) => void;
    mockPrintLabels.mockReturnValue(
      new Promise((res) => {
        resolvePrint = res;
      }),
    );

    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('presets-list'));

    await userEvent.click(screen.getByTestId('print-all-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('print-all-btn')).toHaveTextContent('Printing All\u2026');
      expect(screen.getByTestId('print-all-btn')).toBeDisabled();
    });

    resolvePrint!({ success: true });
  });

  // \u2500\u2500 API calls fetch templates \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  it('fetches label templates on mount', async () => {
    render(<MultiPrintEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(mockGetTemplates).toHaveBeenCalled();
    });
  });
});
