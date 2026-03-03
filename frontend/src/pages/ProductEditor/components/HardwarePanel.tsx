// ============================================================
// HardwarePanel — Hinges, slides, handles with auto-quantities
// ============================================================

import React from 'react';
import type { HardwareRequirement } from '../hooks';

interface HardwarePanelProps {
  requirements: HardwareRequirement[];
}

const TYPE_ICONS: Record<string, string> = {
  hinge: '🔩',
  slide: '↔',
  handle: '⌂',
  clip: '⊡',
  screw: '⚙',
  pull: '⊡',
  'cam-lock': '⊞',
};

export function HardwarePanel({ requirements }: HardwarePanelProps) {
  if (requirements.length === 0) {
    return (
      <section
        data-testid="hardware-panel"
        aria-labelledby="hardware-heading"
        style={{ padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}
      >
        <h3 id="hardware-heading" style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
          Hardware
        </h3>
        <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
          Hardware requirements will appear once parts are calculated.
        </p>
      </section>
    );
  }

  return (
    <section
      data-testid="hardware-panel"
      aria-labelledby="hardware-heading"
      style={{ padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}
    >
      <h3 id="hardware-heading" style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
        Hardware
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {requirements.map(req => (
          <div
            key={req.hardwareId}
            data-testid={`hardware-item-${req.hardwareId}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: '#fff',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }} aria-hidden="true">
                {TYPE_ICONS[req.type] ?? '●'}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{req.name}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{req.notes}</div>
              </div>
            </div>
            <span
              aria-label={`${req.quantity} ${req.name}`}
              style={{
                padding: '3px 10px',
                borderRadius: 99,
                background: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {req.quantity}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default HardwarePanel;
