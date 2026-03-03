import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CNCOperatorView from './CNCOperatorView';

/* ── mocks ── */
vi.mock('@/services/labels', () => ({
  labelsService: {
    generateLabels: vi.fn(),
    getTemplates: vi.fn(),
    printLabels: vi.fn(),
  },
}));

vi.mock('@/services/shop', () => ({
  shopService: {
    printLabel: vi.fn(),
    addToRemakeBin: vi.fn(),
    markPartComplete: vi.fn(),
    getCutlist: vi.fn(),
    getAssembly: vi.fn(),
    remakeBin: vi.fn(),
    getProgress: vi.fn(),
  },
}));

const mockSheets = [
  {
    id: 'sheet-1',
    width: 2440,
    height: 1220,
    parts: [
      { id: 'p1', name: 'Side Panel', material: 'MDF 18mm', x: 20, y: 20, width: 180, height: 100, grain: 'Horizontal' },
      { id: 'p2', name: 'Bottom', material: 'Plywood 12mm', x: 220, y: 20, width: 160, height: 80 },
      { id: 'p3', name: 'Back Panel', material: 'MDF 3mm', x: 400, y: 20, width: 200, height: 110 },
    ],
  },
  {
    id: 'sheet-2',
    width: 2440,
    height: 1220,
    parts: [
      { id: 'p4', name: 'Door Left', material: 'MDF 18mm', x: 20, y: 20, width: 140, height: 90 },
    ],
  },
];

const mockOptimizerStore = {
  sheets: mockSheets,
  currentSheet: 'sheet-1',
  setCurrentSheet: vi.fn(),
  settings: {},
};

vi.mock('@/store/optimizerStore', () => ({
  useOptimizerStore: () => mockOptimizerStore,
}));

import { labelsService } from '@/services/labels';
import { shopService } from '@/services/shop';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOptimizerStore.sheets = [...mockSheets];
  mockOptimizerStore.currentSheet = 'sheet-1';
  (labelsService.generateLabels as any).mockResolvedValue({});
  (shopService.printLabel as any).mockResolvedValue({});
  (shopService.addToRemakeBin as any).mockResolvedValue({});
  (shopService.markPartComplete as any).mockResolvedValue({});
});

describe('CNCOperatorView', () => {
  it('shows no-sheets message when no sheets', () => {
    mockOptimizerStore.sheets = [];
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    expect(screen.getByTestId('no-sheets')).toBeInTheDocument();
  });

  it('renders sheet list', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    expect(screen.getByTestId('sheet-list')).toBeInTheDocument();
    expect(screen.getByTestId('sheet-item-sheet-1')).toBeInTheDocument();
    expect(screen.getByTestId('sheet-item-sheet-2')).toBeInTheDocument();
  });

  it('clicking sheet sets current sheet', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('sheet-item-sheet-2'));
    expect(mockOptimizerStore.setCurrentSheet).toHaveBeenCalledWith('sheet-2');
  });

  it('displays sheet title with current/total', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    expect(screen.getByTestId('sheet-title')).toHaveTextContent('Sheet 1 of 2');
  });

  it('displays quick stats', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    expect(screen.getByTestId('stat-total-sheets')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-current-sheet')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-cut')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-remaining')).toHaveTextContent('3');
  });

  it('renders sheet viewer with parts', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    expect(screen.getByTestId('sheet-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('part-p1')).toBeInTheDocument();
    expect(screen.getByTestId('part-p2')).toBeInTheDocument();
    expect(screen.getByTestId('part-p3')).toBeInTheDocument();
  });

  it('shows no-parts message when sheet has no parts', () => {
    mockOptimizerStore.sheets = [{ id: 'empty', width: 2440, height: 1220, parts: [] }] as any;
    mockOptimizerStore.currentSheet = 'empty';
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    expect(screen.getByTestId('no-parts')).toBeInTheDocument();
  });

  it('clicking a part shows part details', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('part-p1'));
    expect(screen.getByTestId('part-details')).toBeInTheDocument();
    expect(screen.getByTestId('detail-name')).toHaveTextContent('Side Panel');
    expect(screen.getByTestId('detail-material')).toHaveTextContent('MDF 18mm');
    expect(screen.getByTestId('detail-dimensions')).toHaveTextContent('180 × 100mm');
    expect(screen.getByTestId('detail-grain')).toHaveTextContent('Horizontal');
  });

  it('shows no-part-selected message when nothing selected', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    expect(screen.getByTestId('no-part-selected')).toBeInTheDocument();
  });

  it('clicking same part deselects it', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('part-p1'));
    expect(screen.getByTestId('part-details')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('part-p1'));
    expect(screen.getByTestId('no-part-selected')).toBeInTheDocument();
  });

  it('next sheet button advances', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('next-sheet-btn'));
    expect(mockOptimizerStore.setCurrentSheet).toHaveBeenCalledWith('sheet-2');
  });

  it('prev sheet button disabled on first sheet', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    expect(screen.getByTestId('prev-sheet-btn')).toBeDisabled();
  });

  it('next sheet button disabled on last sheet', () => {
    mockOptimizerStore.currentSheet = 'sheet-2';
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    expect(screen.getByTestId('next-sheet-btn')).toBeDisabled();
  });

  it('print labels button calls labelsService.generateLabels', async () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('print-labels-btn'));
    await waitFor(() => {
      expect(labelsService.generateLabels).toHaveBeenCalledWith(
        expect.objectContaining({
          sheetId: 'sheet-1',
          partIds: ['p1', 'p2', 'p3'],
        }),
      );
    });
  });

  it('shows print success message', async () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('print-labels-btn'));
    await waitFor(() => expect(screen.getByTestId('print-success')).toBeInTheDocument());
  });

  it('shows print error on failure', async () => {
    (labelsService.generateLabels as any).mockRejectedValue(new Error('fail'));
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('print-labels-btn'));
    await waitFor(() => expect(screen.getByTestId('print-error')).toBeInTheDocument());
  });

  it('remake button opens dialog when part selected', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('part-p1'));
    fireEvent.click(screen.getByTestId('remake-btn'));
    expect(screen.getByTestId('remake-dialog')).toBeInTheDocument();
  });

  it('remake button disabled when no part selected', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    expect(screen.getByTestId('remake-btn')).toBeDisabled();
  });

  it('remake dialog submit calls shopService.addToRemakeBin', async () => {
    const user = userEvent.setup();
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('part-p2'));
    fireEvent.click(screen.getByTestId('remake-btn'));
    await user.type(screen.getByTestId('remake-reason'), 'Chip out on edge');
    fireEvent.click(screen.getByTestId('remake-submit'));
    await waitFor(() => {
      expect(shopService.addToRemakeBin).toHaveBeenCalledWith('p2', 'Chip out on edge');
    });
  });

  it('remake submit disabled without reason', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('part-p1'));
    fireEvent.click(screen.getByTestId('remake-btn'));
    expect(screen.getByTestId('remake-submit')).toBeDisabled();
  });

  it('remake cancel closes dialog', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('part-p1'));
    fireEvent.click(screen.getByTestId('remake-btn'));
    fireEvent.click(screen.getByTestId('remake-cancel'));
    expect(screen.queryByTestId('remake-dialog')).not.toBeInTheDocument();
  });

  it('remake error shows message', async () => {
    const user = userEvent.setup();
    (shopService.addToRemakeBin as any).mockRejectedValue(new Error('fail'));
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('part-p1'));
    fireEvent.click(screen.getByTestId('remake-btn'));
    await user.type(screen.getByTestId('remake-reason'), 'Bad cut');
    fireEvent.click(screen.getByTestId('remake-submit'));
    await waitFor(() => expect(screen.getByTestId('remake-error')).toBeInTheDocument());
  });

  it('mark complete calls shopService.markPartComplete', async () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('part-p1'));
    fireEvent.click(screen.getByTestId('mark-complete-btn'));
    await waitFor(() => {
      expect(shopService.markPartComplete).toHaveBeenCalledWith('p1');
    });
  });

  it('mark complete updates cut count', async () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('part-p1'));
    fireEvent.click(screen.getByTestId('mark-complete-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('stat-cut')).toHaveTextContent('1');
      expect(screen.getByTestId('stat-remaining')).toHaveTextContent('2');
    });
  });

  it('print single label calls shopService.printLabel', async () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('part-p2'));
    fireEvent.click(screen.getByTestId('print-single-label-btn'));
    await waitFor(() => {
      expect(shopService.printLabel).toHaveBeenCalledWith('p2');
    });
  });

  it('flag for remake button in detail panel opens dialog', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('part-p3'));
    fireEvent.click(screen.getByTestId('remake-part-detail-btn'));
    expect(screen.getByTestId('remake-dialog')).toBeInTheDocument();
  });

  it('machine status shows operation and time', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    expect(screen.getByTestId('machine-operation')).toHaveTextContent('Cutting');
    expect(screen.getByTestId('machine-time')).toHaveTextContent('12:34');
  });

  it('sheet progress bar renders', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    expect(screen.getByTestId('sheet-progress-bar')).toBeInTheDocument();
  });

  it('next sheet action button works', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('next-sheet-action-btn'));
    expect(mockOptimizerStore.setCurrentSheet).toHaveBeenCalledWith('sheet-2');
  });

  it('part detail shows pending status for uncompleted part', () => {
    render(<CNCOperatorView />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('part-p1'));
    expect(screen.getByTestId('detail-status')).toHaveTextContent('Pending');
  });
});
