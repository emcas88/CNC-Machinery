// ─────────────────────────────────────────────
//  CabinetPalette – drag source for new cabinets
// ─────────────────────────────────────────────

import React, { useState } from 'react';
import { CabinetCategory, CabinetTemplate } from '../types';
import { CABINET_TEMPLATES } from '../api';

interface CabinetPaletteProps {
  onDragStart: (template: CabinetTemplate) => void;
  onSelectTemplate: (template: CabinetTemplate) => void;
}

const CATEGORIES: CabinetCategory[] = ['base', 'upper', 'tall', 'corner', 'island', 'appliance'];

const CATEGORY_LABELS: Record<CabinetCategory, string> = {
  base: 'Base',
  upper: 'Upper',
  tall: 'Tall',
  corner: 'Corner',
  island: 'Island',
  appliance: 'Appliance',
};

const CabinetPalette: React.FC<CabinetPaletteProps> = ({ onDragStart, onSelectTemplate }) => {
  const [activeCategory, setActiveCategory] = useState<CabinetCategory>('base');

  const filtered = CABINET_TEMPLATES.filter(t => t.category === activeCategory);

  return (
    <div data-testid="cabinet-palette" style={containerStyle}>
      <h3 style={headingStyle}>Cabinet Palette</h3>

      {/* Category tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            data-testid={`palette-category-${cat}`}
            onClick={() => setActiveCategory(cat)}
            style={{
              ...tabStyle,
              background: activeCategory === cat ? '#2563eb' : '#f3f4f6',
              color: activeCategory === cat ? '#fff' : '#374151',
            }}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Template list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map(template => (
          <div
            key={template.id}
            data-testid={`palette-item-${template.id}`}
            draggable
            onDragStart={() => onDragStart(template)}
            onClick={() => onSelectTemplate(template)}
            style={itemStyle(template.color)}
            title={`${template.name} – ${template.width}×${template.depth}mm`}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onSelectTemplate(template)}
            aria-label={template.name}
          >
            {/* Top-down cabinet preview */}
            <svg
              width={28}
              height={20}
              viewBox="0 0 28 20"
              style={{ flexShrink: 0 }}
              aria-hidden="true"
            >
              <rect x={1} y={1} width={26} height={18} fill={template.color} stroke="#9ca3af" strokeWidth={1} rx={1} />
              {template.hasApplianceCutout && (
                <circle cx={14} cy={10} r={5} fill="none" stroke="#6b7280" strokeWidth={1} strokeDasharray="2 1" />
              )}
            </svg>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{template.name}</div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>
                {template.width}×{template.depth}×{template.height} mm
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── styles ──
const containerStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 12,
  overflowY: 'auto',
};

const headingStyle: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: 13,
  fontWeight: 600,
  color: '#111827',
};

const tabStyle: React.CSSProperties = {
  padding: '2px 7px',
  fontSize: 10,
  fontWeight: 500,
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  transition: 'background 120ms',
};

const itemStyle = (color: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 8px',
  borderRadius: 6,
  border: `1px solid ${color}`,
  cursor: 'grab',
  background: '#fafafa',
  transition: 'background 100ms',
});

export default CabinetPalette;
