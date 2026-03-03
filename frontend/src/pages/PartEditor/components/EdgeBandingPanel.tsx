// ─────────────────────────────────────────────────────────────────────────────
// EdgeBandingPanel — toggle edge banding on each of the 4 edges
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import type { EdgeBanding, EdgeSide, Material } from '../types';

interface Props {
  edgeBanding: EdgeBanding;
  materials: Material[];
  onToggle: (side: EdgeSide) => void;
  onMaterialChange: (side: EdgeSide, materialId: string | null) => void;
  disabled?: boolean;
}

const SIDE_LABELS: Record<EdgeSide, string> = {
  top: 'Top Edge',
  bottom: 'Bottom Edge',
  left: 'Left Edge',
  right: 'Right Edge',
};

const SIDES: EdgeSide[] = ['top', 'bottom', 'left', 'right'];

export const EdgeBandingPanel: React.FC<Props> = ({
  edgeBanding,
  materials,
  onToggle,
  onMaterialChange,
  disabled = false,
}) => {
  return (
    <div className="edge-banding-panel" role="group" aria-label="Edge banding settings">
      <h3 className="edge-banding-panel__title">Edge Banding</h3>
      <div className="edge-banding-panel__list">
        {SIDES.map((side) => {
          const band = edgeBanding[side];
          return (
            <div key={side} className="edge-banding-panel__row">
              <label
                className="edge-banding-panel__toggle-label"
                htmlFor={`edge-${side}-toggle`}
              >
                <input
                  id={`edge-${side}-toggle`}
                  type="checkbox"
                  checked={band.enabled}
                  disabled={disabled}
                  onChange={() => onToggle(side)}
                  aria-label={`Enable ${SIDE_LABELS[side]}`}
                />
                <span className="edge-banding-panel__side-name">
                  {SIDE_LABELS[side]}
                </span>
              </label>

              {band.enabled && (
                <select
                  className="edge-banding-panel__material-select"
                  value={band.materialId ?? ''}
                  disabled={disabled}
                  aria-label={`${SIDE_LABELS[side]} material`}
                  onChange={(e) =>
                    onMaterialChange(side, e.target.value || null)
                  }
                >
                  <option value="">— Select material —</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EdgeBandingPanel;
