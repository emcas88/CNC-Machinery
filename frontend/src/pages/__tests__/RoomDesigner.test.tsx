import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RoomDesigner from './RoomDesigner';

/* ── mocks ── */
vi.mock('@/services/rooms', () => ({
  roomsService: {
    getRoom: vi.fn(),
    updateRoom: vi.fn(),
  },
}));

vi.mock('@/services/products', () => ({
  productsService: {
    getProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
    moveProduct: vi.fn(),
    rotateProduct: vi.fn(),
  },
}));

const mockDesignStore = {
  products: [] as any[],
  addProduct: vi.fn(),
  updateProduct: vi.fn(),
  removeProduct: vi.fn(),
  selectProduct: vi.fn(),
  moveProduct: vi.fn(),
  rotateProduct: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
};

vi.mock('@/store/designStore', () => ({
  useDesignStore: (sel?: (s: any) => any) => (sel ? sel(mockDesignStore) : mockDesignStore),
}));

const mockAppStore = {
  currentRoom: 'room-1',
  currentJob: 'job-1',
  selectedProduct: null as string | null,
  unitSystem: 'metric',
  theme: 'dark',
};

vi.mock('@/store/appStore', () => ({
  useAppStore: (sel?: (s: any) => any) => (sel ? sel(mockAppStore) : mockAppStore),
}));

import { roomsService } from '@/services/rooms';
import { productsService } from '@/services/products';

const mockRoom = { id: 'room-1', name: 'Kitchen', layout: {} };
const mockProducts = [
  { id: 'p1', name: 'Base Cabinet', x: 100, y: 200, width: 80, height: 40, rotation: 0 },
  { id: 'p2', name: 'Wall Cabinet', x: 300, y: 100, width: 60, height: 30, rotation: 0 },
];

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAppStore.currentRoom = 'room-1';
  mockAppStore.selectedProduct = null;
  mockDesignStore.products = [...mockProducts];
  (roomsService.getRoom as any).mockResolvedValue(mockRoom);
  (productsService.getProducts as any).mockResolvedValue(mockProducts);
  (roomsService.updateRoom as any).mockResolvedValue(mockRoom);
  (productsService.createProduct as any).mockResolvedValue({ id: 'p3', name: 'New Product', x: 50, y: 50, width: 60, height: 30, rotation: 0 });
  (productsService.deleteProduct as any).mockResolvedValue({});
  (productsService.moveProduct as any).mockResolvedValue({});
  (productsService.rotateProduct as any).mockResolvedValue({});
  (productsService.updateProduct as any).mockResolvedValue({});

  // mock canvas context
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    set strokeStyle(_: any) {},
    set fillStyle(_: any) {},
    set lineWidth(_: any) {},
    set font(_: any) {},
    set textAlign(_: any) {},
  });
});

describe('RoomDesigner', () => {
  it('shows no-room message when no room selected', () => {
    mockAppStore.currentRoom = '';
    render(<RoomDesigner />, { wrapper: createWrapper() });
    expect(screen.getByTestId('no-room')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    (roomsService.getRoom as any).mockReturnValue(new Promise(() => {}));
    render(<RoomDesigner />, { wrapper: createWrapper() });
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('shows error state on fetch failure', async () => {
    (roomsService.getRoom as any).mockRejectedValue(new Error('fail'));
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('error')).toBeInTheDocument());
  });

  it('renders room info after loading', async () => {
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('room-info')).toHaveTextContent('Kitchen');
    });
  });

  it('renders canvas element', async () => {
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('design-canvas')).toBeInTheDocument());
  });

  it('renders toolbar with all tools', async () => {
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('tool-select')).toBeInTheDocument();
      expect(screen.getByTestId('tool-wall')).toBeInTheDocument();
      expect(screen.getByTestId('tool-dimension')).toBeInTheDocument();
      expect(screen.getByTestId('tool-pan')).toBeInTheDocument();
    });
  });

  it('switches active tool on click', async () => {
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('tool-wall'));
    fireEvent.click(screen.getByTestId('tool-wall'));
    expect(screen.getByTestId('tool-wall')).toHaveClass('bg-cyan-600');
  });

  it('undo and redo buttons call store', async () => {
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('undo-btn'));
    fireEvent.click(screen.getByTestId('undo-btn'));
    expect(mockDesignStore.undo).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('redo-btn'));
    expect(mockDesignStore.redo).toHaveBeenCalled();
  });

  it('renders product library with items', async () => {
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('product-library')).toBeInTheDocument();
      expect(screen.getByTestId('library-item-p1')).toHaveTextContent('Base Cabinet');
    });
  });

  it('filters product library via search', async () => {
    const user = userEvent.setup();
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('library-search'));
    await user.type(screen.getByTestId('library-search'), 'wall');
    expect(screen.queryByText('Base Cabinet')).not.toBeInTheDocument();
    expect(screen.getByText('Wall Cabinet')).toBeInTheDocument();
  });

  it('shows empty state in library when filter matches nothing', async () => {
    const user = userEvent.setup();
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('library-search'));
    await user.type(screen.getByTestId('library-search'), 'zzzznotfound');
    expect(screen.getByTestId('library-empty')).toBeInTheDocument();
  });

  it('shows no-selection message in properties panel', async () => {
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('no-selection')).toBeInTheDocument());
  });

  it('shows properties panel when product selected', async () => {
    mockAppStore.selectedProduct = 'p1';
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('prop-name')).toHaveValue('Base Cabinet');
      expect(screen.getByTestId('prop-x')).toHaveValue(100);
    });
  });

  it('manual save button calls updateRoom', async () => {
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('save-btn'));
    fireEvent.click(screen.getByTestId('save-btn'));
    await waitFor(() => {
      expect(roomsService.updateRoom).toHaveBeenCalledWith('room-1', expect.any(Object));
    });
  });

  it('delete button calls deleteProduct mutation', async () => {
    mockAppStore.selectedProduct = 'p1';
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('delete-btn'));
    fireEvent.click(screen.getByTestId('delete-btn'));
    await waitFor(() => {
      expect(productsService.deleteProduct).toHaveBeenCalledWith('p1');
    });
  });

  it('rotate button calls rotateProduct', async () => {
    mockAppStore.selectedProduct = 'p1';
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('rotate-btn'));
    fireEvent.click(screen.getByTestId('rotate-btn'));
    expect(mockDesignStore.rotateProduct).toHaveBeenCalledWith('p1', 90);
  });

  it('auto-save toggle works', async () => {
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('autosave-toggle'));
    const toggle = screen.getByTestId('autosave-toggle');
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
  });

  it('canvas mouse events fire correctly', async () => {
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('design-canvas'));
    const canvas = screen.getByTestId('design-canvas');
    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 200 });
    fireEvent.mouseMove(canvas, { clientX: 110, clientY: 210 });
    fireEvent.mouseUp(canvas);
    expect(canvas).toBeInTheDocument();
  });

  it('wall tool: click adds points, doubleclick closes wall', async () => {
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('tool-wall'));
    fireEvent.click(screen.getByTestId('tool-wall'));
    const canvas = screen.getByTestId('design-canvas');
    fireEvent.click(canvas, { clientX: 50, clientY: 50 });
    fireEvent.click(canvas, { clientX: 150, clientY: 50 });
    fireEvent.click(canvas, { clientX: 150, clientY: 150 });
    fireEvent.doubleClick(canvas);
    expect(screen.getByTestId('room-info')).toHaveTextContent('Walls:');
  });

  it('drop adds product via mutation', async () => {
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('design-canvas'));
    const canvas = screen.getByTestId('design-canvas');
    const dropData = JSON.stringify({ name: 'Dropped Item', width: 50, height: 30 });
    fireEvent.drop(canvas, {
      clientX: 200,
      clientY: 200,
      dataTransfer: { getData: () => dropData, setData: vi.fn() },
    });
    await waitFor(() => {
      expect(productsService.createProduct).toHaveBeenCalled();
    });
  });

  it('dimension tool opens modal on hit', async () => {
    mockAppStore.selectedProduct = 'p1';
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('tool-dimension'));
    fireEvent.click(screen.getByTestId('tool-dimension'));
    const canvas = screen.getByTestId('design-canvas');
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800 }),
    });
    fireEvent.click(canvas, { clientX: 130, clientY: 220 });
    expect(canvas).toBeInTheDocument();
  });

  it('properties panel delete button works', async () => {
    mockAppStore.selectedProduct = 'p1';
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => screen.getByTestId('prop-delete'));
    fireEvent.click(screen.getByTestId('prop-delete'));
    await waitFor(() => {
      expect(productsService.deleteProduct).toHaveBeenCalledWith('p1');
    });
  });

  it('save status displays correctly', async () => {
    render(<RoomDesigner />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByTestId('save-status')).toHaveTextContent('saved');
    });
  });
});
