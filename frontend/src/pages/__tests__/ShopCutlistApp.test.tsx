// F24 – ShopCutlistApp tests (15+ tests)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ShopCutlistApp,
  cutlistApi,
  GrainDirectionIcon,
  PartRow,
  type CutlistPart,
  type CutlistResponse,
} from './ShopCutlistApp';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockParts: CutlistPart[] = [
  {
    id: '1', name: 'LHS Side Panel', length: 800, width: 600, thickness: 18,
    material: 'Birch Ply', grainDirection: 'length', quantity: 1, isCut: false,
    edgeBanding: { top: true, bottom: true, left: false, right: false },
    jobId: 'job-1', productName: 'Base Cabinet',
  },
  {
    id: '2', name: 'RHS Side Panel', length: 800, width: 600, thickness: 18,
    material: 'Birch Ply', grainDirection: 'length', quantity: 1, isCut: true,
    jobId: 'job-1', productName: 'Base Cabinet',
  },
  {
    id: '3', name: 'Top Panel', length: 564, width: 600, thickness: 18,
    material: 'Birch Ply', grainDirection: 'width', quantity: 1, isCut: false,
    jobId: 'job-1',
  },
  {
    id: '4', name: 'Back Panel', length: 764, width: 782, thickness: 9,
    material: 'MDF', grainDirection: 'none', quantity: 1, isCut: false,
    notes: 'Route edges before assembly',
    jobId: 'job-1',
  },
  {
    id: '5', name: 'Shelf', length: 560, width: 580, thickness: 18,
    material: 'MDF', grainDirection: 'none', quantity: 3, isCut: true,
    jobId: 'job-1',
  },
  {
    id: '6', name: 'Door LHS', length: 800, width: 300, thickness: 18,
    material: 'MDF Routed', grainDirection: 'length', quantity: 1, isCut: false,
    jobId: 'job-1',
  },
];

const mockCutlistResponse: CutlistResponse = {
  jobId: 'job-1',
  jobName: 'Kitchen Remodel - 123 Main St',
  parts: mockParts,
  totalParts: mockParts.length,
  cutParts: mockParts.filter((p) => p.isCut).length,
};

function createMockApi(overrides?: Partial<typeof cutlistApi>) {
  return {
    fetchCutlist: vi.fn().mockResolvedValue(mockCutlistResponse),
    markPartCut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ShopCutlistApp', () => {
  // Test 1
  it('shows loading state initially', () => {
    const api = createMockApi({
      fetchCutlist: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
    });
    render(<ShopCutlistApp jobId="job-1" api={api} />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  // Test 2
  it('fetches and displays cutlist parts', async () => {
    const api = createMockApi();
    render(<ShopCutlistApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByText('LHS Side Panel')).toBeInTheDocument();
    });

    expect(api.fetchCutlist).toHaveBeenCalledWith('job-1');
    expect(screen.getByText('RHS Side Panel')).toBeInTheDocument();
    expect(screen.getByText('Back Panel')).toBeInTheDocument();
  });

  // Test 3
  it('displays error state and allows retry', async () => {
    const api = createMockApi({
      fetchCutlist: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    render(<ShopCutlistApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });
    expect(screen.getByText('Network error')).toBeInTheDocument();

    // Retry
    api.fetchCutlist.mockResolvedValue(mockCutlistResponse);
    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByText('LHS Side Panel')).toBeInTheDocument();
    });
  });

  // Test 4
  it('displays progress bar with correct ratio', async () => {
    const api = createMockApi();
    render(<ShopCutlistApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByText('2/6 cut')).toBeInTheDocument();
    });

    const progressBar = screen.getByTestId('progress-bar');
    expect(progressBar).toHaveStyle({ width: '33%' });
  });

  // Test 5
  it('toggles part cut status with optimistic update', async () => {
    const api = createMockApi();
    render(<ShopCutlistApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByText('LHS Side Panel')).toBeInTheDocument();
    });

    // Part 1 is not cut, click its checkbox
    const partRow = screen.getByTestId('part-row-1');
    const checkbox = within(partRow).getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    // Optimistic update
    await waitFor(() => {
      expect(checkbox).toBeChecked();
    });
    expect(api.markPartCut).toHaveBeenCalledWith('job-1', '1', true);
  });

  // Test 6
  it('reverts on failed API call when toggling cut', async () => {
    const api = createMockApi({
      markPartCut: vi.fn().mockRejectedValue(new Error('Server error')),
    });
    render(<ShopCutlistApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByText('LHS Side Panel')).toBeInTheDocument();
    });

    const partRow = screen.getByTestId('part-row-1');
    const checkbox = within(partRow).getByRole('checkbox');
    fireEvent.click(checkbox);

    // Should revert
    await waitFor(() => {
      expect(checkbox).not.toBeChecked();
    });
  });

  // Test 7
  it('filters parts by search term', async () => {
    const api = createMockApi();
    render(<ShopCutlistApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByText('LHS Side Panel')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'Door');

    expect(screen.queryByText('LHS Side Panel')).not.toBeInTheDocument();
    expect(screen.getByText('Door LHS')).toBeInTheDocument();
  });

  // Test 8
  it('filters parts by material', async () => {
    const api = createMockApi();
    render(<ShopCutlistApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByText('LHS Side Panel')).toBeInTheDocument();
    });

    const materialFilter = screen.getByTestId('material-filter');
    fireEvent.change(materialFilter, { target: { value: 'MDF' } });

    expect(screen.queryByText('LHS Side Panel')).not.toBeInTheDocument();
    expect(screen.getByText('Back Panel')).toBeInTheDocument();
    expect(screen.getByText('Shelf')).toBeInTheDocument();
  });

  // Test 9
  it('sorts parts by name ascending and descending', async () => {
    const api = createMockApi();
    render(<ShopCutlistApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByText('LHS Side Panel')).toBeInTheDocument();
    });

    // Default sort by name asc
    const partsList = screen.getByTestId('parts-list');
    const rows = within(partsList).getAllByTestId(/part-row-/);
    const firstRowText = rows[0].textContent;
    expect(firstRowText).toContain('Back Panel');

    // Click sort by name again to toggle desc
    fireEvent.click(screen.getByTestId('sort-name'));

    const rowsDesc = within(partsList).getAllByTestId(/part-row-/);
    expect(rowsDesc[0].textContent).toContain('Top Panel');
  });

  // Test 10
  it('sorts parts by length', async () => {
    const api = createMockApi();
    render(<ShopCutlistApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByText('LHS Side Panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('sort-length'));

    const partsList = screen.getByTestId('parts-list');
    const rows = within(partsList).getAllByTestId(/part-row-/);
    // Shortest first: Shelf (560)
    expect(rows[0].textContent).toContain('Shelf');
  });

  // Test 11
  it('groups parts by material', async () => {
    const api = createMockApi();
    render(<ShopCutlistApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByText('LHS Side Panel')).toBeInTheDocument();
    });

    const groupToggle = screen.getByTestId('group-toggle');
    fireEvent.click(groupToggle);

    expect(screen.getByTestId('group-Birch Ply')).toBeInTheDocument();
    expect(screen.getByTestId('group-MDF')).toBeInTheDocument();
    expect(screen.getByTestId('group-MDF Routed')).toBeInTheDocument();
  });

  // Test 12
  it('hides completed parts when toggle is checked', async () => {
    const api = createMockApi();
    render(<ShopCutlistApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByText('RHS Side Panel')).toBeInTheDocument();
    });

    const hideToggle = screen.getByTestId('hide-completed');
    fireEvent.click(hideToggle);

    // RHS Side Panel and Shelf are cut
    expect(screen.queryByText('RHS Side Panel')).not.toBeInTheDocument();
    expect(screen.queryByText('Shelf')).not.toBeInTheDocument();
    expect(screen.getByText('LHS Side Panel')).toBeInTheDocument();
  });

  // Test 13
  it('shows empty state when no parts match filters', async () => {
    const api = createMockApi();
    render(<ShopCutlistApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByText('LHS Side Panel')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'zzzznonexistent');

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  // Test 14
  it('displays job name in header', async () => {
    const api = createMockApi();
    render(<ShopCutlistApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByText('Kitchen Remodel - 123 Main St')).toBeInTheDocument();
    });
  });

  // Test 15
  it('shows print button and triggers print', async () => {
    const api = createMockApi();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<ShopCutlistApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByTestId('print-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('print-btn'));
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  // Test 16
  it('displays edge banding indicators', async () => {
    const api = createMockApi();
    render(<ShopCutlistApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByText('LHS Side Panel')).toBeInTheDocument();
    });

    const partRow = screen.getByTestId('part-row-1');
    expect(within(partRow).getByTestId('edge-banding')).toHaveTextContent('EB: TB');
  });

  // Test 17
  it('displays notes on parts that have them', async () => {
    const api = createMockApi();
    render(<ShopCutlistApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByText('Route edges before assembly')).toBeInTheDocument();
    });
  });

  // Test 18
  it('searches across name, material, and notes', async () => {
    const api = createMockApi();
    render(<ShopCutlistApp jobId="job-1" api={api} />);

    await waitFor(() => {
      expect(screen.getByText('LHS Side Panel')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('search-input');
    await userEvent.type(searchInput, 'route');

    // Should find "Back Panel" because its note contains "Route"
    expect(screen.getByText('Back Panel')).toBeInTheDocument();
    expect(screen.queryByText('LHS Side Panel')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// GrainDirectionIcon tests
// ---------------------------------------------------------------------------

describe('GrainDirectionIcon', () => {
  // Test 19
  it('renders length grain direction', () => {
    render(<GrainDirectionIcon direction="length" />);
    expect(screen.getByTestId('grain-length')).toBeInTheDocument();
  });

  // Test 20
  it('renders width grain direction with rotation', () => {
    render(<GrainDirectionIcon direction="width" />);
    const icon = screen.getByTestId('grain-width');
    expect(icon).toHaveStyle({ transform: 'rotate(90deg)' });
  });

  // Test 21
  it('renders nothing for none direction', () => {
    const { container } = render(<GrainDirectionIcon direction="none" />);
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PartRow tests
// ---------------------------------------------------------------------------

describe('PartRow', () => {
  // Test 22
  it('renders part details', () => {
    const part = mockParts[0];
    render(<PartRow part={part} onToggleCut={vi.fn()} />);
    expect(screen.getByText('LHS Side Panel')).toBeInTheDocument();
    expect(screen.getByText(/800 × 600 × 18mm/)).toBeInTheDocument();
    expect(screen.getByText('×1')).toBeInTheDocument();
  });

  // Test 23
  it('shows cut badge when part is cut', () => {
    const part = mockParts[1]; // isCut: true
    render(<PartRow part={part} onToggleCut={vi.fn()} />);
    expect(screen.getByText('Cut')).toBeInTheDocument();
  });

  // Test 24
  it('calls onToggleCut when checkbox is clicked', () => {
    const onToggle = vi.fn();
    const part = mockParts[0];
    render(<PartRow part={part} onToggleCut={onToggle} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('1');
  });
});
