import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LabelDesigner from './LabelDesigner';

/* ── mocks ── */
vi.mock('@/services/cutlists', () => ({
  cutlistsService: {
    getCutlist: vi.fn(),
    getBom: vi.fn(),
    getBoq: vi.fn(),
  },
}));

vi.mock('@/services/labels', () => ({
  labelsService: {
    getTemplates: vi.fn(),
    generateLabels: vi.fn(),
    printLabels: vi.fn(),
  },
}));

const mockAppStore = { currentJob: 'job-1', currentRoom: null, selectedProduct: null, unitSystem: 'metric', theme: 'dark' };
vi.mock('@/store/appStore', () => ({
  useAppStore: (sel?: (s: any) => any) => (sel ? sel(mockAppStore) : mockAppStore),
}));

import { cutlistsService } from '@/services/cutlists';
import { labelsService } from '@/services/labels';

const mockTemplates = [
  { id: 'tpl-1', name: 'Standard 100x50', width: 100, height: 50, fields: ['partName', 'material', 'dimensions'] },
  { id: 'tpl-2', name: 'Large 150x75', width: 150, height: 75, fields: ['partName', 'barcode'] },
];

const mockCutlist = Array.from({ length: 15 }, (_, i) => ({
  id: `cut-${i + 1}`,
  partName: `Part ${i + 1}`,
  material: i % 2 === 0 ? 'MDF 18mm' : 'Plywood 12mm',
  length: 600 + i * 10,
  width: 300 + i * 5,
  thickness: i % 2 === 0 ? 18 : 12,
  qty: 1 + (i % 3),
  barcode: `BC${String(i + 1).padStart(6, '0')}`,
  cabinetRef: `CAB-${Math.floor(i / 3) + 1}`,
  grain: i % 2 === 0 ? 'Horizontal' : undefined,
  edgeBanding: i % 3 === 0 ? 'ABS 1mm' : undefined,
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

// Mock window.print and URL methods
const mockPrint = vi.fn();
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:fake-url');
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockAppStore.currentJob = 'job-1';
  (cutlistsService.getCutlist as any).mockResolvedValue(mockCutlist);
  (labelsService.getTemplates as any).mockResolvedValue(mockTemplates);
  (labelsService.printLabels as any).mockResolvedValue({});
  (labelsService.generateLabels as any).mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
  window.print = mockPrint;
  URL.createObjectURL = mockCreateObjectURL;
  URL.revokeObjectURL = mockRevokeObjectURL;
});

describe('LabelDesigner', () => {
  it('shows no-job message when no job selected', () => {
    mockAppStore.currentJob = null as any;
    render(<LabelDesigner />, { wrapper: createWrapper() });
    expect(screen.getByTestId('no-job')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    (cutlistsService.getCutlist as any).mockReturnValue(new Promise(() => {}));
    render(<LabelDesigner />, { wrapper: createWrapper() });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('shows error state on failure', async () => {
    (cutlistsService.getCutlist as any).mockRejectedValue(new Error('fail'));
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('error')).toBeInTheDocument());
  });

  it('shows empty cutlist state', async () => {
    (cutlistsService.getCutlist as any).mockResolvedValue([]);
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('empty-cutlist')).toBeInTheDocument());
  });

  it('renders template selector with options', async () => {
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => {
      const select = screen.getByTestId('template-select');
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue('tpl-1');
    });
  });

  it('changes template selection', async () => {
    const user = userEvent.setup();
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('template-select'));
    await user.selectOptions(screen.getByTestId('template-select'), 'tpl-2');
    expect(screen.getByTestId('template-select')).toHaveValue('tpl-2');
  });

  it('renders field toggles', async () => {
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('toggle-partName')).toBeChecked();
      expect(screen.getByTestId('toggle-material')).toBeChecked();
      expect(screen.getByTestId('toggle-dimensions')).toBeChecked();
      expect(screen.getByTestId('toggle-barcode')).toBeChecked();
      expect(screen.getByTestId('toggle-qrCode')).not.toBeChecked();
    });
  });

  it('toggles field visibility', async () => {
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('toggle-barcode'));
    fireEvent.click(screen.getByTestId('toggle-barcode'));
    expect(screen.getByTestId('toggle-barcode')).not.toBeChecked();
  });

  it('renders label preview grid with first page items', async () => {
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('label-grid')).toBeInTheDocument();
      expect(screen.getByTestId('label-cut-1')).toBeInTheDocument();
      expect(screen.getByTestId('label-cut-12')).toBeInTheDocument();
      // 13th should not be on page 1
      expect(screen.queryByTestId('label-cut-13')).not.toBeInTheDocument();
    });
  });

  it('label shows toggled-on fields', async () => {
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('label-cut-1'));
    expect(screen.getByTestId('label-cut-1')).toHaveTextContent('Part 1');
    expect(screen.getByTestId('label-cut-1')).toHaveTextContent('MDF 18mm');
    expect(screen.getByTestId('barcode-cut-1')).toBeInTheDocument();
  });

  it('label hides toggled-off fields', async () => {
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('label-cut-1'));
    // QR code is off by default
    expect(screen.queryByTestId('qrcode-cut-1')).not.toBeInTheDocument();
  });

  it('toggling qrCode on shows QR on labels', async () => {
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('toggle-qrCode'));
    fireEvent.click(screen.getByTestId('toggle-qrCode'));
    await waitFor(() => expect(screen.getByTestId('qrcode-cut-1')).toBeInTheDocument());
  });

  it('pagination shows correct info', async () => {
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('page-info')).toHaveTextContent('Page 1 of 2');
    });
  });

  it('next page navigates correctly', async () => {
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('next-page'));
    fireEvent.click(screen.getByTestId('next-page'));
    await waitFor(() => {
      expect(screen.getByTestId('page-info')).toHaveTextContent('Page 2 of 2');
      expect(screen.getByTestId('label-cut-13')).toBeInTheDocument();
    });
  });

  it('previous page is disabled on first page', async () => {
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('prev-page')).toBeDisabled();
    });
  });

  it('next page is disabled on last page', async () => {
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('next-page'));
    fireEvent.click(screen.getByTestId('next-page'));
    await waitFor(() => {
      expect(screen.getByTestId('next-page')).toBeDisabled();
    });
  });

  it('print button calls labelsService.printLabels', async () => {
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('print-btn'));
    fireEvent.click(screen.getByTestId('print-btn'));
    await waitFor(() => {
      expect(labelsService.printLabels).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-1',
          templateId: 'tpl-1',
          fields: expect.arrayContaining(['partName', 'material', 'dimensions', 'barcode']),
        }),
      );
    });
  });

  it('print calls window.print on success', async () => {
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('print-btn'));
    fireEvent.click(screen.getByTestId('print-btn'));
    await waitFor(() => expect(mockPrint).toHaveBeenCalled());
  });

  it('shows print success message', async () => {
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('print-btn'));
    fireEvent.click(screen.getByTestId('print-btn'));
    await waitFor(() => expect(screen.getByTestId('print-success')).toBeInTheDocument());
  });

  it('shows print error on failure', async () => {
    (labelsService.printLabels as any).mockRejectedValue(new Error('fail'));
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('print-btn'));
    fireEvent.click(screen.getByTestId('print-btn'));
    await waitFor(() => expect(screen.getByTestId('print-error')).toBeInTheDocument());
  });

  it('export PDF calls labelsService.generateLabels', async () => {
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('export-pdf-btn'));
    fireEvent.click(screen.getByTestId('export-pdf-btn'));
    await waitFor(() => {
      expect(labelsService.generateLabels).toHaveBeenCalled();
    });
  });

  it('export PDF triggers download on success', async () => {
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('export-pdf-btn'));
    fireEvent.click(screen.getByTestId('export-pdf-btn'));
    await waitFor(() => expect(mockCreateObjectURL).toHaveBeenCalled());
  });

  it('shows export error on failure', async () => {
    (labelsService.generateLabels as any).mockRejectedValue(new Error('fail'));
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('export-pdf-btn'));
    fireEvent.click(screen.getByTestId('export-pdf-btn'));
    await waitFor(() => expect(screen.getByTestId('export-error')).toBeInTheDocument());
  });

  it('print settings inputs work', async () => {
    const user = userEvent.setup();
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('input-labelWidth'));
    const widthInput = screen.getByTestId('input-labelWidth');
    await user.clear(widthInput);
    await user.type(widthInput, '120');
    expect(widthInput).toHaveValue(120);
  });

  it('orientation select works', async () => {
    const user = userEvent.setup();
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('input-orientation'));
    await user.selectOptions(screen.getByTestId('input-orientation'), 'portrait');
    expect(screen.getByTestId('input-orientation')).toHaveValue('portrait');
  });

  it('print and export buttons disabled when cutlist empty', async () => {
    (cutlistsService.getCutlist as any).mockResolvedValue([]);
    render(<LabelDesigner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('print-btn')).toBeDisabled();
      expect(screen.getByTestId('export-pdf-btn')).toBeDisabled();
    });
  });
});
