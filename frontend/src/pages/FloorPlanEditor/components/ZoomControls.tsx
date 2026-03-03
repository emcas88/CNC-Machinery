// ─────────────────────────────────────────────
//  ZoomControls – zoom in / out / reset buttons
// ─────────────────────────────────────────────

import React from 'react';
import { ViewTransform } from '../types';

interface ZoomControlsProps {
  transform: ViewTransform;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

const ZoomControls: React.FC<ZoomControlsProps> = ({
  transform,
  onZoomIn,
  onZoomOut,
  onReset,
}) => {
  const pct = Math.round(transform.scale * 100);

  return (
    <div
      data-testid="zoom-controls"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: '#fff',
        border: '1px solid #d1d5db',
        borderRadius: 6,
        padding: '2px 6px',
        userSelect: 'none',
      }}
    >
      <button
        data-testid="zoom-out-btn"
        onClick={onZoomOut}
        title="Zoom out"
        style={btnStyle}
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        data-testid="zoom-reset-btn"
        onClick={onReset}
        title="Reset zoom"
        style={{ ...btnStyle, minWidth: 52, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
        aria-label="Reset zoom"
      >
        {pct}%
      </button>
      <button
        data-testid="zoom-in-btn"
        onClick={onZoomIn}
        title="Zoom in"
        style={btnStyle}
        aria-label="Zoom in"
      >
        +
      </button>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '2px 6px',
  fontSize: 15,
  lineHeight: 1,
  borderRadius: 4,
  color: '#374151',
};

export default ZoomControls;
