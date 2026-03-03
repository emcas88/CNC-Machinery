// ============================================================
// PartsTable — Auto-generated parts list with dimensions
// ============================================================

import React from 'react';
import type { Part } from '../types';

interface PartsTableProps {
  parts: Part[];
  materialNames?: Record<string, string>;
}

function formatDimension(n: number): string {
  return `${n}`;
}

export function PartsTable({ parts, materialNames = {} }: PartsTableProps) {
  if (parts.length === 0) {
    return (
      <section
        data-testid="parts-table"
        aria-labelledby="parts-heading"
        style={{ padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}
      >
        <h3 id="parts-heading" style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
          Parts List
        </h3>
        <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>
          No parts calculated yet. Configure dimensions and materials above.
        </p>
      </section>
    );
  }

  return (
    <section
      data-testid="parts-table"
      aria-labelledby="parts-heading"
      style={{ padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}
    >
      <h3 id="parts-heading" style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700 }}>
        Parts List
        <span
          style={{
            marginLeft: 8,
            padding: '2px 8px',
            borderRadius: 99,
            background: '#e5e7eb',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {parts.reduce((s, p) => s + p.quantity, 0)} pcs
        </span>
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table
          aria-label="Parts list"
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
        >
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              {['Part Name', 'Type', 'Qty', 'W (mm)', 'H (mm)', 'D (mm)', 'Material'].map(h => (
                <th
                  key={h}
                  style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: '#374151',
                    borderBottom: '2px solid #d1d5db',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parts.map((part, idx) => (
              <tr
                key={part.id}
                data-testid={`part-row-${part.id}`}
                style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}
              >
                <td style={{ padding: '7px 12px', fontWeight: 500 }}>{part.name}</td>
                <td style={{ padding: '7px 12px', color: '#6b7280', textTransform: 'capitalize' }}>
                  {part.type.replace(/-/g, ' ')}
                </td>
                <td style={{ padding: '7px 12px', textAlign: 'center', fontWeight: 600 }}>
                  {part.quantity}
                </td>
                <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                  {formatDimension(part.dimensions.width)}
                </td>
                <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                  {formatDimension(part.dimensions.height)}
                </td>
                <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                  {formatDimension(part.dimensions.depth)}
                </td>
                <td style={{ padding: '7px 12px', color: '#6b7280' }}>
                  {materialNames[part.materialId] ?? part.materialId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default PartsTable;
