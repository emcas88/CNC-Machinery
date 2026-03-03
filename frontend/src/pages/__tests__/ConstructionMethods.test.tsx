import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ConstructionMethods from './ConstructionMethods';
import { constructionMethodsService } from '@/services/construction-methods';
import { JoiningMethod, BackPanelStyle, BottomPanelStyle } from '@/types';
import type { ConstructionMethod } from '@/types';

vi.mock('@/services/construction-methods', () => ({
  constructionMethodsService: {
    getConstructionMethods: vi.fn(),
    getConstructionMethod: vi.fn(),
    createConstructionMethod: vi.fn(),
    updateConstructionMethod: vi.fn(),
    deleteConstructionMethod: vi.fn(),
  },
}));

const mockMethods: ConstructionMethod[] = [
  {
    id: 'cm-1',
    name: 'Standard Frameless',
    description: 'European-style frameless cabinet',
    joiningMethod: JoiningMethod.DOWEL,
    backPanel: BackPanelStyle.DADO,
    bottomPanel: BottomPanelStyle.DADO,
    caseThickness: 18,
    backThickness: 6,
    insetDepth: 3,
    overlap: 0,
    blumSystemHole: true,
    systemHoleSpacing: 32,
    notes: 'Standard production method',
    isDefault: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'cm-2',
    name: 'Face Frame',
    description: 'American face-frame construction',
    joiningMethod: JoiningMethod.POCKET_SCREW,
    backPanel: BackPanelStyle.RABBET,
    bottomPanel: BottomPanelStyle.RABBET,
    caseThickness: 19,
    backThickness: 6,
    insetDepth: 4.5,
    overlap: 12.7,
    blumSystemHole: false,
    systemHoleSpacing: 32,
    notes: '',
    isDefault: false,
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

describe('ConstructionMethods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (constructionMethodsService.getConstructionMethods as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockMethods,
    );
  });

  // ── Loading State ──
  it('shows loading spinner while fetching', () => {
    (constructionMethodsService.getConstructionMethods as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    render(<ConstructionMethods />, { wrapper: createWrapper() });
    expect(screen.getByText('Loading construction methods…')).toBeInTheDocument();
  });

  // ── Error State ──
  it('shows error state when fetch fails', async () => {
    (constructionMethodsService.getConstructionMethods as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Database error'),
    );
    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Failed to load construction methods')).toBeInTheDocument();
    });
    expect(screen.getByText('Database error')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  // ── Renders list ──
  it('renders construction methods in sidebar', async () => {
    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Standard Frameless')).toBeInTheDocument();
    });
    expect(screen.getByText('Face Frame')).toBeInTheDocument();
  });

  // ── Default badge ──
  it('shows Default badge on the default method', async () => {
    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Default')).toBeInTheDocument();
    });
  });

  // ── Empty state ──
  it('shows empty state when no methods exist', async () => {
    (constructionMethodsService.getConstructionMethods as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('No methods yet')).toBeInTheDocument();
    });
  });

  // ── Select method ──
  it('loads form data when a method is selected', async () => {
    const user = userEvent.setup();
    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Standard Frameless')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Standard Frameless'));
    expect(screen.getByDisplayValue('Standard Frameless')).toBeInTheDocument();
    expect(screen.getByDisplayValue('European-style frameless cabinet')).toBeInTheDocument();
    expect(screen.getByDisplayValue('18')).toBeInTheDocument();
    expect(screen.getByDisplayValue('6')).toBeInTheDocument();
  });

  // ── Search ──
  it('filters methods by search term', async () => {
    const user = userEvent.setup();
    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Standard Frameless')).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText('Search methods…');
    await user.type(searchInput, 'Face');
    expect(screen.queryByText('Standard Frameless')).not.toBeInTheDocument();
    expect(screen.getByText('Face Frame')).toBeInTheDocument();
  });

  // ── New Method ──
  it('opens blank form for new method', async () => {
    const user = userEvent.setup();
    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Standard Frameless')).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText('New construction method'));
    expect(screen.getByText('New Construction Method')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Method name')).toHaveValue('');
  });

  // ── Create Method ──
  it('creates a new method via API', async () => {
    const user = userEvent.setup();
    const created: ConstructionMethod = {
      ...mockMethods[0],
      id: 'cm-3',
      name: 'Custom Method',
      isDefault: false,
    };
    (constructionMethodsService.createConstructionMethod as ReturnType<typeof vi.fn>).mockResolvedValue(
      created,
    );

    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Standard Frameless')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('New construction method'));
    await user.type(screen.getByPlaceholderText('Method name'), 'Custom Method');
    await user.click(screen.getByText('Create Method'));

    await waitFor(() => {
      expect(constructionMethodsService.createConstructionMethod).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Custom Method' }),
      );
    });
  });

  // ── Update Method ──
  it('updates an existing method via API', async () => {
    const user = userEvent.setup();
    (constructionMethodsService.updateConstructionMethod as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockMethods[0],
      name: 'Updated Frameless',
    });

    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Standard Frameless')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Standard Frameless'));
    const nameInput = screen.getByDisplayValue('Standard Frameless');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Frameless');
    await user.click(screen.getByText('Save Method'));

    await waitFor(() => {
      expect(constructionMethodsService.updateConstructionMethod).toHaveBeenCalledWith(
        'cm-1',
        expect.objectContaining({ name: 'Updated Frameless' }),
      );
    });
  });

  // ── Delete Method ──
  it('deletes a method with confirmation', async () => {
    const user = userEvent.setup();
    (constructionMethodsService.deleteConstructionMethod as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Standard Frameless')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Standard Frameless'));
    await user.click(screen.getByText('Delete'));
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    await user.click(screen.getByText('Confirm Delete'));

    await waitFor(() => {
      expect(constructionMethodsService.deleteConstructionMethod).toHaveBeenCalledWith('cm-1');
    });
  });

  // ── Cancel delete ──
  it('cancels delete when clicking Cancel', async () => {
    const user = userEvent.setup();
    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Standard Frameless')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Standard Frameless'));
    await user.click(screen.getByText('Delete'));
    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText(/Are you sure/)).not.toBeInTheDocument();
  });

  // ── Set as Default ──
  it('sets a method as default via API', async () => {
    const user = userEvent.setup();
    (constructionMethodsService.updateConstructionMethod as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockMethods[1],
      isDefault: true,
    });

    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Face Frame')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Face Frame'));
    await user.click(screen.getByText('Set as Default'));

    await waitFor(() => {
      expect(constructionMethodsService.updateConstructionMethod).toHaveBeenCalledWith(
        'cm-2',
        expect.objectContaining({ isDefault: true }),
      );
    });
  });

  // ── No "Set as Default" for already-default ──
  it('does not show Set as Default for the default method', async () => {
    const user = userEvent.setup();
    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Standard Frameless')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Standard Frameless'));
    expect(screen.queryByText('Set as Default')).not.toBeInTheDocument();
  });

  // ── Blum system hole toggle ──
  it('shows system hole spacing when Blum toggle is on', async () => {
    const user = userEvent.setup();
    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Standard Frameless')).toBeInTheDocument();
    });

    // Select Standard Frameless (blumSystemHole = true)
    await user.click(screen.getByText('Standard Frameless'));
    expect(screen.getByDisplayValue('32')).toBeInTheDocument();
    expect(screen.getByText('System Hole Spacing (mm)')).toBeInTheDocument();
  });

  it('hides system hole spacing when Blum toggle is off', async () => {
    const user = userEvent.setup();
    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Face Frame')).toBeInTheDocument();
    });

    // Face Frame has blumSystemHole = false
    await user.click(screen.getByText('Face Frame'));
    expect(screen.queryByText('System Hole Spacing (mm)')).not.toBeInTheDocument();
  });

  // ── Sidebar subtitle ──
  it('displays joining method and thickness in sidebar', async () => {
    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Dowel · 18mm')).toBeInTheDocument();
      expect(screen.getByText('Pocket Screw · 19mm')).toBeInTheDocument();
    });
  });

  // ── Placeholder ──
  it('shows placeholder when no method is selected', async () => {
    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Select a method or create a new one')).toBeInTheDocument();
    });
  });

  // ── Numeric inputs ──
  it('updates numeric fields correctly', async () => {
    const user = userEvent.setup();
    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Standard Frameless')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Standard Frameless'));
    const thicknessInput = screen.getByDisplayValue('18');
    await user.clear(thicknessInput);
    await user.type(thicknessInput, '22');
    expect(thicknessInput).toHaveValue(22);
  });

  // ── Dropdown changes ──
  it('changes joining method dropdown', async () => {
    const user = userEvent.setup();
    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Standard Frameless')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Standard Frameless'));
    const joiningSelect = screen.getByDisplayValue('Dowel');
    await user.selectOptions(joiningSelect, JoiningMethod.CAM_LOCK);
    expect(joiningSelect).toHaveValue(JoiningMethod.CAM_LOCK);
  });

  // ── Create mutation error ──
  it('shows error when create fails', async () => {
    const user = userEvent.setup();
    (constructionMethodsService.createConstructionMethod as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Validation error'),
    );

    render(<ConstructionMethods />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Standard Frameless')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('New construction method'));
    await user.type(screen.getByPlaceholderText('Method name'), 'Bad Method');
    await user.click(screen.getByText('Create Method'));

    await waitFor(() => {
      expect(screen.getByText('Validation error')).toBeInTheDocument();
    });
  });
});
