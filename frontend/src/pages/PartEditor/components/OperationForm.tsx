// ─────────────────────────────────────────────────────────────────────────────
// OperationForm — modal dialog for adding / editing an operation
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import type {
  Operation,
  OperationType,
  AddOperationPayload,
  OperationValidationErrors,
} from '../types';

const OPERATION_TYPES: OperationType[] = [
  'Cut',
  'Bore',
  'Route',
  'Dado',
  'Pocket',
  'Tenon',
  'EdgeProfile',
  'Drill',
];

/** Which extra fields are relevant per operation type */
const EXTRA_FIELDS: Partial<Record<OperationType, string[]>> = {
  Bore: ['diameter'],
  Drill: ['diameter'],
  Route: ['width', 'length'],
  Dado: ['width', 'length'],
  Pocket: ['width', 'length'],
};

interface Props {
  /** If provided, form is in "edit" mode pre-populated with this operation. */
  operation?: Operation | null;
  isOpen: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (payload: AddOperationPayload) => void;
}

interface FormState {
  type: OperationType;
  positionX: string;
  positionY: string;
  depth: string;
  width: string;
  length: string;
  diameter: string;
  toolId: string;
  notes: string;
}

function opToFormState(op: Operation): FormState {
  return {
    type: op.type,
    positionX: String(op.position.x),
    positionY: String(op.position.y),
    depth: String(op.depth),
    width: op.width != null ? String(op.width) : '',
    length: op.length != null ? String(op.length) : '',
    diameter: op.diameter != null ? String(op.diameter) : '',
    toolId: op.toolId ?? '',
    notes: op.notes ?? '',
  };
}

const defaultState: FormState = {
  type: 'Bore',
  positionX: '0',
  positionY: '0',
  depth: '10',
  width: '',
  length: '',
  diameter: '',
  toolId: '',
  notes: '',
};

function validate(form: FormState): OperationValidationErrors {
  const errors: OperationValidationErrors = {};
  if (!form.type) errors.type = 'Type is required.';
  const x = parseFloat(form.positionX);
  if (!Number.isFinite(x)) errors.positionX = 'X must be a number.';
  const y = parseFloat(form.positionY);
  if (!Number.isFinite(y)) errors.positionY = 'Y must be a number.';
  const depth = parseFloat(form.depth);
  if (!Number.isFinite(depth) || depth <= 0) errors.depth = 'Depth must be > 0.';

  const extras = EXTRA_FIELDS[form.type] ?? [];
  if (extras.includes('diameter')) {
    const d = parseFloat(form.diameter);
    if (!Number.isFinite(d) || d <= 0) errors.diameter = 'Diameter must be > 0.';
  }
  if (extras.includes('width')) {
    const w = parseFloat(form.width);
    if (!Number.isFinite(w) || w <= 0) errors.width = 'Width must be > 0.';
  }
  if (extras.includes('length')) {
    const l = parseFloat(form.length);
    if (!Number.isFinite(l) || l <= 0) errors.length = 'Length must be > 0.';
  }
  return errors;
}

export const OperationForm: React.FC<Props> = ({
  operation,
  isOpen,
  isSaving = false,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState<FormState>(
    operation ? opToFormState(operation) : defaultState
  );
  const [errors, setErrors] = useState<OperationValidationErrors>({});
  const firstInputRef = useRef<HTMLSelectElement>(null);

  // Sync when operation changes (switching between edit targets)
  useEffect(() => {
    setForm(operation ? opToFormState(operation) : defaultState);
    setErrors({});
  }, [operation]);

  // Trap focus inside modal when open
  useEffect(() => {
    if (isOpen) firstInputRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (
    field: keyof FormState,
    value: string
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const extras = EXTRA_FIELDS[form.type] ?? [];
    const payload: AddOperationPayload = {
      type: form.type,
      position: { x: parseFloat(form.positionX), y: parseFloat(form.positionY) },
      depth: parseFloat(form.depth),
      ...(form.toolId ? { toolId: form.toolId } : {}),
      ...(form.notes ? { notes: form.notes } : {}),
      ...(extras.includes('diameter') && form.diameter
        ? { diameter: parseFloat(form.diameter) }
        : {}),
      ...(extras.includes('width') && form.width
        ? { width: parseFloat(form.width) }
        : {}),
      ...(extras.includes('length') && form.length
        ? { length: parseFloat(form.length) }
        : {}),
    };
    onSubmit(payload);
  };

  const extras = EXTRA_FIELDS[form.type] ?? [];

  return (
    <div
      className="operation-form-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="op-form-title"
      data-testid="operation-form-modal"
    >
      <div className="operation-form">
        <div className="operation-form__header">
          <h2 id="op-form-title" className="operation-form__title">
            {operation ? 'Edit Operation' : 'Add Operation'}
          </h2>
          <button
            className="operation-form__close-btn"
            aria-label="Close"
            onClick={onClose}
            data-testid="op-form-close"
          >
            ×
          </button>
        </div>

        <form
          className="operation-form__body"
          onSubmit={handleSubmit}
          noValidate
          data-testid="operation-form"
        >
          {/* Type */}
          <div className="operation-form__field">
            <label htmlFor="op-type">Operation Type</label>
            <select
              id="op-type"
              ref={firstInputRef}
              value={form.type}
              onChange={(e) => handleChange('type', e.target.value)}
              aria-invalid={!!errors.type}
            >
              {OPERATION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {errors.type && <span role="alert">{errors.type}</span>}
          </div>

          {/* Position */}
          <div className="operation-form__row">
            <div className="operation-form__field">
              <label htmlFor="op-pos-x">X Position (mm)</label>
              <input
                id="op-pos-x"
                type="number"
                step="0.1"
                value={form.positionX}
                onChange={(e) => handleChange('positionX', e.target.value)}
                aria-invalid={!!errors.positionX}
                aria-describedby={errors.positionX ? 'op-pos-x-err' : undefined}
              />
              {errors.positionX && (
                <span id="op-pos-x-err" role="alert">{errors.positionX}</span>
              )}
            </div>

            <div className="operation-form__field">
              <label htmlFor="op-pos-y">Y Position (mm)</label>
              <input
                id="op-pos-y"
                type="number"
                step="0.1"
                value={form.positionY}
                onChange={(e) => handleChange('positionY', e.target.value)}
                aria-invalid={!!errors.positionY}
                aria-describedby={errors.positionY ? 'op-pos-y-err' : undefined}
              />
              {errors.positionY && (
                <span id="op-pos-y-err" role="alert">{errors.positionY}</span>
              )}
            </div>
          </div>

          {/* Depth */}
          <div className="operation-form__field">
            <label htmlFor="op-depth">Depth (mm)</label>
            <input
              id="op-depth"
              type="number"
              step="0.1"
              min="0.1"
              value={form.depth}
              onChange={(e) => handleChange('depth', e.target.value)}
              aria-invalid={!!errors.depth}
              aria-describedby={errors.depth ? 'op-depth-err' : undefined}
            />
            {errors.depth && (
              <span id="op-depth-err" role="alert">{errors.depth}</span>
            )}
          </div>

          {/* Conditional: diameter */}
          {extras.includes('diameter') && (
            <div className="operation-form__field">
              <label htmlFor="op-diameter">Diameter (mm)</label>
              <input
                id="op-diameter"
                type="number"
                step="0.1"
                min="0.1"
                value={form.diameter}
                onChange={(e) => handleChange('diameter', e.target.value)}
                aria-invalid={!!errors.diameter}
              />
              {errors.diameter && <span role="alert">{errors.diameter}</span>}
            </div>
          )}

          {/* Conditional: width */}
          {extras.includes('width') && (
            <div className="operation-form__field">
              <label htmlFor="op-width">Width (mm)</label>
              <input
                id="op-width"
                type="number"
                step="0.1"
                min="0.1"
                value={form.width}
                onChange={(e) => handleChange('width', e.target.value)}
                aria-invalid={!!errors.width}
              />
              {errors.width && <span role="alert">{errors.width}</span>}
            </div>
          )}

          {/* Conditional: length */}
          {extras.includes('length') && (
            <div className="operation-form__field">
              <label htmlFor="op-length">Length (mm)</label>
              <input
                id="op-length"
                type="number"
                step="0.1"
                min="0.1"
                value={form.length}
                onChange={(e) => handleChange('length', e.target.value)}
                aria-invalid={!!errors.length}
              />
              {errors.length && <span role="alert">{errors.length}</span>}
            </div>
          )}

          {/* Tool */}
          <div className="operation-form__field">
            <label htmlFor="op-tool">Tool ID (optional)</label>
            <input
              id="op-tool"
              type="text"
              value={form.toolId}
              onChange={(e) => handleChange('toolId', e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="operation-form__field">
            <label htmlFor="op-notes">Notes (optional)</label>
            <textarea
              id="op-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
            />
          </div>

          <div className="operation-form__actions">
            <button
              type="button"
              className="operation-form__cancel-btn"
              onClick={onClose}
              data-testid="op-form-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="operation-form__submit-btn"
              disabled={isSaving}
              data-testid="op-form-submit"
            >
              {isSaving ? 'Saving…' : operation ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OperationForm;
