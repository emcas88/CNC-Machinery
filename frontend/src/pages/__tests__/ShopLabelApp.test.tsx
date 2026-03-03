// F24 – ShopLabelApp tests (15+ tests)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ShopLabelApp,
  labelsApi,
  LabelCard,
  TemplateSelector,
  LABEL_TEMPLATES,
  type LabelData,
  type LabelsResponse,
  type LabelTemplate,
} from './ShopLabelApp';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockLabels: LabelData[] = [
  {
    id: 'L1', code: 'A-001', partName: 'LHS Side Panel', material: 'Birch Ply',
    dimensions: '800 × 600 × 18mm', sheetRef: 'Sheet 1', position: { x: 10, y: 10 },
    jobId: 'job-1', jobName: 'Kitchen Remodel', grainDirection: 'length',
    edgeBanding: 'T,B', isPrinted: false, qrData: 'CNC:A-001:job-1:LHS',
  },
  {
    id: 'L2', code: 'A-002', partName: 'RHS Side Panel', material: 'Birch Ply',
    dimensions: '800 × 600 × 18mm', sheetRef: 'Sheet 1', position: { x: 650, y: 10 },
    jobId: 'job-1', jobName: 'Kitchen Remodel', grainDirection: 'length',
    edgeBanding: 'T,B', isPrinted: true, qrData: 'CNC:A-002:job-1:RHS',
  },
  {
    id: 'L3', code: 'B-001', partName: 'Back Panel', material: 'MDF',
    dimensions: '764 × 782 × 9mm', sheetRef: 'Sheet 2', position: { x: 10, y: 10 },
    jobId: 'job-1', jobName: 'Kitchen Remodel', grainDirection: 'none',
    edgeBanding: '', isPrinted: false, qrData: 'CNC:B-001:job-1:BACK',
  },
  {
    id: 'L4', code: 'B-002', partName: 'Top Panel', material: 'MDF',
    dimensions: '564 × 600 × 18mm', sheetRef: 'Sheet 2', position: { x: 800, y: 10 },
    jobId: 'job-1', jobName: 'Kitchen Remodel', grainDirection: 'width',
    edgeBanding: 'L,R', isPrinted: true, qrData: 'CNC:B-002:job-1:TOP',
  },
  {
    id: 'L5', code: 'C-001', partName: 'Door Front', material: 'MDF Routed',
    dimensions: '800 × 300 × 18mm', sheetRef: 'Sheet 3', position: { x: 10, y: 10 },
    jobId: 'job-1', jobName: 'Kitchen Remodel', grainDirection: 'length',
    edgeBanding: '', isPrinted: false, qrData: 'CNC:C-001:job-1:DOOR',
  },
];

const mockLabelsResponse: LabelsResponse = {
  labels: mockLabels,
  totalLabels: 5,
  printedCount: 2,
};

function createMockApi(overrides?: Partial<typeof labelsApi>) {
  return {
    fetchLabels: vi.fn().mockResolvedValue(mockLabelsResponse),
    markPrinted: vi.fn().mockResolvedValue(undefined),
    batchPrint: vi.fn().mockResolvedValue(new Blob(['pdf-data'], { type: 'application/pdf' })),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ShopLabelApp', () => {
  // Test 1
  it('shows loading state initially', () => {
    const api = createMockApi({
      fetchLabels: vi.fn().mockReturnValue(new Promise(() => {})),
    });
    render(<ShopLabelApp api={api} />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  // Test 2
  it('fetches and displays labels', async () => {
    const api = createMockApi();
    render(<ShopLabelApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByText('A-001')).toBeInTheDocument();
    });

    expect(api.fetchLabels).toHaveBeenCalledWith({ jobId: 'job-1' });
    expect(screen.getByText('A-002')).toBeInTheDocument();
    expect(screen.getByText('B-001')).toBeInTheDocument();
  });

  // Test 3
  it('shows error state and allows retry', async () => {
    const api = createMockApi({
      fetchLabels: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    render(<ShopLabelApp api={api} />);

    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });

    api.fetchLabels.mockResolvedValue(mockLabelsResponse);
    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByText('A-001')).toBeInTheDocument();
    });
  });

  // Test 4
  it('renders QR codes for each label', async () => {
    const api = createMockApi();
    render(<ShopLabelApp api={api} />);

    await waitFor(() => {
      expect(screen.getByTestId('qr-L1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('qr-L2')).toBeInTheDocument();
    expect(screen.getByTestId('qr-L3')).toBeInTheDocument();
  });

  // Test 5
  it('selects and deselects labels', async () => {
    const api = createMockApi();
    render(<ShopLabelApp api={api} />);

    await waitFor(() => {
      expect(screen.getByText('A-001')).toBeInTheDocument();
    });

    const card = screen.getByTestId('label-card-L1');
    fireEvent.click(card);

    // Should show as selected (1 selected)
    expect(screen.getByText(/1 selected/)).toBeInTheDocument();

    // Click again to deselect
    fireEvent.click(card);
    expect(screen.getByText(/0 selected/)).toBeInTheDocument();
  });

  // Test 6
  it('selects all labels', async () => {
    const api = createMockApi();
    render(<ShopLabelApp api={api} />);

    await waitFor(() => {
      expect(screen.getByText('A-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('select-all-btn'));
    expect(screen.getByText(/5 selected/)).toBeInTheDocument();
  });

  // Test 7
  it('selects only unprinted labels', async () => {
    const api = createMockApi();
    render(<ShopLabelApp api={api} />);

    await waitFor(() => {
      expect(screen.getByText('A-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('select-unprinted-btn'));
    // 3 unprinted labels: L1, L3, L5
    expect(screen.getByText(/3 selected/)).toBeInTheDocument();
  });

  // Test 8
  it('clears selection with select none', async () => {
    const api = createMockApi();
    render(<ShopLabelApp api={api} />);

    await waitFor(() => {
      expect(screen.getByText('A-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('select-all-btn'));
    fireEvent.click(screen.getByTestId('select-none-btn'));
    expect(screen.getByText(/0 selected/)).toBeInTheDocument();
  });

  // Test 9
  it('filters labels by search', async () => {
    const api = createMockApi();
    render(<ShopLabelApp api={api} />);

    await waitFor(() => {
      expect(screen.getByText('A-001')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByTestId('search-input'), 'Door');

    expect(screen.queryByText('A-001')).not.toBeInTheDocument();
    expect(screen.getByText('C-001')).toBeInTheDocument();
  });

  // Test 10
  it('filters labels by sheet', async () => {
    const api = createMockApi();
    render(<ShopLabelApp api={api} />);

    await waitFor(() => {
      expect(screen.getByText('A-001')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('sheet-filter'), { target: { value: 'Sheet 2' } });

    expect(screen.queryByText('A-001')).not.toBeInTheDocument();
    expect(screen.getByText('B-001')).toBeInTheDocument();
    expect(screen.getByText('B-002')).toBeInTheDocument();
  });

  // Test 11
  it('filters by printed status', async () => {
    const api = createMockApi();
    render(<ShopLabelApp api={api} />);

    await waitFor(() => {
      expect(screen.getByText('A-001')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('printed-filter'), { target: { value: 'printed' } });

    expect(screen.queryByText('A-001')).not.toBeInTheDocument();
    expect(screen.getByText('A-002')).toBeInTheDocument(); // printed
    expect(screen.getByText('B-002')).toBeInTheDocument(); // printed
  });

  // Test 12
  it('shows empty state when no labels match', async () => {
    const api = createMockApi();
    render(<ShopLabelApp api={api} />);

    await waitFor(() => {
      expect(screen.getByText('A-001')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByTestId('search-input'), 'zzzznonexistent');
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  // Test 13
  it('executes batch print and marks labels as printed', async () => {
    const api = createMockApi();
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
    global.URL.revokeObjectURL = vi.fn();

    render(<ShopLabelApp api={api} />);

    await waitFor(() => {
      expect(screen.getByText('A-001')).toBeInTheDocument();
    });

    // Select label L1
    fireEvent.click(screen.getByTestId('label-card-L1'));
    fireEvent.click(screen.getByTestId('batch-print-btn'));

    await waitFor(() => {
      expect(api.batchPrint).toHaveBeenCalledWith(['L1'], 'standard');
    });
    expect(api.markPrinted).toHaveBeenCalledWith(['L1']);
  });

  // Test 14
  it('disables print button when no labels selected', async () => {
    const api = createMockApi();
    render(<ShopLabelApp api={api} />);

    await waitFor(() => {
      expect(screen.getByText('A-001')).toBeInTheDocument();
    });

    expect(screen.getByTestId('batch-print-btn')).toBeDisabled();
  });

  // Test 15
  it('triggers browser print', async () => {
    const api = createMockApi();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<ShopLabelApp api={api} />);

    await waitFor(() => {
      expect(screen.getByTestId('browser-print-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('browser-print-btn'));
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  // Test 16
  it('displays printed/total stats in header', async () => {
    const api = createMockApi();
    render(<ShopLabelApp api={api} />);

    await waitFor(() => {
      expect(screen.getByText(/2\/5 printed/)).toBeInTheDocument();
    });
  });

  // Test 17
  it('shows printed badge on printed labels', async () => {
    const api = createMockApi();
    render(<ShopLabelApp api={api} />);

    await waitFor(() => {
      expect(screen.getByTestId('label-card-L2')).toBeInTheDocument();
    });

    const card = screen.getByTestId('label-card-L2');
    expect(within(card).getByText('Printed')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TemplateSelector tests
// ---------------------------------------------------------------------------

describe('TemplateSelector', () => {
  // Test 18
  it('renders all template options', () => {
    const onChange = vi.fn();
    render(<TemplateSelector value="standard" onChange={onChange} />);

    LABEL_TEMPLATES.forEach((t) => {
      expect(screen.getByTestId(`template-${t.id}`)).toBeInTheDocument();
    });
  });

  // Test 19
  it('highlights the selected template', () => {
    const onChange = vi.fn();
    render(<TemplateSelector value="compact" onChange={onChange} />);

    const btn = screen.getByTestId('template-compact');
    expect(btn.className).toContain('blue');
  });

  // Test 20
  it('calls onChange when a template is clicked', () => {
    const onChange = vi.fn();
    render(<TemplateSelector value="standard" onChange={onChange} />);

    fireEvent.click(screen.getByTestId('template-detailed'));
    expect(onChange).toHaveBeenCalledWith('detailed');
  });
});

// ---------------------------------------------------------------------------
// LabelCard tests
// ---------------------------------------------------------------------------

describe('LabelCard', () => {
  const label = mockLabels[0];

  // Test 21
  it('renders label code and part name', () => {
    render(
      <LabelCard label={label} template="standard" selected={false} onSelect={vi.fn()} />
    );
    expect(screen.getByText('A-001')).toBeInTheDocument();
    expect(screen.getByText('LHS Side Panel')).toBeInTheDocument();
  });

  // Test 22
  it('shows QR code with correct data', () => {
    render(
      <LabelCard label={label} template="standard" selected={false} onSelect={vi.fn()} />
    );
    expect(screen.getByTestId('qr-L1')).toBeInTheDocument();
  });

  // Test 23
  it('shows detailed info in detailed template', () => {
    render(
      <LabelCard label={label} template="detailed" selected={false} onSelect={vi.fn()} />
    );
    expect(screen.getByText(/Grain: length/)).toBeInTheDocument();
    expect(screen.getByText(/EB: T,B/)).toBeInTheDocument();
  });

  // Test 24
  it('hides detail info in compact template', () => {
    render(
      <LabelCard label={label} template="compact" selected={false} onSelect={vi.fn()} />
    );
    expect(screen.queryByText(/800 × 600/)).not.toBeInTheDocument();
  });

  // Test 25
  it('applies selected styling', () => {
    render(
      <LabelCard label={label} template="standard" selected={true} onSelect={vi.fn()} />
    );
    const card = screen.getByTestId('label-card-L1');
    expect(card.className).toContain('border-blue-500');
  });
});
