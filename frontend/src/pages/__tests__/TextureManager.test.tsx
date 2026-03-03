import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TextureManager from './TextureManager';
import { texturesService } from '@/services/textures';
import { Sheen, GrainOrientation } from '@/types';
import type { Texture, TextureGroup } from '@/types';

vi.mock('@/services/textures', () => ({
  texturesService: {
    getTextures: vi.fn(),
    getTexture: vi.fn(),
    createTexture: vi.fn(),
    updateTexture: vi.fn(),
    deleteTexture: vi.fn(),
    getGroups: vi.fn(),
    createGroup: vi.fn(),
    uploadTexture: vi.fn(),
  },
}));

const mockGroups: TextureGroup[] = [
  { id: 'grp-1', name: 'Laminates', description: 'HPL surfaces', textureCount: 5, thumbnailUrl: undefined },
  { id: 'grp-2', name: 'Veneers', description: 'Natural wood', textureCount: 3, thumbnailUrl: undefined },
];

const mockTextures: Texture[] = [
  {
    id: 'tx-1',
    name: 'White Oak',
    groupId: 'grp-2',
    sheen: Sheen.SATIN,
    grainOrientation: GrainOrientation.VERTICAL,
    imageUrl: undefined,
    thumbnailUrl: undefined,
    color: '#B8935A',
    tags: ['wood', 'natural', 'premium'],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'tx-2',
    name: 'Solid White',
    groupId: 'grp-1',
    sheen: Sheen.HIGH_GLOSS,
    grainOrientation: GrainOrientation.NONE,
    imageUrl: undefined,
    thumbnailUrl: undefined,
    color: '#FFFFFF',
    tags: ['solid', 'white'],
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'tx-3',
    name: 'Carbon Fiber',
    groupId: undefined,
    sheen: Sheen.GLOSS,
    grainOrientation: GrainOrientation.DIAGONAL,
    imageUrl: undefined,
    thumbnailUrl: undefined,
    color: '#333333',
    tags: ['industrial', 'modern', 'tech', 'carbon'],
    createdAt: '2026-02-01T00:00:00Z',
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

describe('TextureManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (texturesService.getTextures as ReturnType<typeof vi.fn>).mockResolvedValue(mockTextures);
    (texturesService.getGroups as ReturnType<typeof vi.fn>).mockResolvedValue(mockGroups);
  });

  // ── Loading State ──
  it('shows loading spinner while fetching', () => {
    (texturesService.getTextures as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    (texturesService.getGroups as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<TextureManager />, { wrapper: createWrapper() });
    expect(screen.getByText('Loading textures…')).toBeInTheDocument();
  });

  // ── Error State ──
  it('shows error state when texture fetch fails', async () => {
    (texturesService.getTextures as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server error'));
    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Failed to load textures')).toBeInTheDocument();
    });
    expect(screen.getByText('Server error')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  // ── Renders texture grid ──
  it('renders texture cards in grid', async () => {
    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('White Oak')).toBeInTheDocument();
    });
    expect(screen.getByText('Solid White')).toBeInTheDocument();
    expect(screen.getByText('Carbon Fiber')).toBeInTheDocument();
  });

  // ── Renders groups ──
  it('renders groups in sidebar', async () => {
    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Laminates')).toBeInTheDocument();
    });
    expect(screen.getByText('Veneers')).toBeInTheDocument();
    expect(screen.getByText('All Textures')).toBeInTheDocument();
  });

  // ── Group filtering ──
  it('selects a group filter', async () => {
    const user = userEvent.setup();
    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Laminates')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Laminates'));
    await waitFor(() => {
      expect(texturesService.getTextures).toHaveBeenCalledWith(
        expect.objectContaining({ groupId: 'grp-1' }),
      );
    });
  });

  // ── Search ──
  it('passes search term to API', async () => {
    const user = userEvent.setup();
    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('White Oak')).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText('Search textures…');
    await user.type(searchInput, 'oak');
    await waitFor(() => {
      expect(texturesService.getTextures).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'oak' }),
      );
    });
  });

  // ── Empty State ──
  it('shows empty state when no textures', async () => {
    (texturesService.getTextures as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('No textures found')).toBeInTheDocument();
    });
  });

  // ── Tags display ──
  it('displays tags on texture cards with overflow count', async () => {
    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('wood')).toBeInTheDocument();
      expect(screen.getByText('natural')).toBeInTheDocument();
      expect(screen.getByText('premium')).toBeInTheDocument();
    });
    // Carbon Fiber has 4 tags, showing 3 + overflow
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  // ── Sheen badges ──
  it('displays sheen badges on texture cards', async () => {
    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Satin')).toBeInTheDocument();
      expect(screen.getByText('High Gloss')).toBeInTheDocument();
      expect(screen.getByText('Gloss')).toBeInTheDocument();
    });
  });

  // ── Open create modal ──
  it('opens create texture modal', async () => {
    const user = userEvent.setup();
    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('White Oak')).toBeInTheDocument();
    });
    await user.click(screen.getByText('+ New Texture'));
    expect(screen.getByText('New Texture')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Texture name')).toBeInTheDocument();
  });

  // ── Create texture ──
  it('creates a texture via API', async () => {
    const user = userEvent.setup();
    (texturesService.createTexture as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockTextures[0],
      id: 'tx-new',
      name: 'New Texture',
    });

    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('White Oak')).toBeInTheDocument();
    });
    await user.click(screen.getByText('+ New Texture'));
    await user.type(screen.getByPlaceholderText('Texture name'), 'New Texture');
    await user.click(screen.getByText('Create Texture'));

    await waitFor(() => {
      expect(texturesService.createTexture).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Texture' }),
      );
    });
  });

  // ── Edit texture ──
  it('opens edit modal with texture data and updates', async () => {
    const user = userEvent.setup();
    (texturesService.updateTexture as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockTextures[0],
      name: 'Updated Oak',
    });

    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('White Oak')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText('Edit');
    await user.click(editButtons[0]);
    expect(screen.getByText('Edit Texture')).toBeInTheDocument();
    expect(screen.getByDisplayValue('White Oak')).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue('White Oak');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Oak');
    await user.click(screen.getByText('Update Texture'));

    await waitFor(() => {
      expect(texturesService.updateTexture).toHaveBeenCalledWith(
        'tx-1',
        expect.objectContaining({ name: 'Updated Oak' }),
      );
    });
  });

  // ── Delete texture ──
  it('deletes texture with confirmation', async () => {
    const user = userEvent.setup();
    (texturesService.deleteTexture as ReturnType<typeof vi.fn>).mockResolvedValue({});

    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('White Oak')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('Delete White Oak'));
    expect(screen.getByText('Delete White Oak?')).toBeInTheDocument();

    await user.click(screen.getAllByText('Delete')[0]);

    await waitFor(() => {
      expect(texturesService.deleteTexture).toHaveBeenCalledWith('tx-1');
    });
  });

  // ── Cancel delete ──
  it('cancels delete when clicking Cancel', async () => {
    const user = userEvent.setup();
    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('White Oak')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('Delete White Oak'));
    expect(screen.getByText('Delete White Oak?')).toBeInTheDocument();
    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Delete White Oak?')).not.toBeInTheDocument();
  });

  // ── Upload texture ──
  it('uploads a file via formData', async () => {
    (texturesService.uploadTexture as ReturnType<typeof vi.fn>).mockResolvedValue(mockTextures[0]);

    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('White Oak')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
    const file = new File(['dummy'], 'texture.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(texturesService.uploadTexture).toHaveBeenCalled();
      const formData = (texturesService.uploadTexture as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(formData).toBeInstanceOf(FormData);
    });
  });

  // ── Create group ──
  it('creates a new group via modal', async () => {
    const user = userEvent.setup();
    (texturesService.createGroup as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'grp-new',
      name: 'Metals',
      description: 'Metallic finishes',
      textureCount: 0,
    });

    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Laminates')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('Create group'));
    expect(screen.getByText('New Group')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Group name'), 'Metals');
    await user.type(screen.getByPlaceholderText('Optional description'), 'Metallic finishes');
    await user.click(screen.getByText('Create Group'));

    await waitFor(() => {
      expect(texturesService.createGroup).toHaveBeenCalledWith('Metals', 'Metallic finishes');
    });
  });

  // ── Close modals ──
  it('closes create modal on Cancel', async () => {
    const user = userEvent.setup();
    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('White Oak')).toBeInTheDocument();
    });

    await user.click(screen.getByText('+ New Texture'));
    expect(screen.getByText('New Texture')).toBeInTheDocument();
    // Click the Cancel button in the create/edit modal
    const cancelButtons = screen.getAllByText('Cancel');
    await user.click(cancelButtons[cancelButtons.length - 1]);
    expect(screen.queryByText('New Texture')).not.toBeInTheDocument();
  });

  // ── Tag management ──
  it('adds and removes tags in texture form', async () => {
    const user = userEvent.setup();
    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('White Oak')).toBeInTheDocument();
    });

    await user.click(screen.getByText('+ New Texture'));
    const tagInput = screen.getByPlaceholderText('Add tag and press Enter');
    await user.type(tagInput, 'luxury');
    await user.click(screen.getByText('Add'));
    expect(screen.getByText('luxury')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Remove tag luxury'));
    expect(screen.queryByText('luxury')).not.toBeInTheDocument();
  });

  // ── Tag via Enter key ──
  it('adds tag on Enter key press', async () => {
    const user = userEvent.setup();
    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('White Oak')).toBeInTheDocument();
    });

    await user.click(screen.getByText('+ New Texture'));
    const tagInput = screen.getByPlaceholderText('Add tag and press Enter');
    await user.type(tagInput, 'eco{enter}');
    expect(screen.getByText('eco')).toBeInTheDocument();
  });

  // ── Grain icons shown ──
  it('shows grain orientation icons on cards', async () => {
    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('White Oak')).toBeInTheDocument();
    });
    // Vertical grain icon
    expect(screen.getByText('║')).toBeInTheDocument();
    // None grain icon
    expect(screen.getByText('○')).toBeInTheDocument();
    // Diagonal grain icon
    expect(screen.getByText('╱')).toBeInTheDocument();
  });

  // ── Upload error ──
  it('shows upload error message', async () => {
    (texturesService.uploadTexture as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('File too large'),
    );

    render(<TextureManager />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('White Oak')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('file-input') as HTMLInputElement;
    const file = new File(['x'.repeat(10000000)], 'huge.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/)).toBeInTheDocument();
    });
  });
});
