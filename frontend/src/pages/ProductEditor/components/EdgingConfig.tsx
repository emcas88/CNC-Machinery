// ============================================================
// EdgingConfig — Edge banding configuration per part
// ============================================================

import React, { useState } from 'react';
import type { Part, EdgeBanding, Material, EdgePosition } from '../types';

interface EdgingConfigProps {
  parts: Part[];
  materials: Material[];
  edging: EdgeBanding[];
  onChange: (edging: EdgeBanding[]) => void;
}

const EDGE_POSITIONS: EdgePosition[] = ['top', 'bottom', 'left', 'right'];

function getEdgingForPart(edging: EdgeBanding[], partId: string): EdgeBanding {
  return (
    edging.find(e => e.partId === partId) ?? {
      partId,
      edges: {},
    }
  );
}

export function EdgingConfig({ parts, materials, edging, onChange }: EdgingConfigProps) {
  const [expandedPartId, setExpandedPartId] = useState<string | null>(null);

  const handleEdgeToggle = (partId: string, edge: EdgePosition, checked: boolean) => {
    const existing = getEdgingForPart(edging, partId);
    const updated: EdgeBanding = {
      ...existing,
      edges: { ...existing.edges, [edge]: checked },
    };
    const newEdging = edging.filter(e => e.partId !== partId);
    onChange([...newEdging, updated]);
  };

  const handleMaterialChange = (partId: string, materialId: string) => {
    const existing = getEdgingForPart(edging, partId);
    const updated: EdgeBanding = { ...existing, materialId };
    const newEdging = edging.filter(e => e.partId !== partId);
    onChange([...newEdging, updated]);
  };

  const getEdgeCount = (partId: string): number => {
    const e = getEdgingForPart(edging, partId);
    return Object.values(e.edges).filter(Boolean).length;
  };

  if (parts.length === 0) {
    return (
      <section
        data-testid="edging-config"
        aria-labelledby="edging-heading"
        style={{ padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}
      >
        <h3 id="edging-heading" style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
          Edge Banding
        </h3>
        <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
          Configure dimensions and materials first to set up edge banding.
        </p>
      </section>
    );
  }

  return (
    <section
      data-testid="edging-config"
      aria-labelledby="edging-heading"
      style={{ padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}
    >
      <h3 id="edging-heading" style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
        Edge Banding
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {parts.map(part => {
          const isOpen = expandedPartId === part.id;
          const edgeCount = getEdgeCount(part.id);
          const partEdging = getEdgingForPart(edging, part.id);

          return (
            <div key={part.id} data-testid={`edging-part-${part.id}`} style={{ border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff' }}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setExpandedPartId(isOpen ? null : part.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: 'left',
                }}
              >
                <span>
                  {part.name}
                  {part.quantity > 1 && (
                    <span style={{ marginLeft: 6, fontWeight: 400, color: '#9ca3af' }}>×{part.quantity}</span>
                  )}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {edgeCount > 0 && (
                    <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 99, background: '#dcfce7', color: '#166534' }}>
                      {edgeCount} edge{edgeCount > 1 ? 's' : ''}
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: '#9ca3af' }}>{isOpen ? '▲' : '▼'}</span>
                </span>
              </button>

              {isOpen && (
                <div
                  style={{ padding: '0 12px 12px', borderTop: '1px solid #f3f4f6' }}
                  data-testid={`edging-detail-${part.id}`}
                >
                  <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                    {EDGE_POSITIONS.map(edge => (
                      <label
                        key={edge}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          aria-label={`${edge} edge banding for ${part.name}`}
                          checked={!!partEdging.edges[edge]}
                          onChange={e => handleEdgeToggle(part.id, edge, e.target.checked)}
                          data-testid={`edge-${part.id}-${edge}`}
                        />
                        <span style={{ textTransform: 'capitalize' }}>{edge}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                      Banding Material
                    </label>
                    <select
                      aria-label={`Edge banding material for ${part.name}`}
                      value={partEdging.materialId ?? ''}
                      onChange={e => handleMaterialChange(part.id, e.target.value)}
                      data-testid={`edging-material-${part.id}`}
                      style={{
                        padding: '6px 10px',
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        fontSize: 13,
                        background: '#fff',
                      }}
                    >
                      <option value="">— Use carcass material —</option>
                      {materials.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default EdgingConfig;
