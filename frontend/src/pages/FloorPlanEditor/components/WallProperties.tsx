// ─────────────────────────────────────────────
//  WallProperties – edit panel for a selected wall
// ─────────────────────────────────────────────

import React, { useCallback, useState, useEffect } from 'react';
import { Wall, WallOpening, WallOpeningType } from '../types';
import { formatMM, wallLength, generateId } from '../api';

interface WallPropertiesProps {
  wall: Wall;
  onUpdate: (wall: Wall) => void;
  onDelete: (wallId: string) => void;
  onAddOpening: (wallId: string, opening: Omit<WallOpening, 'id'>) => void;
  onDeleteOpening: (wallId: string, openingId: string) => void;
}

const WallProperties: React.FC<WallPropertiesProps> = ({
  wall,
  onUpdate,
  onDelete,
  onAddOpening,
  onDeleteOpening,
}) => {
  const [thickness, setThickness] = useState(String(wall.thickness));
  const [height, setHeight] = useState(String(wall.height));
  const [label, setLabel] = useState(wall.label ?? '');

  useEffect(() => {
    setThickness(String(wall.thickness));
    setHeight(String(wall.height));
    setLabel(wall.label ?? '');
  }, [wall.id, wall.thickness, wall.height, wall.label]);

  const commit = useCallback(() => {
    const t = parseInt(thickness, 10);
    const h = parseInt(height, 10);
    if (isNaN(t) || isNaN(h) || t <= 0 || h <= 0) return;
    onUpdate({ ...wall, thickness: t, height: h, label: label || undefined });
  }, [wall, thickness, height, label, onUpdate]);

  const handleAddOpening = useCallback(
    (type: WallOpeningType) => {
      onAddOpening(wall.id, {
        type,
        position: 0.5,
        width: type === 'door' ? 900 : 1200,
        height: type === 'window' ? 1000 : undefined,
        sillHeight: type === 'window' ? 900 : undefined,
      });
    },
    [wall.id, onAddOpening]
  );

  return (
    <div data-testid="wall-properties" style={panelStyle}>
      <h3 style={headingStyle}>Wall Properties</h3>
      <div style={rowStyle}>
        <label style={labelStyle}>Length</label>
        <span style={valueStyle}>{formatMM(wallLength(wall))}</span>
      </div>
      <div style={rowStyle}>
        <label style={labelStyle} htmlFor="wall-label">Label</label>
        <input
          id="wall-label"
          data-testid="wall-label-input"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onBlur={commit}
          style={inputStyle}
          placeholder="optional"
        />
      </div>
      <div style={rowStyle}>
        <label style={labelStyle} htmlFor="wall-thickness">Thickness (mm)</label>
        <input
          id="wall-thickness"
          data-testid="wall-thickness-input"
          type="number"
          min={10}
          max={1000}
          value={thickness}
          onChange={e => setThickness(e.target.value)}
          onBlur={commit}
          style={inputStyle}
        />
      </div>
      <div style={rowStyle}>
        <label style={labelStyle} htmlFor="wall-height">Height (mm)</label>
        <input
          id="wall-height"
          data-testid="wall-height-input"
          type="number"
          min={100}
          max={5000}
          value={height}
          onChange={e => setHeight(e.target.value)}
          onBlur={commit}
          style={inputStyle}
        />
      </div>

      {/* Openings */}
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
            Openings ({wall.openings.length})
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              data-testid="add-door-btn"
              onClick={() => handleAddOpening('door')}
              style={smallBtnStyle}
              title="Add door"
            >
              + Door
            </button>
            <button
              data-testid="add-window-btn"
              onClick={() => handleAddOpening('window')}
              style={smallBtnStyle}
              title="Add window"
            >
              + Window
            </button>
          </div>
        </div>
        {wall.openings.map(opening => (
          <div
            key={opening.id}
            data-testid={`opening-row-${opening.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 6px',
              background: '#f9fafb',
              borderRadius: 4,
              marginBottom: 3,
              fontSize: 12,
            }}
          >
            <span style={{ color: '#374151', textTransform: 'capitalize' }}>
              {opening.type} – {formatMM(opening.width)}
            </span>
            <button
              data-testid={`delete-opening-${opening.id}`}
              onClick={() => onDeleteOpening(wall.id, opening.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}
              aria-label={`Delete ${opening.type}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        data-testid="delete-wall-btn"
        onClick={() => onDelete(wall.id)}
        style={{
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
        }}
      >
        Delete Wall
      </button>
    </div>
  );
};

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

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 6,
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
  flexShrink: 0,
};

const valueStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#111827',
  fontWeight: 500,
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

export default WallProperties;
