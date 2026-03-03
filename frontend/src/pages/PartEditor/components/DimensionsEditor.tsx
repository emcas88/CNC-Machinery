// ─────────────────────────────────────────────────────────────────────────────
// DimensionsEditor — edit length / width / thickness with validation
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import type { Dimensions, ValidationErrors } from '../types';

interface Props {
  dimensions: Dimensions;
  errors: ValidationErrors;
  onChange: (field: keyof Dimensions, value: number) => void;
  disabled?: boolean;
}

export const DimensionsEditor: React.FC<Props> = ({
  dimensions,
  errors,
  onChange,
  disabled = false,
}) => {
  const fields: Array<{ key: keyof Dimensions; label: string; unit: string }> = [
    { key: 'length', label: 'Length', unit: 'mm' },
    { key: 'width', label: 'Width', unit: 'mm' },
    { key: 'thickness', label: 'Thickness', unit: 'mm' },
  ];

  const handleChange = (field: keyof Dimensions, raw: string) => {
    const parsed = parseFloat(raw);
    onChange(field, Number.isNaN(parsed) ? 0 : parsed);
  };

  return (
    <div className="dimensions-editor" role="group" aria-label="Part dimensions">
      <h3 className="dimensions-editor__title">Dimensions</h3>
      <div className="dimensions-editor__grid">
        {fields.map(({ key, label, unit }) => (
          <div key={key} className="dimensions-editor__field">
            <label
              className="dimensions-editor__label"
              htmlFor={`dim-${key}`}
            >
              {label}
            </label>
            <div className="dimensions-editor__input-wrapper">
              <input
                id={`dim-${key}`}
                type="number"
                className={`dimensions-editor__input${
                  errors[key] ? ' dimensions-editor__input--error' : ''
                }`}
                value={dimensions[key]}
                min={0.1}
                step={0.1}
                disabled={disabled}
                aria-invalid={!!errors[key]}
                aria-describedby={errors[key] ? `dim-${key}-error` : undefined}
                onChange={(e) => handleChange(key, e.target.value)}
              />
              <span className="dimensions-editor__unit">{unit}</span>
            </div>
            {errors[key] && (
              <span
                id={`dim-${key}-error`}
                role="alert"
                className="dimensions-editor__error"
              >
                {errors[key]}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DimensionsEditor;
