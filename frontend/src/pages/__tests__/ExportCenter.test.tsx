import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ExportCenter from './ExportCenter';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockGetExportFormats = vi.fn();
const mockExportJob = vi.fn();
const mockExportCutlist = vi.fn();
const mockExportGcode = vi.fn();

vi.mock('@/services/exports', () => ({
  exportsService: {
    getExportFormats: (...args: unknown[]) => mockGetExportFormats(...args),
    exportJob: (...args: unknown[]) => mockExportJob(...args),
    exportCutlist: (...args: unknown[]) => mockExportCutlist(...args),
    exportGcode: (...args: unknown[]) => mockExportGcode(...args),
  },
}));

const mockCurrentJob = { id: 'job-1', name: 'Kitchen Cabinets' };
let storeCurrentJob: typeof mockCurrentJob | null = mockCurrentJob;

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ currentJob: storeCurrentJob }),
}));

vi.mock('@/store/useOptimizerStore', () => ({
  useOptimizerStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ currentSheet: { id: 'sheet-1' }, sheets: [], settings: {} }),
}));

// Mock URL.createObjectURL / revokeObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: () => 'mock-uuid' },
  writable: true,
});

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const MOCK_FORMATS = [
  { id: 'csv', name: 'CSV', description: 'Comma-separated values', extension: 'csv', category: 'job', icon: '📊', hasOptions: true },
  { id: 'dxf', name: 'DXF', description: 'AutoCAD drawing exchange', extension: 'dxf', category: 'job', icon: '📐', hasOptions: true },
  { id: 'pdf', name: 'PDF', description: 'Portable Document Format', extension: 'pdf', category: 'cutlist', icon: '📄', hasOptions: true },
  { id: 'gcode', name: 'G-Code', description: 'CNC machine instructions', extension: 'gcode', category: 'gcode', icon: '⚙️', hasOptions: false },
  { id: 'json', name: 'JSON', description: 'JavaScript Object Notation', extension: 'json', category: 'job', icon: '🔧', hasOptions: false },
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
describe('ExportCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeCurrentJob = mockCurrentJob;
    mockGetExportFormats.mockResolvedValue(MOCK_FORMATS);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ── No Job Selected ──────────────────────────────────────────────────────
  it('shows no-job message when no currentJob is set', () => {
    storeCurrentJob = null;
    render(<ExportCenter />, { wrapper: createWrapper() });
    expect(screen.getByTestId('no-job-message')).toBeInTheDocument();
    expect(screen.getByText('No Job Selected')).toBeInTheDocument();
  });

  // ── Loading State ────────────────────────────────────────────────────────
  it('shows loading skeleton while formats are fetching', () => {
    mockGetExportFormats.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ExportCenter />, { wrapper: createWrapper() });
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  // ── Error State ──────────────────────────────────────────────────────────
  it('shows error message when formats fail to load', async () => {
    mockGetExportFormats.mockRejectedValue(new Error('Network error'));
    render(<ExportCenter />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });
  });

  // ── Empty Formats ────────────────────────────────────────────────────────
  it('shows empty state when no formats are available', async () => {
    mockGetExportFormats.mockResolvedValue([]);
    render(<ExportCenter />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('empty-formats')).toBeInTheDocument();
    });
  });

  // ── Render Format Cards ──────────────────────────────────────────────────
  it('renders format cards after loading', async () => {
    render(<ExportCenter />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('formats-grid')).toBeInTheDocument();
    });
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('DXF')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('G-Code')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
  });

  it('displays current job name in header', async () => {
    render(<ExportCenter />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Kitchen Cabinets')).toBeInTheDocument();
    });
  });

  // ── Basic Export (no options) ────────────────────────────────────────────
  it('exports a job format directly when no options needed', async () => {
    const blob = new Blob(['{}'], { type: 'application/json' });
    mockExportJob.mockResolvedValue(blob);

    render(<ExportCenter />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('formats-grid'));

    const btn = screen.getByTestId('export-btn-json');
    await userEvent.click(btn);

    await waitFor(() => {
      expect(mockExportJob).toHaveBeenCalledWith('job-1', 'json', undefined);
    });
    expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
  });

  // ── G-Code Export ────────────────────────────────────────────────────────
  it('exports G-Code using exportGcode with sheet id', async () => {
    const blob = new Blob(['G0 X0 Y0'], { type: 'text/plain' });
    mockExportGcode.mockResolvedValue(blob);

    render(<ExportCenter />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('formats-grid'));

    await userEvent.click(screen.getByTestId('export-btn-gcode'));

    await waitFor(() => {
      expect(mockExportGcode).toHaveBeenCalledWith('sheet-1');
    });
  });

  // ── Cutlist Export ───────────────────────────────────────────────────────
  it('exports cutlist format using exportCutlist', async () => {
    const blob = new Blob(['cutlist data'], { type: 'application/pdf' });
    mockExportCutlist.mockResolvedValue(blob);

    render(<ExportCenter />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('formats-grid'));

    // PDF is category 'cutlist', but has options so open dialog first
    await userEvent.click(screen.getByTestId('export-btn-pdf'));
    // Confirm from dialog
    await waitFor(() => screen.getByTestId('options-dialog'));
    await userEvent.click(screen.getByTestId('confirm-export-btn'));

    await waitFor(() => {
      expect(mockExportCutlist).toHaveBeenCalledWith('job-1', 'pdf');
    });
  });

  // ── Options Dialog - DXF ─────────────────────────────────────────────────
  it('opens options dialog for DXF and submits with layers', async () => {
    const blob = new Blob(['dxf content']);
    mockExportJob.mockResolvedValue(blob);

    render(<ExportCenter />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('formats-grid'));

    await userEvent.click(screen.getByTestId('export-btn-dxf'));
    await waitFor(() => screen.getByTestId('options-dialog'));

    const layersInput = screen.getByTestId('layers-input');
    await userEvent.type(layersInput, 'cuts, labels');
    await userEvent.click(screen.getByTestId('confirm-export-btn'));

    await waitFor(() => {
      expect(mockExportJob).toHaveBeenCalledWith('job-1', 'dxf', { layers: ['cuts', 'labels'] });
    });
  });

  // ── Options Dialog - CSV ─────────────────────────────────────────────────
  it('opens options dialog for CSV with delimiter and headers', async () => {
    const blob = new Blob(['a,b,c']);
    mockExportJob.mockResolvedValue(blob);

    render(<ExportCenter />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('formats-grid'));

    await userEvent.click(screen.getByTestId('export-btn-csv'));
    await waitFor(() => screen.getByTestId('options-dialog'));

    expect(screen.getByTestId('delimiter-select')).toBeInTheDocument();
    expect(screen.getByTestId('include-headers-checkbox')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('confirm-export-btn'));

    await waitFor(() => {
      expect(mockExportJob).toHaveBeenCalled();
    });
  });

  // ── Options Dialog Cancel ────────────────────────────────────────────────
  it('cancels the options dialog without exporting', async () => {
    render(<ExportCenter />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('formats-grid'));

    await userEvent.click(screen.getByTestId('export-btn-dxf'));
    await waitFor(() => screen.getByTestId('options-dialog'));

    await userEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('options-dialog')).not.toBeInTheDocument();
    expect(mockExportJob).not.toHaveBeenCalled();
  });

  // ── PDF Options ──────────────────────────────────────────────────────────
  it('shows page size and orientation for PDF format', async () => {
    render(<ExportCenter />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('formats-grid'));

    await userEvent.click(screen.getByTestId('export-btn-pdf'));
    await waitFor(() => screen.getByTestId('options-dialog'));

    expect(screen.getByTestId('page-size-select')).toBeInTheDocument();
    expect(screen.getByTestId('orientation-select')).toBeInTheDocument();
  });

  // ── Export Error ─────────────────────────────────────────────────────────
  it('shows export error when mutation fails', async () => {
    mockExportJob.mockRejectedValue(new Error('Server error'));

    render(<ExportCenter />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('formats-grid'));

    await userEvent.click(screen.getByTestId('export-btn-json'));

    await waitFor(() => {
      expect(screen.getByTestId('export-error')).toBeInTheDocument();
    });
    expect(screen.getByText(/Server error/)).toBeInTheDocument();
  });

  // ── Export History ───────────────────────────────────────────────────────
  it('toggles export history panel', async () => {
    render(<ExportCenter />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('formats-grid'));

    expect(screen.queryByTestId('history-panel')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('toggle-history-btn'));
    expect(screen.getByTestId('history-panel')).toBeInTheDocument();
    expect(screen.getByTestId('empty-history')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('toggle-history-btn'));
    expect(screen.queryByTestId('history-panel')).not.toBeInTheDocument();
  });

  it('adds entry to history after successful export', async () => {
    const blob = new Blob(['data']);
    mockExportJob.mockResolvedValue(blob);

    render(<ExportCenter />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('formats-grid'));

    await userEvent.click(screen.getByTestId('export-btn-json'));
    await waitFor(() => expect(mockExportJob).toHaveBeenCalled());

    // Open history
    await userEvent.click(screen.getByTestId('toggle-history-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('history-list')).toBeInTheDocument();
    });
    expect(screen.getByText('JSON')).toBeInTheDocument();
  });

  it('clears export history', async () => {
    const blob = new Blob(['data']);
    mockExportJob.mockResolvedValue(blob);

    render(<ExportCenter />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('formats-grid'));

    // Do an export
    await userEvent.click(screen.getByTestId('export-btn-json'));
    await waitFor(() => expect(mockExportJob).toHaveBeenCalled());

    // Open history, clear it
    await userEvent.click(screen.getByTestId('toggle-history-btn'));
    await waitFor(() => screen.getByTestId('history-list'));

    await userEvent.click(screen.getByTestId('clear-history-btn'));
    expect(screen.getByTestId('empty-history')).toBeInTheDocument();
  });

  // ── LocalStorage persistence ─────────────────────────────────────────────
  it('persists history to localStorage', async () => {
    const blob = new Blob(['data']);
    mockExportJob.mockResolvedValue(blob);

    render(<ExportCenter />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('formats-grid'));

    await userEvent.click(screen.getByTestId('export-btn-json'));
    await waitFor(() => expect(mockExportJob).toHaveBeenCalled());

    await waitFor(() => {
      const stored = localStorage.getItem('cnc_export_history');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].formatName).toBe('JSON');
    });
  });

  // ── Loading state per card ─────────────────────────────────────────────────
  it('shows loading spinner on the exporting card button', async () => {
    let resolveExport: (value: Blob) => void;
    mockExportJob.mockReturnValue(
      new Promise<Blob>((res) => {
        resolveExport = res;
      }),
    );

    render(<ExportCenter />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('formats-grid'));

    await userEvent.click(screen.getByTestId('export-btn-json'));

    await waitFor(() => {
      expect(screen.getByText('Exporting…')).toBeInTheDocument();
    });

    // The button should be disabled during export
    expect(screen.getByTestId('export-btn-json')).toBeDisabled();

    // Resolve the export
    resolveExport!(new Blob(['done']));
    await waitFor(() => {
      expect(screen.queryByText('Exporting…')).not.toBeInTheDocument();
    });
  });
});
