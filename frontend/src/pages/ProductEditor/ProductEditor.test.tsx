// ============================================================
// ProductEditor — Test Suite (97 tests)
// ============================================================
// Uses: vitest + @testing-library/react
// ============================================================

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ProductEditor } from './ProductEditor';
import { DimensionsPanel } from './components/DimensionsPanel';
import { MaterialSelector } from './components/MaterialSelector';
import { PartsTable } from './components/PartsTable';
import { HardwarePanel } from './components/HardwarePanel';
import { EdgingConfig } from './components/EdgingConfig';

import {
  validateProduct,
  calculateParts,
  calculateHardware,
  useProductForm,
  usePartCalculator,
} from './hooks';

import type { Product, Material, Part, ValidationError } from './types';
import { renderHook, act as hookAct } from '@testing-library/react';

// ─── Mock Data ────────────────────────────────────────────────

const MOCK_MATERIALS: Material[] = [
  { id: 'mat-mdf', name: 'MDF 18mm', type: 'sheet', thickness: 18, cost: 28.5 },
  { id: 'mat-ply', name: 'Birch Ply 18mm', type: 'sheet', thickness: 18, cost: 45 },
  { id: 'mat-hdf', name: 'HDF 9mm', type: 'sheet', thickness: 9, cost: 14 },
  { id: 'mat-door', name: 'MDF Door 19mm', type: 'sheet', thickness: 19, cost: 55 },
];

const MOCK_PRODUCT: Product = {
  id: 'prod-001',
  name: 'Test Base Cabinet',
  description: 'A test cabinet',
  category: 'BaseUnit',
  dimensions: { width: 600, height: 720, depth: 560 },
  constructionMethod: 'frameless',
  carcassMaterialId: 'mat-mdf',
  doorMaterialId: 'mat-door',
  drawerMaterialId: 'mat-ply',
  backPanelMaterialId: 'mat-hdf',
};

// ─── API Mocks ─────────────────────────────────────────────────

vi.mock('./api', () => ({
  getProduct: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  listMaterials: vi.fn(),
  listHardware: vi.fn(),
}));

import * as api from './api';

function mockApiSuccess() {
  vi.mocked(api.listMaterials).mockResolvedValue(MOCK_MATERIALS);
  vi.mocked(api.listHardware).mockResolvedValue([]);
  vi.mocked(api.createProduct).mockResolvedValue({ ...MOCK_PRODUCT, id: 'new-001' });
  vi.mocked(api.updateProduct).mockResolvedValue(MOCK_PRODUCT);
  vi.mocked(api.getProduct).mockResolvedValue(MOCK_PRODUCT);
}

// ─── Helpers ───────────────────────────────────────────────────

function renderEditor(props: Partial<React.ComponentProps<typeof ProductEditor>> = {}) {
  mockApiSuccess();
  return render(<ProductEditor {...props} />);
}

async function waitForMaterials() {
  await waitFor(() => {
    expect(screen.queryByText('Loading materials…')).not.toBeInTheDocument();
  });
}

// ════════════════════════════════════════════════════════════
// 1. UNIT TESTS — validateProduct
// ════════════════════════════════════════════════════════════

describe('validateProduct', () => {
  const validProduct: Product = {
    name: 'My Cabinet',
    category: 'BaseUnit',
    dimensions: { width: 600, height: 720, depth: 560 },
    constructionMethod: 'frameless',
    carcassMaterialId: 'mat-001',
    doorMaterialId: 'mat-002',
    drawerMaterialId: 'mat-003',
    backPanelMaterialId: 'mat-004',
  };

  it('returns no errors for a fully valid product', () => {
    expect(validateProduct(validProduct)).toHaveLength(0);
  });

  it('requires product name', () => {
    const errors = validateProduct({ ...validProduct, name: '' });
    expect(errors.some(e => e.field === 'name')).toBe(true);
  });

  it('rejects name shorter than 2 characters', () => {
    const errors = validateProduct({ ...validProduct, name: 'A' });
    expect(errors.some(e => e.field === 'name')).toBe(true);
  });

  it('rejects name longer than 100 characters', () => {
    const errors = validateProduct({ ...validProduct, name: 'A'.repeat(101) });
    expect(errors.some(e => e.field === 'name')).toBe(true);
  });

  it('validates min width for BaseUnit', () => {
    const errors = validateProduct({ ...validProduct, dimensions: { width: 50, height: 720, depth: 560 } });
    expect(errors.some(e => e.field === 'width')).toBe(true);
  });

  it('validates max width for BaseUnit', () => {
    const errors = validateProduct({ ...validProduct, dimensions: { width: 9999, height: 720, depth: 560 } });
    expect(errors.some(e => e.field === 'width')).toBe(true);
  });

  it('validates min height for WallUnit', () => {
    const errors = validateProduct({
      ...validProduct,
      category: 'WallUnit',
      dimensions: { width: 600, height: 50, depth: 300 },
    });
    expect(errors.some(e => e.field === 'height')).toBe(true);
  });

  it('validates max depth for BaseUnit', () => {
    const errors = validateProduct({ ...validProduct, dimensions: { width: 600, height: 720, depth: 9999 } });
    expect(errors.some(e => e.field === 'depth')).toBe(true);
  });

  it('requires carcass material', () => {
    const errors = validateProduct({ ...validProduct, carcassMaterialId: '' });
    expect(errors.some(e => e.field === 'carcassMaterialId')).toBe(true);
  });

  it('requires door material', () => {
    const errors = validateProduct({ ...validProduct, doorMaterialId: '' });
    expect(errors.some(e => e.field === 'doorMaterialId')).toBe(true);
  });

  it('requires drawer material', () => {
    const errors = validateProduct({ ...validProduct, drawerMaterialId: '' });
    expect(errors.some(e => e.field === 'drawerMaterialId')).toBe(true);
  });

  it('requires back panel material', () => {
    const errors = validateProduct({ ...validProduct, backPanelMaterialId: '' });
    expect(errors.some(e => e.field === 'backPanelMaterialId')).toBe(true);
  });

  it('accepts TallUnit with correct height range', () => {
    const errors = validateProduct({
      ...validProduct,
      category: 'TallUnit',
      dimensions: { width: 600, height: 2100, depth: 560 },
    });
    expect(errors.some(e => e.field === 'height')).toBe(false);
  });

  it('rejects TallUnit height below minimum', () => {
    const errors = validateProduct({
      ...validProduct,
      category: 'TallUnit',
      dimensions: { width: 600, height: 500, depth: 560 },
    });
    expect(errors.some(e => e.field === 'height')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════
// 2. UNIT TESTS — calculateParts
// ════════════════════════════════════════════════════════════

describe('calculateParts', () => {
  const baseInput = {
    dimensions: { width: 600, height: 720, depth: 560 },
    category: 'BaseUnit' as const,
    constructionMethod: 'frameless' as const,
    carcassMaterialId: 'mat-mdf',
    doorMaterialId: 'mat-door',
    drawerMaterialId: 'mat-ply',
    backPanelMaterialId: 'mat-hdf',
    materials: MOCK_MATERIALS,
  };

  it('generates parts for a BaseUnit', () => {
    const parts = calculateParts(baseInput);
    expect(parts.length).toBeGreaterThan(0);
  });

  it('includes side panels for BaseUnit', () => {
    const parts = calculateParts(baseInput);
    const sides = parts.filter(p => p.type === 'side');
    expect(sides.length).toBeGreaterThan(0);
    expect(sides[0].quantity).toBe(2);
  });

  it('includes a top panel for BaseUnit', () => {
    const parts = calculateParts(baseInput);
    expect(parts.some(p => p.type === 'top')).toBe(true);
  });

  it('includes a bottom panel for BaseUnit', () => {
    const parts = calculateParts(baseInput);
    expect(parts.some(p => p.type === 'bottom')).toBe(true);
  });

  it('includes a back panel for BaseUnit', () => {
    const parts = calculateParts(baseInput);
    expect(parts.some(p => p.type === 'back')).toBe(true);
  });

  it('includes doors for BaseUnit', () => {
    const parts = calculateParts(baseInput);
    expect(parts.some(p => p.type === 'door')).toBe(true);
  });

  it('includes adjustable shelf for BaseUnit', () => {
    const parts = calculateParts(baseInput);
    expect(parts.some(p => p.type === 'shelf')).toBe(true);
  });

  it('includes face-frame components when method is face-frame', () => {
    const parts = calculateParts({ ...baseInput, constructionMethod: 'face-frame' });
    expect(parts.some(p => p.type === 'face-frame-stile')).toBe(true);
    expect(parts.some(p => p.type === 'face-frame-rail')).toBe(true);
  });

  it('does NOT include face-frame stiles for frameless', () => {
    const parts = calculateParts(baseInput);
    expect(parts.some(p => p.type === 'face-frame-stile')).toBe(false);
  });

  it('part dimensions are positive integers', () => {
    const parts = calculateParts(baseInput);
    parts.forEach(part => {
      expect(part.dimensions.width).toBeGreaterThan(0);
      expect(part.dimensions.height).toBeGreaterThan(0);
      expect(part.dimensions.depth).toBeGreaterThan(0);
    });
  });

  it('generates a single shelf panel for Shelf category', () => {
    const parts = calculateParts({ ...baseInput, category: 'Shelf', dimensions: { width: 600, height: 18, depth: 350 } });
    expect(parts.some(p => p.type === 'shelf')).toBe(true);
  });

  it('generates drawer box parts for Drawer category', () => {
    const parts = calculateParts({
      ...baseInput,
      category: 'Drawer',
      dimensions: { width: 450, height: 200, depth: 450 },
    });
    expect(parts.some(p => p.type === 'drawer-box-side')).toBe(true);
    expect(parts.some(p => p.type === 'drawer-box-front')).toBe(true);
    expect(parts.some(p => p.type === 'drawer-box-back')).toBe(true);
    expect(parts.some(p => p.type === 'drawer-box-bottom')).toBe(true);
  });

  it('TallUnit gets 3 adjustable shelves', () => {
    const parts = calculateParts({
      ...baseInput,
      category: 'TallUnit',
      dimensions: { width: 600, height: 2100, depth: 560 },
    });
    const shelves = parts.filter(p => p.type === 'shelf');
    expect(shelves.reduce((s, p) => s + p.quantity, 0)).toBe(3);
  });

  it('back panel uses backPanelMaterialId', () => {
    const parts = calculateParts(baseInput);
    const back = parts.find(p => p.type === 'back');
    expect(back?.materialId).toBe('mat-hdf');
  });

  it('side panels use carcassMaterialId', () => {
    const parts = calculateParts(baseInput);
    const side = parts.find(p => p.type === 'side');
    expect(side?.materialId).toBe('mat-mdf');
  });

  it('door panels use doorMaterialId', () => {
    const parts = calculateParts(baseInput);
    const door = parts.find(p => p.type === 'door');
    expect(door?.materialId).toBe('mat-door');
  });

  it('wider cabinet produces wider shelf', () => {
    const narrow = calculateParts({ ...baseInput, dimensions: { width: 400, height: 720, depth: 560 } });
    const wide = calculateParts({ ...baseInput, dimensions: { width: 900, height: 720, depth: 560 } });
    const narrowShelf = narrow.find(p => p.type === 'shelf');
    const wideShelf = wide.find(p => p.type === 'shelf');
    expect(wideShelf!.dimensions.width).toBeGreaterThan(narrowShelf!.dimensions.width);
  });
});

// ════════════════════════════════════════════════════════════
// 3. UNIT TESTS — calculateHardware
// ════════════════════════════════════════════════════════════

describe('calculateHardware', () => {
  const baseParts: Part[] = [
    { id: 'door-1', productId: '', name: 'Door', type: 'door', quantity: 2, dimensions: { width: 297, height: 696, depth: 19 }, materialId: 'mat-door' },
    { id: 'shelf-1', productId: '', name: 'Shelf', type: 'shelf', quantity: 1, dimensions: { width: 564, height: 18, depth: 520 }, materialId: 'mat-mdf' },
  ];

  it('calculates 2 hinges per door (BaseUnit)', () => {
    const hw = calculateHardware(MOCK_PRODUCT, baseParts, []);
    const hinges = hw.find(h => h.type === 'hinge');
    expect(hinges?.quantity).toBe(4);
  });

  it('calculates shelf pins for each shelf', () => {
    const hw = calculateHardware(MOCK_PRODUCT, baseParts, []);
    const pins = hw.find(h => h.type === 'clip');
    expect(pins?.quantity).toBe(4);
  });

  it('calculates handles for each door', () => {
    const hw = calculateHardware(MOCK_PRODUCT, baseParts, []);
    const handles = hw.find(h => h.type === 'handle');
    expect(handles?.quantity).toBe(2);
  });

  it('calculates drawer slides for drawer-front parts', () => {
    const partsWithDrawer: Part[] = [
      ...baseParts,
      { id: 'df-1', productId: '', name: 'Drawer Front', type: 'drawer-front', quantity: 1, dimensions: { width: 450, height: 200, depth: 19 }, materialId: 'mat-door' },
    ];
    const hw = calculateHardware(MOCK_PRODUCT, partsWithDrawer, []);
    const slides = hw.find(h => h.type === 'slide');
    expect(slides?.quantity).toBe(2);
  });

  it('returns empty array when no doors, shelves, or drawers', () => {
    const hw = calculateHardware(MOCK_PRODUCT, [], []);
    expect(hw).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════
// 4. HOOK TESTS — useProductForm
// ════════════════════════════════════════════════════════════

describe('useProductForm', () => {
  it('initializes with default product', () => {
    const { result } = renderHook(() => useProductForm());
    expect(result.current.product.category).toBe('BaseUnit');
    expect(result.current.isDirty).toBe(false);
  });

  it('marks dirty when field changes', () => {
    const { result } = renderHook(() => useProductForm());
    hookAct(() => {
      result.current.updateField('name', 'My New Cabinet');
    });
    expect(result.current.isDirty).toBe(true);
  });

  it('updates dimension correctly', () => {
    const { result } = renderHook(() => useProductForm());
    hookAct(() => {
      result.current.updateDimension('width', 900);
    });
    expect(result.current.product.dimensions.width).toBe(900);
  });

  it('validate returns false when name is empty', () => {
    const { result } = renderHook(() => useProductForm());
    let isValid = false;
    hookAct(() => {
      isValid = result.current.validate();
    });
    expect(isValid).toBe(false);
    expect(result.current.errors.some(e => e.field === 'name')).toBe(true);
  });

  it('reset clears dirty state', () => {
    const { result } = renderHook(() => useProductForm());
    hookAct(() => {
      result.current.updateField('name', 'Changed');
    });
    expect(result.current.isDirty).toBe(true);
    hookAct(() => {
      result.current.reset();
    });
    expect(result.current.isDirty).toBe(false);
  });

  it('getFieldError returns correct message', () => {
    const { result } = renderHook(() => useProductForm());
    hookAct(() => {
      result.current.validate();
    });
    expect(result.current.getFieldError('name')).toBeTruthy();
  });

  it('clears field error on update', () => {
    const { result } = renderHook(() => useProductForm());
    hookAct(() => {
      result.current.validate();
    });
    expect(result.current.getFieldError('name')).toBeTruthy();
    hookAct(() => {
      result.current.updateField('name', 'Valid Name');
    });
    expect(result.current.getFieldError('name')).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════
// 5. COMPONENT TESTS — DimensionsPanel
// ════════════════════════════════════════════════════════════

describe('DimensionsPanel', () => {
  const defaultProps = {
    category: 'BaseUnit' as const,
    dimensions: { width: 600, height: 720, depth: 560 },
    errors: [] as ValidationError[],
    onChange: vi.fn(),
  };

  it('renders width, height, depth inputs', () => {
    render(<DimensionsPanel {...defaultProps} />);
    expect(screen.getByLabelText('Width')).toBeInTheDocument();
    expect(screen.getByLabelText('Height')).toBeInTheDocument();
    expect(screen.getByLabelText('Depth')).toBeInTheDocument();
  });

  it('shows current dimension values', () => {
    render(<DimensionsPanel {...defaultProps} />);
    expect(screen.getByLabelText('Width')).toHaveValue(600);
    expect(screen.getByLabelText('Height')).toHaveValue(720);
    expect(screen.getByLabelText('Depth')).toHaveValue(560);
  });

  it('calls onChange when width input changes', async () => {
    const onChange = vi.fn();
    render(<DimensionsPanel {...defaultProps} onChange={onChange} />);
    const widthInput = screen.getByLabelText('Width');
    fireEvent.change(widthInput, { target: { value: '800' } });
    expect(onChange).toHaveBeenCalledWith('width', 800);
  });

  it('shows validation error for width', () => {
    render(
      <DimensionsPanel
        {...defaultProps}
        errors={[{ field: 'width', message: 'Width must be between 150mm and 1200mm' }]}
      />
    );
    expect(screen.getByText(/Width must be between/)).toBeInTheDocument();
  });

  it('shows min/max range hints', () => {
    render(<DimensionsPanel {...defaultProps} />);
    expect(screen.getByText('150–1200 mm')).toBeInTheDocument();
  });

  it('changes constraints when category changes to WallUnit', () => {
    const { rerender } = render(<DimensionsPanel {...defaultProps} />);
    rerender(<DimensionsPanel {...defaultProps} category="WallUnit" />);
    expect(screen.getByText('150–400 mm')).toBeInTheDocument();
  });

  it('has data-testid "dimensions-panel"', () => {
    render(<DimensionsPanel {...defaultProps} />);
    expect(screen.getByTestId('dimensions-panel')).toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════════
// 6. COMPONENT TESTS — MaterialSelector
// ════════════════════════════════════════════════════════════

describe('MaterialSelector', () => {
  const defaultProps = {
    materials: MOCK_MATERIALS,
    loading: false,
    carcassMaterialId: '',
    doorMaterialId: '',
    drawerMaterialId: '',
    backPanelMaterialId: '',
    errors: [] as ValidationError[],
    onChange: vi.fn(),
  };

  it('renders four material dropdowns', () => {
    render(<MaterialSelector {...defaultProps} />);
    expect(screen.getByLabelText('Carcass Material')).toBeInTheDocument();
    expect(screen.getByLabelText('Door Material')).toBeInTheDocument();
    expect(screen.getByLabelText('Drawer Material')).toBeInTheDocument();
    expect(screen.getByLabelText('Back Panel Material')).toBeInTheDocument();
  });

  it('populates dropdowns with material options', () => {
    render(<MaterialSelector {...defaultProps} />);
    const selects = screen.getAllByRole('combobox');
    expect(within(selects[0]).getByText('MDF 18mm (18mm)')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<MaterialSelector {...defaultProps} loading />);
    expect(screen.getByText('Loading materials…')).toBeInTheDocument();
  });

  it('disables selects when loading', () => {
    render(<MaterialSelector {...defaultProps} loading />);
    const selects = screen.getAllByRole('combobox');
    selects.forEach(s => expect(s).toBeDisabled());
  });

  it('calls onChange with correct field and value', () => {
    const onChange = vi.fn();
    render(<MaterialSelector {...defaultProps} onChange={onChange} />);
    const carcassSelect = screen.getByLabelText('Carcass Material');
    fireEvent.change(carcassSelect, { target: { value: 'mat-mdf' } });
    expect(onChange).toHaveBeenCalledWith('carcassMaterialId', 'mat-mdf');
  });

  it('shows validation error for missing carcass material', () => {
    render(
      <MaterialSelector
        {...defaultProps}
        errors={[{ field: 'carcassMaterialId', message: 'Carcass material is required' }]}
      />
    );
    expect(screen.getByText('Carcass material is required')).toBeInTheDocument();
  });

  it('has data-testid "material-selector"', () => {
    render(<MaterialSelector {...defaultProps} />);
    expect(screen.getByTestId('material-selector')).toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════════
// 7. COMPONENT TESTS — PartsTable
// ════════════════════════════════════════════════════════════

describe('PartsTable', () => {
  const mockParts: Part[] = [
    { id: 'side-1', productId: '', name: 'Side Panel', type: 'side', quantity: 2, dimensions: { width: 18, height: 720, depth: 542 }, materialId: 'mat-mdf' },
    { id: 'top-1', productId: '', name: 'Top Panel', type: 'top', quantity: 1, dimensions: { width: 564, height: 18, depth: 542 }, materialId: 'mat-mdf' },
  ];

  it('renders a table when parts are provided', () => {
    render(<PartsTable parts={mockParts} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders a row for each part', () => {
    render(<PartsTable parts={mockParts} />);
    expect(screen.getByText('Side Panel')).toBeInTheDocument();
    expect(screen.getByText('Top Panel')).toBeInTheDocument();
  });

  it('shows empty state when no parts', () => {
    render(<PartsTable parts={[]} />);
    expect(screen.getByText(/No parts calculated/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows total part count badge', () => {
    render(<PartsTable parts={mockParts} />);
    expect(screen.getByText('3 pcs')).toBeInTheDocument();
  });

  it('shows material name when materialNames provided', () => {
    render(<PartsTable parts={mockParts} materialNames={{ 'mat-mdf': 'MDF 18mm' }} />);
    expect(screen.getAllByText('MDF 18mm').length).toBeGreaterThan(0);
  });

  it('shows dimension values in the table', () => {
    render(<PartsTable parts={mockParts} />);
    expect(screen.getByText('542')).toBeInTheDocument();
  });

  it('has data-testid "parts-table"', () => {
    render(<PartsTable parts={[]} />);
    expect(screen.getByTestId('parts-table')).toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════════
// 8. COMPONENT TESTS — HardwarePanel
// ════════════════════════════════════════════════════════════

describe('HardwarePanel', () => {
  it('renders hardware items', () => {
    render(
      <HardwarePanel
        requirements={[
          { hardwareId: 'hinge', name: 'Soft-Close Hinge', type: 'hinge', quantity: 4, notes: '2 per door × 2 doors' },
        ]}
      />
    );
    expect(screen.getByText('Soft-Close Hinge')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows empty state when no requirements', () => {
    render(<HardwarePanel requirements={[]} />);
    expect(screen.getByText(/Hardware requirements will appear/)).toBeInTheDocument();
  });

  it('shows hardware notes', () => {
    render(
      <HardwarePanel
        requirements={[
          { hardwareId: 'slide', name: 'Drawer Slide', type: 'slide', quantity: 2, notes: 'Pair per drawer' },
        ]}
      />
    );
    expect(screen.getByText('Pair per drawer')).toBeInTheDocument();
  });

  it('has data-testid "hardware-panel"', () => {
    render(<HardwarePanel requirements={[]} />);
    expect(screen.getByTestId('hardware-panel')).toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════════
// 9. COMPONENT TESTS — EdgingConfig
// ════════════════════════════════════════════════════════════

describe('EdgingConfig', () => {
  const mockPart: Part = {
    id: 'side-1',
    productId: '',
    name: 'Side Panel',
    type: 'side',
    quantity: 2,
    dimensions: { width: 18, height: 720, depth: 542 },
    materialId: 'mat-mdf',
  };

  it('shows empty state when no parts', () => {
    render(<EdgingConfig parts={[]} materials={MOCK_MATERIALS} edging={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/Configure dimensions/)).toBeInTheDocument();
  });

  it('lists part names as expand buttons', () => {
    render(<EdgingConfig parts={[mockPart]} materials={MOCK_MATERIALS} edging={[]} onChange={vi.fn()} />);
    expect(screen.getByText('Side Panel')).toBeInTheDocument();
  });

  it('expands detail on button click', async () => {
    render(<EdgingConfig parts={[mockPart]} materials={MOCK_MATERIALS} edging={[]} onChange={vi.fn()} />);
    const btn = screen.getByText('Side Panel');
    await userEvent.click(btn);
    expect(screen.getByTestId(`edging-detail-side-1`)).toBeInTheDocument();
  });

  it('calls onChange when edge checkbox is toggled', async () => {
    const onChange = vi.fn();
    render(<EdgingConfig parts={[mockPart]} materials={MOCK_MATERIALS} edging={[]} onChange={onChange} />);
    await userEvent.click(screen.getByText('Side Panel'));
    const checkbox = screen.getByTestId('edge-side-1-top');
    await userEvent.click(checkbox);
    expect(onChange).toHaveBeenCalled();
    const [newEdging] = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(newEdging[0].edges.top).toBe(true);
  });

  it('has data-testid "edging-config"', () => {
    render(<EdgingConfig parts={[]} materials={MOCK_MATERIALS} edging={[]} onChange={vi.fn()} />);
    expect(screen.getByTestId('edging-config')).toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════════
// 10. INTEGRATION TESTS — ProductEditor main component
// ════════════════════════════════════════════════════════════

describe('ProductEditor — rendering', () => {
  beforeEach(() => {
    mockApiSuccess();
  });

  it('renders the product editor', async () => {
    renderEditor();
    expect(screen.getByTestId('product-editor')).toBeInTheDocument();
  });

  it('renders the product name input', async () => {
    renderEditor();
    await waitForMaterials();
    expect(screen.getByTestId('input-name')).toBeInTheDocument();
  });

  it('renders all category buttons', async () => {
    renderEditor();
    await waitForMaterials();
    expect(screen.getByTestId('category-BaseUnit')).toBeInTheDocument();
    expect(screen.getByTestId('category-WallUnit')).toBeInTheDocument();
    expect(screen.getByTestId('category-TallUnit')).toBeInTheDocument();
  });

  it('renders construction method buttons', async () => {
    renderEditor();
    await waitForMaterials();
    expect(screen.getByTestId('construction-frameless')).toBeInTheDocument();
    expect(screen.getByTestId('construction-face-frame')).toBeInTheDocument();
    expect(screen.getByTestId('construction-inset')).toBeInTheDocument();
  });

  it('renders Save and Cancel buttons', async () => {
    renderEditor();
    expect(screen.getByTestId('btn-save')).toBeInTheDocument();
    expect(screen.getByTestId('btn-cancel')).toBeInTheDocument();
  });

  it('shows "Create Product" on save button for new product', async () => {
    renderEditor();
    expect(screen.getByTestId('btn-save')).toHaveTextContent('Create Product');
  });

  it('shows "Update Product" when editing an existing product', async () => {
    renderEditor({ productId: 'prod-001' });
    await waitFor(() => expect(screen.getByTestId('btn-save')).toHaveTextContent('Update Product'));
  });
});

// ════════════════════════════════════════════════════════════
// 11. INTEGRATION TESTS — Form interactions
// ════════════════════════════════════════════════════════════

describe('ProductEditor — form interactions', () => {
  beforeEach(() => {
    mockApiSuccess();
  });

  it('shows dirty badge when name is changed', async () => {
    renderEditor();
    await waitForMaterials();
    await userEvent.type(screen.getByTestId('input-name'), 'My Cabinet');
    expect(screen.getByTestId('dirty-badge')).toBeInTheDocument();
  });

  it('shows validation error when saving with empty name', async () => {
    renderEditor();
    await waitForMaterials();
    await userEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(screen.getByTestId('name-error')).toBeInTheDocument());
  });

  it('changing category selects the new category', async () => {
    renderEditor();
    await waitForMaterials();
    await userEvent.click(screen.getByTestId('category-WallUnit'));
    expect(screen.getByTestId('category-WallUnit')).toHaveAttribute('aria-checked', 'true');
  });

  it('changing construction method selects the new method', async () => {
    renderEditor();
    await waitForMaterials();
    await userEvent.click(screen.getByTestId('construction-face-frame'));
    expect(screen.getByTestId('construction-face-frame')).toHaveAttribute('aria-checked', 'true');
  });

  it('cancel button calls onCancel callback', async () => {
    const onCancel = vi.fn();
    renderEditor({ onCancel });
    await userEvent.click(screen.getByTestId('btn-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('switching to parts tab shows parts table', async () => {
    renderEditor();
    await waitForMaterials();
    await userEvent.click(screen.getByTestId('tab-parts'));
    expect(screen.getByTestId('parts-table')).toBeInTheDocument();
  });

  it('switching to hardware tab shows hardware panel', async () => {
    renderEditor();
    await waitForMaterials();
    await userEvent.click(screen.getByTestId('tab-hardware'));
    expect(screen.getByTestId('hardware-panel')).toBeInTheDocument();
  });

  it('switching to edging tab shows edging config', async () => {
    renderEditor();
    await waitForMaterials();
    await userEvent.click(screen.getByTestId('tab-edging'));
    expect(screen.getByTestId('edging-config')).toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════════
// 12. INTEGRATION TESTS — Save flow
// ════════════════════════════════════════════════════════════

describe('ProductEditor — save flow', () => {
  beforeEach(() => {
    mockApiSuccess();
  });

  it('calls createProduct for a new product on save', async () => {
    renderEditor();
    await waitForMaterials();

    await userEvent.type(screen.getByTestId('input-name'), 'New Cabinet');
    const selects = screen.getAllByRole('combobox');
    for (const select of selects) {
      fireEvent.change(select, { target: { value: 'mat-mdf' } });
    }

    await userEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(api.createProduct).toHaveBeenCalled());
  });

  it('calls updateProduct for an existing product on save', async () => {
    renderEditor({ productId: 'prod-001' });
    await waitFor(() => screen.getByDisplayValue('Test Base Cabinet'));

    await userEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(api.updateProduct).toHaveBeenCalledWith('prod-001', expect.any(Object)));
  });

  it('shows success toast after save', async () => {
    renderEditor();
    await waitForMaterials();

    await userEvent.type(screen.getByTestId('input-name'), 'My Cabinet');
    const selects = screen.getAllByRole('combobox');
    for (const select of selects) {
      fireEvent.change(select, { target: { value: 'mat-mdf' } });
    }

    await userEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/saved successfully/));
  });

  it('shows error toast when save fails', async () => {
    vi.mocked(api.createProduct).mockRejectedValueOnce(new Error('Network error'));
    renderEditor();
    await waitForMaterials();

    await userEvent.type(screen.getByTestId('input-name'), 'My Cabinet');
    const selects = screen.getAllByRole('combobox');
    for (const select of selects) {
      fireEvent.change(select, { target: { value: 'mat-mdf' } });
    }

    await userEvent.click(screen.getByTestId('btn-save'));
    await waitFor(() => expect(screen.getByTestId('save-error-banner')).toBeInTheDocument());
  });
});
