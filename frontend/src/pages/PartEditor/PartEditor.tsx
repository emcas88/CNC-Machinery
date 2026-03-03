// ─────────────────────────────────────────────────────────────────────────────
// PartEditor — main page component
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import type { Operation, GrainDirection, AddOperationPayload, Material } from './types';
import { usePartForm } from './hooks';
import { useOperations } from './hooks';
import { DimensionsEditor } from './components/DimensionsEditor';
import { EdgeBandingPanel } from './components/EdgeBandingPanel';
import { OperationsTable } from './components/OperationsTable';
import { PartOutlineSVG } from './components/PartOutlineSVG';
import { OperationForm } from './components/OperationForm';

// ─── Mock material list (replace with API call in production) ─────────────────
const MOCK_MATERIALS: Material[] = [
  { id: 'mat-1', name: 'Oak Veneer', thickness: 0.6 },
  { id: 'mat-2', name: 'Walnut Veneer', thickness: 0.6 },
  { id: 'mat-3', name: 'White ABS 1mm', thickness: 1.0 },
  { id: 'mat-4', name: 'Black ABS 2mm', thickness: 2.0 },
  { id: 'mat-5', name: 'PVC Edge 2mm', thickness: 2.0 },
];

const GRAIN_DIRECTIONS: GrainDirection[] = [
  'None',
  'Horizontal',
  'Vertical',
  'Diagonal',
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface PartEditorProps {
  /** The part ID to load. Defaults to a demo value when not provided. */
  partId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PartEditor: React.FC<PartEditorProps> = ({
  partId = 'demo-part-1',
}) => {
  // ── Part form state ─────────────────────────────────────────────────────────
  const {
    part,
    form,
    isDirty,
    errors,
    isLoading,
    apiError,
    isSaving,
    setName,
    setDimension,
    setMaterialOverride,
    setGrainDirection,
    toggleEdgeBand,
    setEdgeBandMaterial,
    setNotes,
    save,
    reset,
  } = usePartForm(partId);

  // ── Operations state ─────────────────────────────────────────────────────────
  const {
    operations,
    isLoading: opsLoading,
    apiError: opsError,
    isMutating,
    add: addOp,
    edit: editOp,
    remove: removeOp,
  } = useOperations(partId);

  // ── Operation form modal state ────────────────────────────────────────────
  const [opFormOpen, setOpFormOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<Operation | null>(null);

  const openAddForm = () => {
    setEditingOp(null);
    setOpFormOpen(true);
  };

  const openEditForm = (op: Operation) => {
    setEditingOp(op);
    setOpFormOpen(true);
  };

  const closeOpForm = () => {
    setOpFormOpen(false);
    setEditingOp(null);
  };

  const handleOpSubmit = async (payload: AddOperationPayload) => {
    if (editingOp) {
      await editOp(editingOp.id, payload);
    } else {
      await addOp(payload);
    }
    closeOpForm();
  };

  // ─── Render: loading / error states ─────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="part-editor part-editor--loading" role="status" aria-busy="true">
        <div className="part-editor__spinner" aria-label="Loading part…" />
        <p>Loading part…</p>
      </div>
    );
  }

  if (apiError && !part) {
    return (
      <div
        className="part-editor part-editor--error"
        role="alert"
        data-testid="part-editor-error"
      >
        <h2>Failed to load part</h2>
        <p>{apiError}</p>
      </div>
    );
  }

  // ─── Render: main editor ─────────────────────────────────────────────────────

  return (
    <div
      className="part-editor"
      data-testid="part-editor"
      aria-label={`Part editor: ${form.name || 'Untitled'}`}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="part-editor__header">
        <div className="part-editor__breadcrumb">
          <span className="part-editor__breadcrumb-product">
            {part?.productName ?? '—'}
          </span>
          <span className="part-editor__breadcrumb-sep">/</span>
          <span className="part-editor__breadcrumb-part">{form.name || 'Untitled Part'}</span>
        </div>

        <div className="part-editor__header-actions">
          {isDirty && (
            <button
              className="part-editor__reset-btn"
              onClick={reset}
              disabled={isSaving}
              data-testid="reset-btn"
              aria-label="Reset unsaved changes"
            >
              Reset
            </button>
          )}
          <button
            className="part-editor__save-btn"
            onClick={save}
            disabled={isSaving || !isDirty || Object.keys(errors).length > 0}
            data-testid="save-btn"
            aria-label="Save part"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {apiError && (
        <div className="part-editor__api-error" role="alert" data-testid="api-error-banner">
          {apiError}
        </div>
      )}

      {/* ── Two-column layout: editor | preview ────────────────────────────── */}
      <div className="part-editor__body">
        {/* ── Left column: all form sections ─────────────────────────────── */}
        <div className="part-editor__form-column">
          {/* Part Name */}
          <section className="part-editor__section" aria-label="Part name">
            <h3>Part Name</h3>
            <div className="part-editor__field">
              <label htmlFor="part-name">Name</label>
              <input
                id="part-name"
                type="text"
                value={form.name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'part-name-error' : undefined}
                data-testid="part-name-input"
              />
              {errors.name && (
                <span
                  id="part-name-error"
                  role="alert"
                  className="part-editor__field-error"
                  data-testid="part-name-error"
                >
                  {errors.name}
                </span>
              )}
            </div>
          </section>

          {/* Dimensions */}
          <section className="part-editor__section" aria-label="Dimensions">
            <DimensionsEditor
              dimensions={form.dimensions}
              errors={errors}
              onChange={setDimension}
              disabled={isSaving}
            />
          </section>

          {/* Material override */}
          <section className="part-editor__section" aria-label="Material">
            <h3>Material</h3>
            <div className="part-editor__field">
              <label htmlFor="material-override">
                Override material
              </label>
              <select
                id="material-override"
                value={form.materialOverrideId ?? ''}
                onChange={(e) =>
                  setMaterialOverride(e.target.value || null)
                }
                data-testid="material-select"
              >
                <option value="">Use product default</option>
                {MOCK_MATERIALS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              {form.materialOverrideId && (
                <button
                  className="part-editor__clear-btn"
                  onClick={() => setMaterialOverride(null)}
                  data-testid="clear-material-btn"
                  aria-label="Clear material override"
                >
                  ✕ Use default
                </button>
              )}
            </div>
          </section>

          {/* Grain Direction */}
          <section className="part-editor__section" aria-label="Grain direction">
            <h3>Grain Direction</h3>
            <div
              className="part-editor__grain-options"
              role="group"
              aria-label="Grain direction selector"
            >
              {GRAIN_DIRECTIONS.map((dir) => (
                <label
                  key={dir}
                  className={`part-editor__grain-option${
                    form.grainDirection === dir
                      ? ' part-editor__grain-option--active'
                      : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="grain-direction"
                    value={dir}
                    checked={form.grainDirection === dir}
                    onChange={() => setGrainDirection(dir)}
                    data-testid={`grain-${dir.toLowerCase()}`}
                  />
                  {dir}
                </label>
              ))}
            </div>
          </section>

          {/* Edge Banding */}
          <section className="part-editor__section" aria-label="Edge banding">
            <EdgeBandingPanel
              edgeBanding={form.edgeBanding}
              materials={MOCK_MATERIALS}
              onToggle={toggleEdgeBand}
              onMaterialChange={setEdgeBandMaterial}
              disabled={isSaving}
            />
          </section>

          {/* Notes */}
          <section className="part-editor__section" aria-label="Notes">
            <h3>Notes</h3>
            <textarea
              id="part-notes"
              className="part-editor__notes"
              value={form.notes}
              rows={4}
              placeholder="Add any comments or notes about this part…"
              onChange={(e) => setNotes(e.target.value)}
              data-testid="notes-textarea"
            />
          </section>
        </div>

        {/* ── Right column: preview ───────────────────────────────────────── */}
        <div className="part-editor__preview-column">
          <section className="part-editor__section" aria-label="Part preview">
            <h3>Part Preview</h3>
            <PartOutlineSVG
              dimensions={form.dimensions}
              operations={operations}
              grainDirection={form.grainDirection}
              canvasSize={320}
            />

            {/* Part info summary */}
            <dl className="part-editor__info-list" data-testid="part-info-summary">
              <dt>Material</dt>
              <dd data-testid="info-material">
                {form.materialOverrideId
                  ? MOCK_MATERIALS.find((m) => m.id === form.materialOverrideId)?.name ??
                    'Unknown'
                  : part?.materialOverrideName ?? 'Product default'}
              </dd>
              <dt>Grain</dt>
              <dd data-testid="info-grain">{form.grainDirection}</dd>
              <dt>Operations</dt>
              <dd data-testid="info-op-count">{operations.length}</dd>
            </dl>
          </section>
        </div>
      </div>

      {/* ── Operations Table ─────────────────────────────────────────────── */}
      <section
        className="part-editor__section part-editor__operations-section"
        aria-label="Operations"
      >
        {opsError && (
          <div role="alert" className="part-editor__api-error" data-testid="ops-error-banner">
            Operations error: {opsError}
          </div>
        )}
        <OperationsTable
          operations={operations}
          isLoading={opsLoading}
          isMutating={isMutating}
          onEdit={openEditForm}
          onDelete={removeOp}
          onAdd={openAddForm}
        />
      </section>

      {/* ── Operation Modal ────────────────────────────────────────────────── */}
      <OperationForm
        operation={editingOp}
        isOpen={opFormOpen}
        isSaving={isMutating}
        onClose={closeOpForm}
        onSubmit={handleOpSubmit}
      />
    </div>
  );
};

export default PartEditor;
