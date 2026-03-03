import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PostProcessorEditor from './PostProcessorEditor';
import { postProcessorService } from '@/services/post-processors';
import { OutputFormat } from '@/types';
import type { PostProcessor } from '@/types';

vi.mock('@/services/post-processors', () => ({
  postProcessorService: {
    getProcessors: vi.fn(),
    getProcessor: vi.fn(),
    createProcessor: vi.fn(),
    updateProcessor: vi.fn(),
    deleteProcessor: vi.fn(),
    testProcessor: vi.fn(),
  },
}));

const mockProcessors: PostProcessor[] = [
  {
    id: 'pp-1',
    name: 'Biesse Rover',
    machineType: 'CNC Router',
    outputFormat: OutputFormat.GCODE,
    template: 'G0 X{{x}} Y{{y}}',
    headerTemplate: '; Header',
    footerTemplate: '; Footer',
    toolChangeTemplate: 'T{{tool}} M6',
    sheetStartTemplate: '',
    sheetEndTemplate: '',
    variables: [
      { key: 'feedRate', label: 'Feed Rate', defaultValue: '5000', type: 'number' as const },
    ],
    isDefault: true,
    notes: 'Main router PP',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'pp-2',
    name: 'Homag Edge',
    machineType: 'Edgebander',
    outputFormat: OutputFormat.CSV,
    template: '{{partId}},{{length}},{{width}}',
    headerTemplate: '',
    footerTemplate: '',
    toolChangeTemplate: '',
    sheetStartTemplate: '',
    sheetEndTemplate: '',
    variables: [],
    isDefault: false,
    notes: '',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-10T00:00:00Z',
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('PostProcessorEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (postProcessorService.getProcessors as ReturnType<typeof vi.fn>).mockResolvedValue(mockProcessors);
  });

  // ── Loading State ──
  it('shows loading spinner while fetching processors', () => {
    (postProcessorService.getProcessors as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    expect(screen.getByText('Loading post processors…')).toBeInTheDocument();
  });

  // ── Error State ──
  it('shows error state when fetch fails', async () => {
    (postProcessorService.getProcessors as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Failed to load post processors')).toBeInTheDocument();
    });
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  // ── Renders processor list ──
  it('renders processor list in sidebar', async () => {
    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Biesse Rover')).toBeInTheDocument();
    });
    expect(screen.getByText('Homag Edge')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  // ── Empty State ──
  it('shows empty state when no processors exist', async () => {
    (postProcessorService.getProcessors as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('No processors yet')).toBeInTheDocument();
    });
  });

  // ── Selecting a processor ──
  it('loads form data when a processor is selected', async () => {
    const user = userEvent.setup();
    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Biesse Rover')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Biesse Rover'));
    expect(screen.getByDisplayValue('Biesse Rover')).toBeInTheDocument();
    expect(screen.getByDisplayValue('CNC Router')).toBeInTheDocument();
    expect(screen.getByDisplayValue('G0 X{{x}} Y{{y}}')).toBeInTheDocument();
    expect(screen.getByDisplayValue('; Header')).toBeInTheDocument();
    expect(screen.getByDisplayValue('; Footer')).toBeInTheDocument();
  });

  // ── Search ──
  it('filters processors by search term', async () => {
    const user = userEvent.setup();
    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Biesse Rover')).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText('Search processors…');
    await user.type(searchInput, 'Homag');
    expect(screen.queryByText('Biesse Rover')).not.toBeInTheDocument();
    expect(screen.getByText('Homag Edge')).toBeInTheDocument();
  });

  // ── New Processor ──
  it('opens blank form for new processor', async () => {
    const user = userEvent.setup();
    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Biesse Rover')).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText('New post processor'));
    expect(screen.getByText('New Post Processor')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Processor name')).toHaveValue('');
  });

  // ── Create Processor ──
  it('creates a new processor via API', async () => {
    const user = userEvent.setup();
    const created: PostProcessor = {
      ...mockProcessors[0],
      id: 'pp-3',
      name: 'New PP',
      machineType: 'Laser',
      outputFormat: OutputFormat.DXF,
    };
    (postProcessorService.createProcessor as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Biesse Rover')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('New post processor'));
    await user.type(screen.getByPlaceholderText('Processor name'), 'New PP');
    await user.type(screen.getByPlaceholderText('e.g. CNC Router'), 'Laser');
    await user.click(screen.getByText('Create Processor'));

    await waitFor(() => {
      expect(postProcessorService.createProcessor).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New PP', machineType: 'Laser' }),
      );
    });
  });

  // ── Update Processor ──
  it('updates an existing processor via API', async () => {
    const user = userEvent.setup();
    (postProcessorService.updateProcessor as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProcessors[0],
      name: 'Updated Name',
    });

    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Biesse Rover')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Biesse Rover'));
    const nameInput = screen.getByDisplayValue('Biesse Rover');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Name');
    await user.click(screen.getByText('Save Processor'));

    await waitFor(() => {
      expect(postProcessorService.updateProcessor).toHaveBeenCalledWith(
        'pp-1',
        expect.objectContaining({ name: 'Updated Name' }),
      );
    });
  });

  // ── Delete Processor ──
  it('deletes a processor with confirmation', async () => {
    const user = userEvent.setup();
    (postProcessorService.deleteProcessor as ReturnType<typeof vi.fn>).mockResolvedValue({});

    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Biesse Rover')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Biesse Rover'));
    await user.click(screen.getByText('Delete'));
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    await user.click(screen.getByText('Confirm Delete'));

    await waitFor(() => {
      expect(postProcessorService.deleteProcessor).toHaveBeenCalledWith('pp-1');
    });
  });

  // ── Cancel Delete ──
  it('cancels delete when clicking Cancel', async () => {
    const user = userEvent.setup();
    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Biesse Rover')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Biesse Rover'));
    await user.click(screen.getByText('Delete'));
    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText(/Are you sure/)).not.toBeInTheDocument();
  });

  // ── Test Output ──
  it('calls test API and displays output', async () => {
    const user = userEvent.setup();
    (postProcessorService.testProcessor as ReturnType<typeof vi.fn>).mockResolvedValue({
      output: 'G0 X10 Y20\nG1 Z-5 F5000',
    });

    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Biesse Rover')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Biesse Rover'));
    await user.type(screen.getByPlaceholderText('Part ID for testing'), 'part-123');
    await user.click(screen.getByText('Test Output'));

    await waitFor(() => {
      expect(postProcessorService.testProcessor).toHaveBeenCalledWith('pp-1', 'part-123');
    });
    await waitFor(() => {
      expect(screen.getByText('G0 X10 Y20\nG1 Z-5 F5000')).toBeInTheDocument();
    });
  });

  // ── Test failure ──
  it('shows error when test fails', async () => {
    const user = userEvent.setup();
    (postProcessorService.testProcessor as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Part not found'),
    );

    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Biesse Rover')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Biesse Rover'));
    await user.type(screen.getByPlaceholderText('Part ID for testing'), 'bad-id');
    await user.click(screen.getByText('Test Output'));

    await waitFor(() => {
      expect(screen.getByText('Part not found')).toBeInTheDocument();
    });
  });

  // ── Variables ──
  it('adds and removes variables', async () => {
    const user = userEvent.setup();
    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Biesse Rover')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Homag Edge'));
    expect(screen.getByText('No variables defined')).toBeInTheDocument();

    await user.click(screen.getByText('+ Add Variable'));
    expect(screen.queryByText('No variables defined')).not.toBeInTheDocument();

    const keyInput = screen.getByPlaceholderText('Key');
    await user.type(keyInput, 'speed');
    expect(keyInput).toHaveValue('speed');

    await user.click(screen.getByLabelText('Remove variable 0'));
    expect(screen.getByText('No variables defined')).toBeInTheDocument();
  });

  // ── Existing variables shown ──
  it('displays existing variables when selecting a processor with variables', async () => {
    const user = userEvent.setup();
    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Biesse Rover')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Biesse Rover'));
    expect(screen.getByDisplayValue('feedRate')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Feed Rate')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5000')).toBeInTheDocument();
  });

  // ── Export JSON ──
  it('exports processor config as JSON download', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn().mockReturnValue('blob:url');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const anchor = { href: '', download: '', click: clickSpy } as unknown as HTMLElement;
        return anchor;
      }
      return document.createElement(tag);
    });

    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Biesse Rover')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Biesse Rover'));
    await user.click(screen.getByText('Export JSON'));
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  // ── Default badge ──
  it('displays Default badge on the default processor', async () => {
    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Biesse Rover')).toBeInTheDocument();
    });
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  // ── Select placeholder ──
  it('shows placeholder when no processor is selected', async () => {
    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Select a processor or create a new one')).toBeInTheDocument();
    });
  });

  // ── Output format display ──
  it('shows output format in sidebar', async () => {
    render(<PostProcessorEditor />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText(/CNC Router · GCODE/)).toBeInTheDocument();
      expect(screen.getByText(/Edgebander · CSV/)).toBeInTheDocument();
    });
  });
});
