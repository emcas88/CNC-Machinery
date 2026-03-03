// ============================================================
// MaterialSelector — Dropdowns for carcass/door/drawer/back
// ============================================================

import React from 'react';
import type { Material, ValidationError } from '../types';

interface MaterialSelectorProps {
  materials: Material[];
  loading?: boolean;
  carcassMaterialId: string;
  doorMaterialId: string;
  drawerMaterialId: string;
  backPanelMaterialId: string;
  errors: ValidationError[];
  onChange: (field: 'carcassMaterialId' | 'doorMaterialId' | 'drawerMaterialId' | 'backPanelMaterialId', value: string) => void;
}

type SelectionField = 'carcassMaterialId' | 'doorMaterialId' | 'drawerMaterialId' | 'backPanelMaterialId';

interface MaterialDropdownProps {
  id: string;
  label: string;
  value: string;
  materials: Material[];
  loading?: boolean;
  error?: string;
  onChange: (value: string) => void;
}

function MaterialDropdown({ id, label, value, materials, loading, error, onChange }: MaterialDropdownProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label htmlFor={id} style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
        {label}
      </label>
      <select
        id={id}
        aria-label={label}
        value={value}
        disabled={loading}
        onChange={e => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        style={{
          padding: '8px 10px',
          border: `1px solid ${error ? '#ef4444' : '#d1d5db'}`,
          borderRadius: 6,
          fontSize: 14,
          background: '#fff',
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        <option value="">— Select material —</option>
        {materials.map(m => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.thickness}mm)
          </option>
        ))}
      </select>
      {error && (
        <span id={`${id}-error`} role="alert" style={{ fontSize: 12, color: '#ef4444' }} data-testid={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

const FIELDS: { field: SelectionField; label: string; id: string }[] = [
  { field: 'carcassMaterialId', label: 'Carcass Material', id: 'mat-carcass' },
  { field: 'doorMaterialId', label: 'Door Material', id: 'mat-door' },
  { field: 'drawerMaterialId', label: 'Drawer Material', id: 'mat-drawer' },
  { field: 'backPanelMaterialId', label: 'Back Panel Material', id: 'mat-back' },
];

export function MaterialSelector({
  materials,
  loading,
  carcassMaterialId,
  doorMaterialId,
  drawerMaterialId,
  backPanelMaterialId,
  errors,
  onChange,
}: MaterialSelectorProps) {
  const values: Record<SelectionField, string> = {
    carcassMaterialId,
    doorMaterialId,
    drawerMaterialId,
    backPanelMaterialId,
  };
  const getError = (field: string) => errors.find(e => e.field === field)?.message;

  return (
    <section
      aria-labelledby="material-heading"
      data-testid="material-selector"
      style={{
        padding: 16,
        background: '#f9fafb',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
      }}
    >
      <h3 id="material-heading" style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
        Materials
      </h3>
      {loading && (
        <p role="status" aria-live="polite" style={{ fontSize: 13, color: '#9ca3af' }}>
          Loading materials…
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {FIELDS.map(({ field, label, id }) => (
          <MaterialDropdown
            key={field}
            id={id}
            label={label}
            value={values[field]}
            materials={materials}
            loading={loading}
            error={getError(field)}
            onChange={v => onChange(field, v)}
          />
        ))}
      </div>
    </section>
  );
}

export default MaterialSelector;
