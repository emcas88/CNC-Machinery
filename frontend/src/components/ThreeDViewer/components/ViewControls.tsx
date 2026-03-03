/**
 * ViewControls Component
 * Toolbar for switching view modes, camera presets, and triggering actions.
 * Pure React (no Three.js) — floats over the canvas.
 * Feature 18: ThreeDViewer/Component Unification
 */

import React from 'react';
import type { ViewControlsProps, ViewMode, CameraPresetName } from '../types';

// ---------------------------------------------------------------------------
// Inline styles (no external CSS dependency)
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    position:       'absolute',
    bottom:         '12px',
    left:           '50%',
    transform:      'translateX(-50%)',
    display:        'flex',
    flexDirection:  'row',
    gap:            '6px',
    background:     'rgba(20, 20, 25, 0.82)',
    backdropFilter: 'blur(8px)',
    borderRadius:   '10px',
    padding:        '8px 12px',
    boxShadow:      '0 4px 24px rgba(0,0,0,0.4)',
    zIndex:         100,
    userSelect:     'none',
    flexWrap:       'wrap',
    justifyContent: 'center',
    maxWidth:       '95%',
  },
  divider: {
    width:           '1px',
    background:      'rgba(255,255,255,0.15)',
    margin:          '0 4px',
    alignSelf:       'stretch',
  },
  btn: {
    background:    'transparent',
    border:        '1px solid rgba(255,255,255,0.18)',
    borderRadius:  '6px',
    color:         '#e8e8e8',
    cursor:        'pointer',
    fontSize:      '11px',
    fontFamily:    'Inter, system-ui, sans-serif',
    fontWeight:    500,
    padding:       '4px 10px',
    lineHeight:    '1.4',
    transition:    'background 150ms, color 150ms, border-color 150ms',
    whiteSpace:    'nowrap',
  },
  btnActive: {
    background:   'rgba(51, 153, 255, 0.28)',
    borderColor:  '#3399ff',
    color:        '#88ccff',
  },
  btnDanger: {
    borderColor: 'rgba(255,120,80,0.4)',
    color:       '#ffaa80',
  },
};

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

type MergedStyle = React.CSSProperties;

function mergeStyle(...s: (MergedStyle | undefined | false)[]): MergedStyle {
  return Object.assign({}, ...s.filter(Boolean));
}

// ---------------------------------------------------------------------------
// Icons (inline SVG)
// ---------------------------------------------------------------------------

const IconSolid = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 4 }}>
    <rect x="1" y="1" width="10" height="10" rx="2" fill="currentColor" />
  </svg>
);

const IconWire = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 4 }}>
    <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const IconXray = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 4 }}>
    <rect x="1" y="1" width="10" height="10" rx="2" fill="currentColor" opacity="0.25" />
    <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1" />
  </svg>
);

const IconCamera = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 4 }}>
    <rect x="1" y="3" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="6" cy="6.5" r="1.8" stroke="currentColor" strokeWidth="1.1" />
    <rect x="4" y="1.5" width="4" height="2" rx="0.6" fill="currentColor" />
  </svg>
);

const IconExplode = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 4 }}>
    <rect x="4" y="4" width="4" height="4" rx="0.5" fill="currentColor" />
    <line x1="2" y1="2" x2="4" y2="4" stroke="currentColor" strokeWidth="1.2" />
    <line x1="10" y1="2" x2="8" y2="4" stroke="currentColor" strokeWidth="1.2" />
    <line x1="2" y1="10" x2="4" y2="8" stroke="currentColor" strokeWidth="1.2" />
    <line x1="10" y1="10" x2="8" y2="8" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const IconRuler = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 4 }}>
    <rect x="1" y="4" width="10" height="4" rx="1" stroke="currentColor" strokeWidth="1.1" />
    <line x1="3" y1="4" x2="3" y2="8" stroke="currentColor" strokeWidth="1" />
    <line x1="6" y1="4" x2="6" y2="7" stroke="currentColor" strokeWidth="1" />
    <line x1="9" y1="4" x2="9" y2="8" stroke="currentColor" strokeWidth="1" />
  </svg>
);

// ---------------------------------------------------------------------------
// ViewControls
// ---------------------------------------------------------------------------

const VIEW_MODE_OPTIONS: { mode: ViewMode; label: string }[] = [
  { mode: 'solid',       label: 'Solid'     },
  { mode: 'wireframe',   label: 'Wire'      },
  { mode: 'xray',        label: 'X-Ray'     },
  { mode: 'realistic',   label: 'Realistic' },
];

const PRESET_OPTIONS: { name: CameraPresetName; label: string }[] = [
  { name: 'front',    label: 'F'  },
  { name: 'back',     label: 'B'  },
  { name: 'left',     label: 'L'  },
  { name: 'right',    label: 'R'  },
  { name: 'top',      label: 'T'  },
  { name: 'iso',      label: 'ISO'},
];

export const ViewControls: React.FC<ViewControlsProps> = ({
  viewMode,
  onViewModeChange,
  onPresetSelect,
  onScreenshot,
  onExplodeToggle,
  exploded,
  showDimensions,
  onDimensionsToggle,
  className,
}) => {
  return (
    <div
      style={mergeStyle(styles.toolbar)}
      className={className}
      role="toolbar"
      aria-label="3D View Controls"
      data-testid="view-controls"
    >
      {/* View mode buttons */}
      {VIEW_MODE_OPTIONS.map(({ mode, label }) => (
        <button
          key={mode}
          style={mergeStyle(styles.btn, viewMode === mode && styles.btnActive)}
          onClick={() => onViewModeChange(mode)}
          aria-pressed={viewMode === mode}
          title={`Switch to ${label} view`}
          data-testid={`view-mode-${mode}`}
        >
          {mode === 'solid'     && <IconSolid />}
          {mode === 'wireframe' && <IconWire />}
          {mode === 'xray'      && <IconXray />}
          {label}
        </button>
      ))}

      <div style={styles.divider} />

      {/* Camera presets */}
      {PRESET_OPTIONS.map(({ name, label }) => (
        <button
          key={name}
          style={styles.btn}
          onClick={() => onPresetSelect(name)}
          title={`${label} view`}
          data-testid={`preset-${name}`}
        >
          {label}
        </button>
      ))}

      <div style={styles.divider} />

      {/* Exploded view toggle */}
      <button
        style={mergeStyle(styles.btn, exploded && styles.btnActive)}
        onClick={onExplodeToggle}
        aria-pressed={exploded}
        title={exploded ? 'Collapse view' : 'Exploded view'}
        data-testid="explode-toggle"
      >
        <IconExplode />
        {exploded ? 'Collapse' : 'Explode'}
      </button>

      {/* Dimension annotations toggle */}
      <button
        style={mergeStyle(styles.btn, showDimensions && styles.btnActive)}
        onClick={onDimensionsToggle}
        aria-pressed={showDimensions}
        title={showDimensions ? 'Hide dimensions' : 'Show dimensions'}
        data-testid="dimensions-toggle"
      >
        <IconRuler />
        Dims
      </button>

      {/* Screenshot */}
      <button
        style={mergeStyle(styles.btn, styles.btnDanger)}
        onClick={onScreenshot}
        title="Take screenshot"
        data-testid="screenshot-btn"
      >
        <IconCamera />
        Screenshot
      </button>
    </div>
  );
};

export default ViewControls;
