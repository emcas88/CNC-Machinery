import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FlipsideMachining from './FlipsideMachining';

/* ── mocks ── */
vi.mock('@/services/gcode', () => ({
  gcodeService: {
    generate: vi.fn(),
    simulate: vi.fn(),
    validate: vi.fn(),
    getSpoilboardProgram: vi.fn(),
    exportNc: vi.fn(),
  },
}));

const mockSheets = [
  {
    id: 'sheet-1',
    width: 2440,
    height: 1220,
    parts: [
      { id: 'part-1', name: 'Side Panel A', flipsideOp: 'drilling', needsFlipside: true },
      { id: 'part-2', name: 'Bottom Panel', flipsideOp: 'dado', needsFlipside: true },
      { id: 'part-3', name: 'Top Panel', flipsideOp: 'none', needsFlipside: false },
    ],
  },
  {
    id: 'sheet-2',
    width: 2440,
    height: 1220,
    parts: [
      { id: 'part-4', name: 'Door Left', flipsideOp: 'hinge_bore', needsFlipside: true },
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

import { gcodeService } from '@/services/gcode';

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
  (gcodeService.generate as any).mockResolvedValue({ gcode: 'G28\nG0 X0 Y0\nG1 Z-3 F3000' });
  (gcodeService.simulate as any).mockResolvedValue({ toolpath: [{ x: 0, y: 0 }, { x: 100, y: 0 }] });
});

describe('FlipsideMachining', () => {
  it('shows no-sheets message when no sheets', () => {
    mockOptimizerStore.sheets = [];
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    expect(screen.getByTestId('no-sheets')).toBeInTheDocument();
  });

  it('renders sheet list', () => {
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    expect(screen.getByTestId('sheet-list')).toBeInTheDocument();
    expect(screen.getByTestId('sheet-item-sheet-1')).toBeInTheDocument();
    expect(screen.getByTestId('sheet-item-sheet-2')).toBeInTheDocument();
  });

  it('shows pending status for sheets without generated gcode', () => {
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    expect(screen.getByTestId('status-pending-sheet-1')).toBeInTheDocument();
    expect(screen.getByTestId('status-pending-sheet-2')).toBeInTheDocument();
  });

  it('sheet selector calls setCurrentSheet', () => {
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('sheet-item-sheet-2'));
    expect(mockOptimizerStore.setCurrentSheet).toHaveBeenCalledWith('sheet-2');
  });

  it('renders flipside operations table for current sheet', () => {
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    expect(screen.getByTestId('operations-table')).toBeInTheDocument();
    expect(screen.getByText('Side Panel A')).toBeInTheDocument();
    expect(screen.getByText('Bottom Panel')).toBeInTheDocument();
    // Top Panel has needsFlipside: false, should not be in the table
    // (it's filtered — only needsFlipside shown)
  });

  it('shows no operations message when no flipside ops needed', () => {
    mockOptimizerStore.sheets = [{
      id: 'sheet-empty',
      width: 2440,
      height: 1220,
      parts: [{ id: 'p1', name: 'P1', flipsideOp: 'none', needsFlipside: false }],
    }] as any;
    mockOptimizerStore.currentSheet = 'sheet-empty';
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    expect(screen.getByTestId('no-operations')).toBeInTheDocument();
  });

  it('renders flipside settings panel with correct defaults', () => {
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    expect(screen.getByTestId('input-zDepth')).toHaveValue(-3);
    expect(screen.getByTestId('input-feedRate')).toHaveValue(3000);
    expect(screen.getByTestId('input-spindleSpeed')).toHaveValue(18000);
    expect(screen.getByTestId('input-tool')).toHaveValue('flat_6mm');
  });

  it('updates settings when changed', async () => {
    const user = userEvent.setup();
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    const feedInput = screen.getByTestId('input-feedRate');
    await user.clear(feedInput);
    await user.type(feedInput, '5000');
    expect(feedInput).toHaveValue(5000);
  });

  it('tool selection changes value', async () => {
    const user = userEvent.setup();
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    await user.selectOptions(screen.getByTestId('input-tool'), 'ball_6mm');
    expect(screen.getByTestId('input-tool')).toHaveValue('ball_6mm');
  });

  it('generate button calls gcodeService.generate', async () => {
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('generate-btn'));
    await waitFor(() => {
      expect(gcodeService.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          sheetId: 'sheet-1',
          mode: 'flipside',
          settings: expect.objectContaining({
            zDepth: -3,
            feedRate: 3000,
            spindleSpeed: 18000,
            tool: 'flat_6mm',
          }),
        }),
      );
    });
  });

  it('shows gcode preview after generation', async () => {
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('generate-btn'));
    await waitFor(() => expect(screen.getByTestId('gcode-preview')).toBeInTheDocument());
    expect(screen.getByText(/G28/)).toBeInTheDocument();
  });

  it('shows generated status after generation', async () => {
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('generate-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('status-generated-sheet-1')).toBeInTheDocument();
    });
  });

  it('shows generate success message', async () => {
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('generate-btn'));
    await waitFor(() => expect(screen.getByTestId('generate-success')).toBeInTheDocument());
  });

  it('shows generate error on failure', async () => {
    (gcodeService.generate as any).mockRejectedValue(new Error('CNC error'));
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('generate-btn'));
    await waitFor(() => expect(screen.getByTestId('generate-error')).toBeInTheDocument());
  });

  it('preview button is disabled until gcode exists', () => {
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    expect(screen.getByTestId('preview-btn')).toBeDisabled();
  });

  it('preview button calls gcodeService.simulate after generation', async () => {
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('generate-btn'));
    await waitFor(() => screen.getByTestId('gcode-preview'));
    fireEvent.click(screen.getByTestId('preview-btn'));
    await waitFor(() => {
      expect(gcodeService.simulate).toHaveBeenCalled();
    });
  });

  it('shows simulation view after preview', async () => {
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('generate-btn'));
    await waitFor(() => screen.getByTestId('gcode-preview'));
    fireEvent.click(screen.getByTestId('preview-btn'));
    await waitFor(() => expect(screen.getByTestId('simulation-view')).toBeInTheDocument());
  });

  it('shows simulate error on failure', async () => {
    (gcodeService.simulate as any).mockRejectedValue(new Error('sim fail'));
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByTestId('generate-btn'));
    await waitFor(() => screen.getByTestId('gcode-preview'));
    fireEvent.click(screen.getByTestId('preview-btn'));
    await waitFor(() => expect(screen.getByTestId('simulate-error')).toBeInTheDocument());
  });

  it('displays summary stats correctly', () => {
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    expect(screen.getByTestId('stat-total-sheets')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-generated')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-remaining')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-ops')).toHaveTextContent('2');
  });

  it('generate button disabled when no current sheet', () => {
    mockOptimizerStore.currentSheet = null as any;
    render(<FlipsideMachining />, { wrapper: createWrapper() });
    expect(screen.getByTestId('generate-btn')).toBeDisabled();
  });
});
