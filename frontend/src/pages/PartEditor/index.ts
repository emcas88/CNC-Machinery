// ─────────────────────────────────────────────────────────────────────────────
// PartEditor — public exports
// ─────────────────────────────────────────────────────────────────────────────

export { PartEditor } from './PartEditor';
export { default as PartEditorDefault } from './PartEditor';

// Types
export type {
  Part,
  Operation,
  OperationType,
  EdgeBand,
  EdgeBanding,
  EdgeSide,
  GrainDirection,
  Dimensions,
  Material,
  UpdatePartPayload,
  AddOperationPayload,
  ValidationErrors,
  OperationValidationErrors,
} from './types';

// Hooks
export { usePartForm } from './hooks';
export { useOperations } from './hooks';
export type { UsePartFormReturn, UseOperationsReturn, PartFormState } from './hooks';

// API
export {
  getPart,
  updatePart,
  listOperations,
  addOperation,
  updateOperation,
  deleteOperation,
  listMaterials,
} from './api';

// Sub-components
export { DimensionsEditor } from './components/DimensionsEditor';
export { EdgeBandingPanel } from './components/EdgeBandingPanel';
export { OperationsTable } from './components/OperationsTable';
export { PartOutlineSVG } from './components/PartOutlineSVG';
export { OperationForm } from './components/OperationForm';
