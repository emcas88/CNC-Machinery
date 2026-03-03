// ============================================================
// DimensionsPanel — Width / Height / Depth inputs with validation
// ============================================================

import React from 'react';
import type { ProductCategory, Dimensions, ValidationError } from '../types';
import { CATEGORY_CONSTRAINTS } from '../types';

interface DimensionsPanelProps {
  category: ProductCategory;
  dimensions: Dimensions;
  errors: ValidationError[];
  onChange: (dim: keyof Dimensions, value: number) => void;
}

function DimensionField({
  id,
  label,
  value,
  min,
  max,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  error?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="dimension-field" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label htmlFor={id} style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
        {label} (mm)
      </label>
      <input
        id={id}
        type="number"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={1}
        onChange={e => onChange(Number(e.target.value))}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        style={{
          width: '100%',
          padding: '8px 10px',
          border: `1px solid ${error ? '#ef4444' : '#d1d5db'}`,
          borderRadius: 6,
          fontSize: 14,
          outline: 'none',
        }}
      />
      <span style={{ fontSize: 11, color: '#9ca3af' }}>
        {min}–{max} mm
      </span>
      {error && (
        <span
          id={`${id}-error`}
          role="alert"
          style={{ fontSize: 12, color: '#ef4444' }}
          data-testid={`${id}-error`}
        >
          {error}
        </span>
      )}
    </div>
  );
}

export function DimensionsPanel({ category, dimensions, errors, onChange }: DimensionsPanelProps) {
  const constraints = CATEGORY_CONSTRAINTS[category];
  const getError = (field: string) => errors.find(e => e.field === field)?.message;

  return (
    <section
      aria-labelledby="dimensions-heading"
      data-testid="dimensions-panel"
      style={{
        padding: '16px',
        background: '#f9fafb',
        borderRadius: 8,
        border: '1px solid #e5e7eb',
      }}
    >
      <h3 id="dimensions-heading" style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
        Dimensions
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <DimensionField
          id="dim-width"
          label="Width"
          value={dimensions.width}
          min={constraints.minWidth}
          max={constraints.maxWidth}
          error={getError('width')}
          onChange={v => onChange('width', v)}
        />
        <DimensionField
          id="dim-height"
          label="Height"
          value={dimensions.height}
          min={constraints.minHeight}
          max={constraints.maxHeight}
          error={getError('height')}
          onChange={v => onChange('height', v)}
        />
        <DimensionField
          id="dim-depth"
          label="Depth"
          value={dimensions.depth}
          min={constraints.minDepth}
          max={constraints.maxDepth}
          error={getError('depth')}
          onChange={v => onChange('depth', v)}
        />
      </div>
    </section>
  );
}

export default DimensionsPanel;
