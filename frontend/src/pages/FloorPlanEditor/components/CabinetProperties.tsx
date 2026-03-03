// ─────────────────────────────────────────────
//  CabinetProperties – edit panel for a selected cabinet
// ─────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from 'react';
import { ApplianceCutout, PlacedCabinet, ApplianceCutoutType } from '../types';

interface CabinetPropertiesProps {
  cabinet: PlacedCabinet;
  onUpdate: (cabinet: PlacedCabinet) => void;
  onDelete: (cabinetId: string) => void;
  onRotate: (cabinetId: string, rotation: number) => void;
  onAddCutout: (cabinetId: string, cutout: Omit<ApplianceCutout, 'id'>) => void;
  onRemoveCutout: (cabinetId: string, cutoutId: string) => void;
}

const CUTOUT_TYPES: ApplianceCutoutType[] = [
  'sink', 'cooktop', 'dishwasher', 'refrigerator', 'oven', 'microwave',
];

const CabinetProperties: React.FC<CabinetPropertiesProps> = ({
  cabinet,
  onUpdate,
  onDelete,
  onRotate,
  onAddCutout,
  onRemoveCutout,
}) => {
  const [label, setLabel] = useState(cabinet.label);
  const [width, setWidth] = useState(String(cabinet.width));
  const [depth, setDepth] = useState(String(cabinet.depth));
  const [height, setHeight] = useState(String(cabinet.height));
  const [color, setColor] = useState(cabinet.color);

  useEffect(() => {
    setLabel(cabinet.label);
    setWidth(String(cabinet.width));
    setDepth(String(cabinet.depth));
    setHeight(String(cabinet.height));
    setColor(cabinet.color);
  }, [cabinet.id, cabinet.label, cabinet.width, cabinet.depth, cabinet.height, cabinet.color]);

  const commit = useCallback(() => {
    const w = parseInt(width, 10);
    const d = parseInt(depth, 10);
    const h = parseInt(height, 10);
    if (isNaN(w) || isNaN(d) || isNaN(h) || w <= 0 || d <= 0 || h <= 0) return;
    onUpdate({ ...cabinet, label, width: w, depth: d, height: h, color });
  }, [cabinet, label, width, depth, height, color, onUpdate]);

  const handleRotate = useCallback(() => {
    onRotate(cabinet.id, (cabinet.rotation + 90) % 360);
  }, [cabinet.id, cabinet.rotation, onRotate]);

  const handleAddCutout = useCallback(
    (type: ApplianceCutoutType) => {
      onAddCutout(cabinet.id, {
        type,
        offsetX: 50,
        offsetY: 50,
        width: Math.min(cabinet.width - 100, 500),
        depth: Math.min(cabinet.depth - 100, 500),
      });
    },
    [cabinet.id, cabinet.width, cabinet.depth, onAddCutout]
  );

  return (
    <div data-testid="cabinet-properties" style={panelStyle}>
      <h3 style={headingStyle}>Cabinet Properties</h3>

      <Field label="Label">
        <input
          data-testid="cabinet-label-input"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onBlur={commit}
          style={inputStyle}
        />
      </Field>

      <Field label="Width (mm)">
        <input
          data-testid="cabinet-width-input"
          type="number" min={100} max={3000}
          value={width}
          onChange={e => setWidth(e.target.value)}
          onBlur={commit}
          style={inputStyle}
        />
      </Field>

      <Field label="Depth (mm)">
        <input
          data-testid="cabinet-depth-input"
          type="number" min={100} max={3000}
          value={depth}
          onChange={e => setDepth(e.target.value)}
          onBlur={commit}
          style={inputStyle}
        />
      </Field>

      <Field label="Height (mm)">
        <input
          data-testid="cabinet-height-input"
          type="number" min={100} max={3000}
          value={height}
          onChange={e => setHeight(e.target.value)}
          onBlur={commit}
          style={inputStyle}
        />
      </Field>

      <Field label="Color">
        <input
          data-testid="cabinet-color-input"
          type="color"
          value={color}
          onChange={e => { setColor(e.target.value); }}
          onBlur={commit}
          style={{ ...inputStyle, padding: 2, width: 44, height: 28 }}
        />
      </Field>

      <Field label="Rotation">
        <span style={{ fontSize: 12, color: '#111827' }}>{cabinet.rotation}°</span>
        <button
          data-testid="cabinet-rotate-btn"
          onClick={handleRotate}
          style={smallBtnStyle}
          aria-label="Rotate 90°"
        >
          ↻ 90°
        </button>
      </Field>

      {/* Appliance cutouts */}
      <div style={{ marginTop: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
          Appliance Cutouts
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
          {CUTOUT_TYPES.map(type => (
            <button
              key={type}
              data-testid={`add-cutout-${type}`}
              onClick={() => handleAddCutout(type)}
              style={{ ...smallBtnStyle, textTransform: 'capitalize', fontSize: 10 }}
            >
              + {type}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 6 }}>
          {cabinet.applianceCutouts.map(cutout => (
            <div
              key={cutout.id}
              data-testid={`cutout-row-${cutout.id}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}
            >
              <span style={{ textTransform: 'capitalize', color: '#374151' }}>
                {cutout.type} ({cutout.width}×{cutout.depth})
              </span>
              <button
                data-testid={`remove-cutout-${cutout.id}`}
                onClick={() => onRemoveCutout(cabinet.id, cutout.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}
                aria-label={`Remove ${cutout.type} cutout`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        data-testid="delete-cabinet-btn"
        onClick={() => onDelete(cabinet.id)}
        style={deleteBtnStyle}
      >
        Delete Cabinet
      </button>
    </div>
  );
};

// ── helpers ──
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
    <label style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>{label}</label>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{children}</div>
  </div>
);

// ── styles ──
const panelStyle: React.CSSProperties = {
  padding: 12,
  background: '#fff',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
};
const headingStyle: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: 13,
  fontWeight: 600,
  color: '#111827',
};
const inputStyle: React.CSSProperties = {
  width: 90,
  padding: '3px 6px',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  fontSize: 12,
  color: '#111827',
  background: '#f9fafb',
  textAlign: 'right',
};
const smallBtnStyle: React.CSSProperties = {
  padding: '2px 7px',
  fontSize: 11,
  border: '1px solid #d1d5db',
  borderRadius: 4,
  cursor: 'pointer',
  background: '#f3f4f6',
  color: '#374151',
};
const deleteBtnStyle: React.CSSProperties = {
  marginTop: 12,
  width: '100%',
  padding: '6px',
  background: '#fef2f2',
  border: '1px solid #fca5a5',
  borderRadius: 6,
  color: '#dc2626',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
};

export default CabinetProperties;
