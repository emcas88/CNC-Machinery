// ─────────────────────────────────────────────────────────────────────────────
// PartEditor — Test Suite  (vitest + React Testing Library)
// ─────────────────────────────────────────────────────────────────────────────
//
// Run:  npx vitest run features/frontend/PartEditor/PartEditor.test.tsx
//       npx vitest run --coverage features/frontend/PartEditor/
//
// ─────────────────────────────────────────────────────────────────────────────

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

// ── Modules under test ────────────────────────────────────────────────────────
import { PartEditor } from './PartEditor';
import { DimensionsEditor } from './components/DimensionsEditor';
import { EdgeBandingPanel } from './components/EdgeBandingPanel';
import { PartOutlineSVG } from './components/PartOutlineSVG';
import { OperationsTable } from './components/OperationsTable';
import { OperationForm } from './components/OperationForm';
import * as api from './api';

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Part,
  Operation,
  EdgeBanding,
  Dimensions,
  Material,
  ValidationErrors,
} from './types';

const MOCK_PART: Part = {
  id: 'part-1',
  name: 'Top Panel',
  productId: 'prod-1',
  productName: 'Wardrobe Unit',
  dimensions: { length: 600, width: 400, thickness: 18 },
  materialOverrideId: null,
  grainDirection: 'Horizontal',
  edgeBanding: {
    top:    { side: 'top',    enabled: false, materialId: null },
    bottom: { side: 'bottom', enabled: false, materialId: null },
    left:   { side: 'left',   enabled: false, materialId: null },
    right:  { side: 'right',  enabled: false, materialId: null },
  },
  operations: [],
  notes: 'Initial notes',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const MOCK_OPERATIONS: Operation[] = [
  {
    id: 'op-1',
    type: 'Bore',
    position: { x: 50, y: 50 },
    depth: 10,
    diameter: 5,
    toolId: 'tool-a',
    toolName: 'Forstner 5mm',
    notes: 'Hinge bore',
  },
  {
    id: 'op-2',
    type: 'Dado',
    position: { x: 100, y: 0 },
    depth: 8,
    width: 18,
    length: 400,
    notes: 'Shelf dado',
  },
];

const MOCK_MATERIALS: Material[] = [
  { id: 'mat-1', name: 'Oak Veneer', thickness: 0.6 },
  { id: 'mat-2', name: 'White ABS 1mm', thickness: 1.0 },
];

const MOCK_EDGE_BANDING: EdgeBanding = {
  top:    { side: 'top',    enabled: false, materialId: null },
  bottom: { side: 'bottom', enabled: true,  materialId: 'mat-1' },
  left:   { side: 'left',   enabled: true,  materialId: null },
  right:  { side: 'right',  enabled: false, materialId: null },
};

const MOCK_DIMENSIONS: Dimensions = { length: 600, width: 400, thickness: 18 };

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('./api', () => ({
  getPart: vi.fn(),
  updatePart: vi.fn(),
  listOperations: vi.fn(),
  addOperation: vi.fn(),
  updateOperation: vi.fn(),
  deleteOperation: vi.fn(),
  listMaterials: vi.fn(),
}));

const mockGetPart = api.getPart as ReturnType<typeof vi.fn>;
const mockUpdatePart = api.updatePart as ReturnType<typeof vi.fn>;
const mockListOperations = api.listOperations as ReturnType<typeof vi.fn>;
const mockAddOperation = api.addOperation as ReturnType<typeof vi.fn>;
const mockUpdateOperation = api.updateOperation as ReturnType<typeof vi.fn>;
const mockDeleteOperation = api.deleteOperation as ReturnType<typeof vi.fn>;

function setupApiMocks(
  part: Part = MOCK_PART,
  operations: Operation[] = MOCK_OPERATIONS
) {
  mockGetPart.mockResolvedValue(part);
  mockListOperations.mockResolvedValue(operations);
  mockUpdatePart.mockImplementation((_id, payload) =>
    Promise.resolve({ ...part, ...payload })
  );
  mockAddOperation.mockImplementation((_id, payload) =>
    Promise.resolve({ id: 'op-new', ...payload })
  );
  mockUpdateOperation.mockImplementation((_partId, opId, payload) =>
    Promise.resolve({ id: opId, ...MOCK_OPERATIONS[0], ...payload })
  );
  mockDeleteOperation.mockResolvedValue(undefined);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DimensionsEditor
// ─────────────────────────────────────────────────────────────────────────────

describe('DimensionsEditor', () => {
  const noop = vi.fn();
  const noErrors: ValidationErrors = {};

  it('renders all three dimension fields', () => {
    render(
      <DimensionsEditor dimensions={MOCK_DIMENSIONS} errors={noErrors} onChange={noop} />
    );
    expect(screen.getByLabelText('Length')).toBeInTheDocument();
    expect(screen.getByLabelText('Width')).toBeInTheDocument();
    expect(screen.getByLabelText('Thickness')).toBeInTheDocument();
  });

  it('displays correct initial values', () => {
    render(
      <DimensionsEditor dimensions={MOCK_DIMENSIONS} errors={noErrors} onChange={noop} />
    );
    expect((screen.getByLabelText('Length') as HTMLInputElement).value).toBe('600');
    expect((screen.getByLabelText('Width') as HTMLInputElement).value).toBe('400');
    expect((screen.getByLabelText('Thickness') as HTMLInputElement).value).toBe('18');
  });

  it('calls onChange with correct field and value', async () => {
    const onChange = vi.fn();
    render(
      <DimensionsEditor dimensions={MOCK_DIMENSIONS} errors={noErrors} onChange={onChange} />
    );
    await userEvent.clear(screen.getByLabelText('Length'));
    await userEvent.type(screen.getByLabelText('Length'), '750');
    expect(onChange).toHaveBeenCalledWith('length', expect.any(Number));
  });

  it('shows validation error for length', () => {
    render(
      <DimensionsEditor
        dimensions={MOCK_DIMENSIONS}
        errors={{ length: 'Length must be greater than 0.' }}
        onChange={noop}
      />
    );
    expect(screen.getByText('Length must be greater than 0.')).toBeInTheDocument();
  });

  it('shows validation error for width', () => {
    render(
      <DimensionsEditor
        dimensions={MOCK_DIMENSIONS}
        errors={{ width: 'Width must be greater than 0.' }}
        onChange={noop}
      />
    );
    expect(screen.getByText('Width must be greater than 0.')).toBeInTheDocument();
  });

  it('shows validation error for thickness', () => {
    render(
      <DimensionsEditor
        dimensions={MOCK_DIMENSIONS}
        errors={{ thickness: 'Thickness must be greater than 0.' }}
        onChange={noop}
      />
    );
    expect(screen.getByText('Thickness must be greater than 0.')).toBeInTheDocument();
  });

  it('marks the errored input as aria-invalid', () => {
    render(
      <DimensionsEditor
        dimensions={MOCK_DIMENSIONS}
        errors={{ length: 'Error' }}
        onChange={noop}
      />
    );
    expect(screen.getByLabelText('Length')).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables all inputs when disabled=true', () => {
    render(
      <DimensionsEditor
        dimensions={MOCK_DIMENSIONS}
        errors={noErrors}
        onChange={noop}
        disabled
      />
    );
    expect(screen.getByLabelText('Length')).toBeDisabled();
    expect(screen.getByLabelText('Width')).toBeDisabled();
    expect(screen.getByLabelText('Thickness')).toBeDisabled();
  });

  it('has accessible group role and label', () => {
    render(
      <DimensionsEditor dimensions={MOCK_DIMENSIONS} errors={noErrors} onChange={noop} />
    );
    expect(screen.getByRole('group', { name: 'Part dimensions' })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. EdgeBandingPanel
// ─────────────────────────────────────────────────────────────────────────────

describe('EdgeBandingPanel', () => {
  const noop = vi.fn();

  it('renders all four edge toggles', () => {
    render(
      <EdgeBandingPanel
        edgeBanding={MOCK_EDGE_BANDING}
        materials={MOCK_MATERIALS}
        onToggle={noop}
        onMaterialChange={noop}
      />
    );
    expect(screen.getByLabelText('Enable Top Edge')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable Bottom Edge')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable Left Edge')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable Right Edge')).toBeInTheDocument();
  });

  it('checks enabled edges', () => {
    render(
      <EdgeBandingPanel
        edgeBanding={MOCK_EDGE_BANDING}
        materials={MOCK_MATERIALS}
        onToggle={noop}
        onMaterialChange={noop}
      />
    );
    expect(screen.getByLabelText('Enable Bottom Edge')).toBeChecked();
    expect(screen.getByLabelText('Enable Left Edge')).toBeChecked();
    expect(screen.getByLabelText('Enable Top Edge')).not.toBeChecked();
    expect(screen.getByLabelText('Enable Right Edge')).not.toBeChecked();
  });

  it('shows material select for enabled edges', () => {
    render(
      <EdgeBandingPanel
        edgeBanding={MOCK_EDGE_BANDING}
        materials={MOCK_MATERIALS}
        onToggle={noop}
        onMaterialChange={noop}
      />
    );
    expect(screen.getByLabelText('Bottom Edge material')).toBeInTheDocument();
    expect(screen.getByLabelText('Left Edge material')).toBeInTheDocument();
    expect(screen.queryByLabelText('Top Edge material')).not.toBeInTheDocument();
  });

  it('calls onToggle when checkbox changes', async () => {
    const onToggle = vi.fn();
    render(
      <EdgeBandingPanel
        edgeBanding={MOCK_EDGE_BANDING}
        materials={MOCK_MATERIALS}
        onToggle={onToggle}
        onMaterialChange={noop}
      />
    );
    await userEvent.click(screen.getByLabelText('Enable Top Edge'));
    expect(onToggle).toHaveBeenCalledWith('top');
  });

  it('calls onMaterialChange when material dropdown changes', async () => {
    const onMaterialChange = vi.fn();
    render(
      <EdgeBandingPanel
        edgeBanding={MOCK_EDGE_BANDING}
        materials={MOCK_MATERIALS}
        onToggle={noop}
        onMaterialChange={onMaterialChange}
      />
    );
    await userEvent.selectOptions(
      screen.getByLabelText('Bottom Edge material'),
      'mat-2'
    );
    expect(onMaterialChange).toHaveBeenCalledWith('bottom', 'mat-2');
  });

  it('disables checkboxes when disabled=true', () => {
    render(
      <EdgeBandingPanel
        edgeBanding={MOCK_EDGE_BANDING}
        materials={MOCK_MATERIALS}
        onToggle={noop}
        onMaterialChange={noop}
        disabled
      />
    );
    screen.getAllByRole('checkbox').forEach((cb) => {
      expect(cb).toBeDisabled();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. PartOutlineSVG
// ─────────────────────────────────────────────────────────────────────────────

describe('PartOutlineSVG', () => {
  it('renders an svg element', () => {
    render(
      <PartOutlineSVG
        dimensions={MOCK_DIMENSIONS}
        operations={[]}
        grainDirection="None"
      />
    );
    expect(screen.getByTestId('part-outline-svg')).toBeInTheDocument();
  });

  it('renders the part rectangle', () => {
    render(
      <PartOutlineSVG
        dimensions={MOCK_DIMENSIONS}
        operations={[]}
        grainDirection="None"
      />
    );
    expect(screen.getByTestId('part-rect')).toBeInTheDocument();
  });

  it('renders dimension labels', () => {
    render(
      <PartOutlineSVG
        dimensions={MOCK_DIMENSIONS}
        operations={[]}
        grainDirection="None"
      />
    );
    expect(screen.getByTestId('dim-label-length')).toHaveTextContent('600 mm');
    expect(screen.getByTestId('dim-label-width')).toHaveTextContent('400 mm');
  });

  it('renders operation markers', () => {
    render(
      <PartOutlineSVG
        dimensions={MOCK_DIMENSIONS}
        operations={MOCK_OPERATIONS}
        grainDirection="None"
      />
    );
    expect(screen.getByTestId('op-marker-op-1')).toBeInTheDocument();
    expect(screen.getByTestId('op-marker-op-2')).toBeInTheDocument();
  });

  it('renders operation legend when operations exist', () => {
    render(
      <PartOutlineSVG
        dimensions={MOCK_DIMENSIONS}
        operations={MOCK_OPERATIONS}
        grainDirection="None"
      />
    );
    expect(screen.getByTestId('op-legend')).toBeInTheDocument();
  });

  it('does not render legend when no operations', () => {
    render(
      <PartOutlineSVG
        dimensions={MOCK_DIMENSIONS}
        operations={[]}
        grainDirection="None"
      />
    );
    expect(screen.queryByTestId('op-legend')).not.toBeInTheDocument();
  });

  it('renders grain lines for Horizontal direction', () => {
    render(
      <PartOutlineSVG
        dimensions={MOCK_DIMENSIONS}
        operations={[]}
        grainDirection="Horizontal"
      />
    );
    const grainGroup = screen.getByLabelText('Grain direction: Horizontal');
    expect(grainGroup).toBeInTheDocument();
  });

  it('does not render grain group for None direction', () => {
    render(
      <PartOutlineSVG
        dimensions={MOCK_DIMENSIONS}
        operations={[]}
        grainDirection="None"
      />
    );
    expect(screen.queryByLabelText(/Grain direction/)).not.toBeInTheDocument();
  });

  it('has accessible role="img" and aria-label', () => {
    render(
      <PartOutlineSVG
        dimensions={MOCK_DIMENSIONS}
        operations={[]}
        grainDirection="None"
      />
    );
    expect(screen.getByRole('img', { name: 'Part 2D outline preview' })).toBeInTheDocument();
  });

  it('respects custom canvas size', () => {
    render(
      <PartOutlineSVG
        dimensions={MOCK_DIMENSIONS}
        operations={[]}
        grainDirection="None"
        canvasSize={500}
      />
    );
    const svg = screen.getByTestId('part-outline-svg');
    expect(svg).toHaveAttribute('width', '500');
    expect(svg).toHaveAttribute('height', '500');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. OperationsTable
// ─────────────────────────────────────────────────────────────────────────────

describe('OperationsTable', () => {
  const noop = vi.fn();

  it('renders loading state', () => {
    render(
      <OperationsTable
        operations={[]}
        isLoading={true}
        isMutating={false}
        onEdit={noop}
        onDelete={noop}
        onAdd={noop}
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
  });

  it('renders empty state when no operations', () => {
    render(
      <OperationsTable
        operations={[]}
        isLoading={false}
        isMutating={false}
        onEdit={noop}
        onDelete={noop}
        onAdd={noop}
      />
    );
    expect(screen.getByTestId('operations-empty')).toBeInTheDocument();
  });

  it('renders operation rows', () => {
    render(
      <OperationsTable
        operations={MOCK_OPERATIONS}
        isLoading={false}
        isMutating={false}
        onEdit={noop}
        onDelete={noop}
        onAdd={noop}
      />
    );
    expect(screen.getByTestId('op-row-op-1')).toBeInTheDocument();
    expect(screen.getByTestId('op-row-op-2')).toBeInTheDocument();
  });

  it('calls onAdd when add button is clicked', async () => {
    const onAdd = vi.fn();
    render(
      <OperationsTable
        operations={[]}
        isLoading={false}
        isMutating={false}
        onEdit={noop}
        onDelete={noop}
        onAdd={onAdd}
      />
    );
    await userEvent.click(screen.getByTestId('add-operation-btn'));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('calls onEdit when edit button is clicked', async () => {
    const onEdit = vi.fn();
    render(
      <OperationsTable
        operations={MOCK_OPERATIONS}
        isLoading={false}
        isMutating={false}
        onEdit={onEdit}
        onDelete={noop}
        onAdd={noop}
      />
    );
    await userEvent.click(screen.getByTestId('edit-op-op-1'));
    expect(onEdit).toHaveBeenCalledWith(MOCK_OPERATIONS[0]);
  });

  it('shows confirm/cancel buttons after delete click', async () => {
    render(
      <OperationsTable
        operations={MOCK_OPERATIONS}
        isLoading={false}
        isMutating={false}
        onEdit={noop}
        onDelete={noop}
        onAdd={noop}
      />
    );
    await userEvent.click(screen.getByTestId('delete-op-op-1'));
    expect(screen.getByTestId('confirm-delete-op-1')).toBeInTheDocument();
  });

  it('calls onDelete after confirm', async () => {
    const onDelete = vi.fn();
    render(
      <OperationsTable
        operations={MOCK_OPERATIONS}
        isLoading={false}
        isMutating={false}
        onEdit={noop}
        onDelete={onDelete}
        onAdd={noop}
      />
    );
    await userEvent.click(screen.getByTestId('delete-op-op-1'));
    await userEvent.click(screen.getByTestId('confirm-delete-op-1'));
    expect(onDelete).toHaveBeenCalledWith('op-1');
  });

  it('hides confirm buttons after cancel', async () => {
    render(
      <OperationsTable
        operations={MOCK_OPERATIONS}
        isLoading={false}
        isMutating={false}
        onEdit={noop}
        onDelete={noop}
        onAdd={noop}
      />
    );
    await userEvent.click(screen.getByTestId('delete-op-op-1'));
    await userEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('confirm-delete-op-1')).not.toBeInTheDocument();
  });

  it('disables add button when mutating', () => {
    render(
      <OperationsTable
        operations={[]}
        isLoading={false}
        isMutating={true}
        onEdit={noop}
        onDelete={noop}
        onAdd={noop}
      />
    );
    expect(screen.getByTestId('add-operation-btn')).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. OperationForm
// ─────────────────────────────────────────────────────────────────────────────

describe('OperationForm', () => {
  const noop = vi.fn();

  it('does not render when isOpen=false', () => {
    render(
      <OperationForm isOpen={false} onClose={noop} onSubmit={noop} />
    );
    expect(screen.queryByTestId('operation-form-modal')).not.toBeInTheDocument();
  });

  it('renders the modal when isOpen=true', () => {
    render(
      <OperationForm isOpen={true} onClose={noop} onSubmit={noop} />
    );
    expect(screen.getByTestId('operation-form-modal')).toBeInTheDocument();
  });

  it('shows "Add Operation" title in add mode', () => {
    render(
      <OperationForm isOpen={true} onClose={noop} onSubmit={noop} />
    );
    expect(screen.getByText('Add Operation')).toBeInTheDocument();
  });

  it('shows "Edit Operation" title in edit mode', () => {
    render(
      <OperationForm
        isOpen={true}
        operation={MOCK_OPERATIONS[0]}
        onClose={noop}
        onSubmit={noop}
      />
    );
    expect(screen.getByText('Edit Operation')).toBeInTheDocument();
  });

  it('pre-populates form when editing', () => {
    render(
      <OperationForm
        isOpen={true}
        operation={MOCK_OPERATIONS[0]}
        onClose={noop}
        onSubmit={noop}
      />
    );
    expect(
      (screen.getByLabelText('X Position (mm)') as HTMLInputElement).value
    ).toBe('50');
    expect(
      (screen.getByLabelText('Y Position (mm)') as HTMLInputElement).value
    ).toBe('50');
    expect(
      (screen.getByLabelText('Depth (mm)') as HTMLInputElement).value
    ).toBe('10');
  });

  it('shows diameter field for Bore type', () => {
    render(
      <OperationForm
        isOpen={true}
        operation={MOCK_OPERATIONS[0]}
        onClose={noop}
        onSubmit={noop}
      />
    );
    expect(screen.getByLabelText('Diameter (mm)')).toBeInTheDocument();
  });

  it('shows width and length fields for Dado type', async () => {
    render(
      <OperationForm isOpen={true} onClose={noop} onSubmit={noop} />
    );
    await userEvent.selectOptions(screen.getByLabelText('Operation Type'), 'Dado');
    expect(screen.getByLabelText('Width (mm)')).toBeInTheDocument();
    expect(screen.getByLabelText('Length (mm)')).toBeInTheDocument();
  });

  it('shows width and length fields for Pocket type', async () => {
    render(
      <OperationForm isOpen={true} onClose={noop} onSubmit={noop} />
    );
    await userEvent.selectOptions(screen.getByLabelText('Operation Type'), 'Pocket');
    expect(screen.getByLabelText('Width (mm)')).toBeInTheDocument();
    expect(screen.getByLabelText('Length (mm)')).toBeInTheDocument();
  });

  it('shows diameter for Drill type', async () => {
    render(
      <OperationForm isOpen={true} onClose={noop} onSubmit={noop} />
    );
    await userEvent.selectOptions(screen.getByLabelText('Operation Type'), 'Drill');
    expect(screen.getByLabelText('Diameter (mm)')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn();
    render(
      <OperationForm isOpen={true} onClose={onClose} onSubmit={noop} />
    );
    await userEvent.click(screen.getByTestId('op-form-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when cancel button clicked', async () => {
    const onClose = vi.fn();
    render(
      <OperationForm isOpen={true} onClose={onClose} onSubmit={noop} />
    );
    await userEvent.click(screen.getByTestId('op-form-cancel'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows depth validation error on submit with invalid depth', async () => {
    render(
      <OperationForm isOpen={true} onClose={noop} onSubmit={noop} />
    );
    await userEvent.clear(screen.getByLabelText('Depth (mm)'));
    await userEvent.type(screen.getByLabelText('Depth (mm)'), '-5');
    await userEvent.click(screen.getByTestId('op-form-submit'));
    expect(screen.getByText('Depth must be > 0.')).toBeInTheDocument();
  });

  it('calls onSubmit with correct payload on valid submission', async () => {
    const onSubmit = vi.fn();
    render(
      <OperationForm isOpen={true} onClose={noop} onSubmit={onSubmit} />
    );
    // Default type is 'Bore' – fill in required diameter
    await userEvent.type(screen.getByLabelText('Diameter (mm)'), '8');
    await userEvent.click(screen.getByTestId('op-form-submit'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Bore',
        depth: expect.any(Number),
        position: expect.objectContaining({ x: expect.any(Number) }),
      })
    );
  });

  it('disables submit button when isSaving=true', () => {
    render(
      <OperationForm isOpen={true} onClose={noop} onSubmit={noop} isSaving={true} />
    );
    expect(screen.getByTestId('op-form-submit')).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. PartEditor — integration-level tests
// ─────────────────────────────────────────────────────────────────────────────

describe('PartEditor integration', () => {
  beforeEach(() => {
    setupApiMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading & error states ────────────────────────────────────────────────

  it('shows loading indicator while fetching', async () => {
    // Delay resolution so we can see the loading state
    mockGetPart.mockReturnValue(new Promise(() => {}));
    render(<PartEditor partId="part-1" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders part editor after successful load', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() =>
      expect(screen.getByTestId('part-editor')).toBeInTheDocument()
    );
  });

  it('shows error state when API fails', async () => {
    mockGetPart.mockRejectedValue(new Error('Network error'));
    render(<PartEditor partId="part-1" />);
    await waitFor(() =>
      expect(screen.getByTestId('part-editor-error')).toBeInTheDocument()
    );
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  // ── Part info header ─────────────────────────────────────────────────────

  it('displays part name in breadcrumb', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('part-editor'));
    expect(screen.getByText('Top Panel')).toBeInTheDocument();
  });

  it('displays product name in breadcrumb', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('part-editor'));
    expect(screen.getByText('Wardrobe Unit')).toBeInTheDocument();
  });

  // ── Name editing ──────────────────────────────────────────────────────────

  it('allows editing the part name', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('part-name-input'));
    await userEvent.clear(screen.getByTestId('part-name-input'));
    await userEvent.type(screen.getByTestId('part-name-input'), 'New Name');
    expect((screen.getByTestId('part-name-input') as HTMLInputElement).value).toBe(
      'New Name'
    );
  });

  it('shows error when name is cleared', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('part-name-input'));
    await userEvent.clear(screen.getByTestId('part-name-input'));
    expect(
      await screen.findByTestId('part-name-error')
    ).toBeInTheDocument();
  });

  // ── Save / Reset ──────────────────────────────────────────────────────────

  it('enables save button when form is dirty', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('part-name-input'));
    await userEvent.type(screen.getByTestId('part-name-input'), ' Extra');
    await waitFor(() =>
      expect(screen.getByTestId('save-btn')).not.toBeDisabled()
    );
  });

  it('calls updatePart when save is clicked', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('part-name-input'));
    await userEvent.type(screen.getByTestId('part-name-input'), ' Extra');
    await userEvent.click(screen.getByTestId('save-btn'));
    await waitFor(() => expect(mockUpdatePart).toHaveBeenCalledOnce());
  });

  it('shows reset button when form is dirty', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('part-name-input'));
    await userEvent.type(screen.getByTestId('part-name-input'), ' Changed');
    expect(await screen.findByTestId('reset-btn')).toBeInTheDocument();
  });

  it('resets form to saved state after reset click', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('part-name-input'));
    await userEvent.clear(screen.getByTestId('part-name-input'));
    await userEvent.type(screen.getByTestId('part-name-input'), 'Temp Name');
    const resetBtn = await screen.findByTestId('reset-btn');
    await userEvent.click(resetBtn);
    await waitFor(() =>
      expect(
        (screen.getByTestId('part-name-input') as HTMLInputElement).value
      ).toBe('Top Panel')
    );
  });

  // ── Material override ─────────────────────────────────────────────────────

  it('renders material override selector', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('material-select'));
    expect(screen.getByTestId('material-select')).toBeInTheDocument();
  });

  it('shows clear button when material is overridden', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('material-select'));
    await userEvent.selectOptions(screen.getByTestId('material-select'), 'mat-1');
    expect(screen.getByTestId('clear-material-btn')).toBeInTheDocument();
  });

  it('clears material override when clear button is clicked', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('material-select'));
    await userEvent.selectOptions(screen.getByTestId('material-select'), 'mat-1');
    await userEvent.click(screen.getByTestId('clear-material-btn'));
    expect(
      (screen.getByTestId('material-select') as HTMLSelectElement).value
    ).toBe('');
  });

  // ── Grain direction ───────────────────────────────────────────────────────

  it('renders grain direction radios', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('grain-none'));
    expect(screen.getByTestId('grain-none')).toBeInTheDocument();
    expect(screen.getByTestId('grain-horizontal')).toBeInTheDocument();
    expect(screen.getByTestId('grain-vertical')).toBeInTheDocument();
    expect(screen.getByTestId('grain-diagonal')).toBeInTheDocument();
  });

  it('defaults to the part grain direction', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('grain-horizontal'));
    expect(
      (screen.getByTestId('grain-horizontal') as HTMLInputElement).checked
    ).toBe(true);
  });

  it('changes grain direction on radio click', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('grain-vertical'));
    await userEvent.click(screen.getByTestId('grain-vertical'));
    expect(
      (screen.getByTestId('grain-vertical') as HTMLInputElement).checked
    ).toBe(true);
  });

  // ── Edge banding ──────────────────────────────────────────────────────────

  it('renders edge banding panel', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() =>
      expect(
        screen.getByRole('group', { name: 'Edge banding settings' })
      ).toBeInTheDocument()
    );
  });

  it('toggles an edge band on click', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByLabelText('Enable Top Edge'));
    const topToggle = screen.getByLabelText('Enable Top Edge');
    expect((topToggle as HTMLInputElement).checked).toBe(false);
    await userEvent.click(topToggle);
    expect((topToggle as HTMLInputElement).checked).toBe(true);
  });

  // ── Notes ─────────────────────────────────────────────────────────────────

  it('renders notes textarea with initial value', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('notes-textarea'));
    expect(
      (screen.getByTestId('notes-textarea') as HTMLTextAreaElement).value
    ).toBe('Initial notes');
  });

  it('allows editing notes', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('notes-textarea'));
    await userEvent.clear(screen.getByTestId('notes-textarea'));
    await userEvent.type(screen.getByTestId('notes-textarea'), 'New note text');
    expect(
      (screen.getByTestId('notes-textarea') as HTMLTextAreaElement).value
    ).toBe('New note text');
  });

  // ── Operations CRUD ───────────────────────────────────────────────────────

  it('renders operations table', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() =>
      expect(screen.getByTestId('operations-table')).toBeInTheDocument()
    );
  });

  it('lists loaded operations in the table', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('op-row-op-1'));
    expect(screen.getByTestId('op-row-op-2')).toBeInTheDocument();
  });

  it('opens add operation modal when add button clicked', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('add-operation-btn'));
    await userEvent.click(screen.getByTestId('add-operation-btn'));
    expect(screen.getByTestId('operation-form-modal')).toBeInTheDocument();
    expect(screen.getByText('Add Operation')).toBeInTheDocument();
  });

  it('opens edit operation modal with correct data', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('edit-op-op-1'));
    await userEvent.click(screen.getByTestId('edit-op-op-1'));
    expect(screen.getByText('Edit Operation')).toBeInTheDocument();
    expect(
      (screen.getByLabelText('X Position (mm)') as HTMLInputElement).value
    ).toBe('50');
  });

  it('closes operation modal on cancel', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('add-operation-btn'));
    await userEvent.click(screen.getByTestId('add-operation-btn'));
    await userEvent.click(screen.getByTestId('op-form-cancel'));
    expect(screen.queryByTestId('operation-form-modal')).not.toBeInTheDocument();
  });

  it('calls addOperation API when form is submitted in add mode', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('add-operation-btn'));
    await userEvent.click(screen.getByTestId('add-operation-btn'));
    // Fill in required diameter for default Bore type
    await userEvent.type(screen.getByLabelText('Diameter (mm)'), '8');
    await userEvent.click(screen.getByTestId('op-form-submit'));
    await waitFor(() => expect(mockAddOperation).toHaveBeenCalledOnce());
  });

  it('removes operation row after delete confirm', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('delete-op-op-1'));
    await userEvent.click(screen.getByTestId('delete-op-op-1'));
    await userEvent.click(screen.getByTestId('confirm-delete-op-1'));
    await waitFor(() => expect(mockDeleteOperation).toHaveBeenCalledWith('part-1', 'op-1'));
  });

  // ── Part preview ──────────────────────────────────────────────────────────

  it('renders the part outline SVG', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('part-outline-svg'));
    expect(screen.getByTestId('part-outline-svg')).toBeInTheDocument();
  });

  it('shows part info summary', async () => {
    render(<PartEditor partId="part-1" />);
    await waitFor(() => screen.getByTestId('part-info-summary'));
    expect(screen.getByTestId('info-grain')).toHaveTextContent('Horizontal');
  });

  // ── Operations error banner ───────────────────────────────────────────────

  it('shows operations error banner on API failure', async () => {
    mockListOperations.mockRejectedValue(new Error('Ops fetch failed'));
    render(<PartEditor partId="part-1" />);
    await waitFor(() =>
      expect(screen.getByTestId('ops-error-banner')).toBeInTheDocument()
    );
  });
});
