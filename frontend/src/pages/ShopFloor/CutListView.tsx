// ─── CutListView ──────────────────────────────────────────────────────────────
// Feature 16: Shop Floor Apps
// Simplified cut list view for shop floor operators.
// Large text, material grouping, per-part checkboxes.

import React, { useState } from 'react';
import { CutListItem, CutListGroup, MaterialType } from './types';
import { getMaterialLabel, formatDimensions } from './hooks';

// ─── Material color map ───────────────────────────────────────────────────────

const MATERIAL_COLORS: Record<MaterialType, { bg: string; border: string; text: string }> = {
  aluminum: { bg: '#f0f9ff', border: '#7dd3fc', text: '#0369a1' },
  steel: { bg: '#f8fafc', border: '#94a3b8', text: '#334155' },
  stainless_steel: { bg: '#f1f5f9', border: '#64748b', text: '#1e293b' },
  titanium: { bg: '#fdf4ff', border: '#d8b4fe', text: '#7c3aed' },
  brass: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
  plastic: { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
  wood: { bg: '#fef3c7', border: '#f59e0b', text: '#78350f' },
  composite: { bg: '#fdf2f8', border: '#f0abfc', text: '#86198f' },
  other: { bg: '#f9fafb', border: '#d1d5db', text: '#374151' },
};

// ─── CutListItemRow ───────────────────────────────────────────────────────────

interface CutListItemRowProps {
  item: CutListItem;
  onToggle: (partId: string) => void;
  large?: boolean;
}

export const CutListItemRow: React.FC<CutListItemRowProps> = ({
  item,
  onToggle,
  large = false,
}) => {
  const baseSize = large ? 20 : 16;
  const subSize = large ? 15 : 12;

  return (
    <div
      data-testid="cut-list-item-row"
      data-part-id={item.partId}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: large ? 20 : 14,
        padding: large ? '18px 0' : '12px 0',
        borderBottom: '1px solid #f3f4f6',
        opacity: item.isCut ? 0.55 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Checkbox */}
      <button
        data-testid="cut-checkbox"
        aria-label={item.isCut ? `Unmark ${item.partName} as cut` : `Mark ${item.partName} as cut`}
        aria-pressed={item.isCut}
        onClick={() => onToggle(item.partId)}
        style={{
          flexShrink: 0,
          width: large ? 40 : 28,
          height: large ? 40 : 28,
          borderRadius: 8,
          border: `2px solid ${item.isCut ? '#22c55e' : '#d1d5db'}`,
          background: item.isCut ? '#22c55e' : '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.18s cubic-bezier(0.16,1,0.3,1)',
          padding: 0,
        }}
      >
        {item.isCut && (
          <svg
            width={large ? 22 : 15}
            height={large ? 22 : 15}
            viewBox="0 0 15 15"
            fill="none"
          >
            <path
              d="M3 7.5L6.5 11L12 4"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Part info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: baseSize,
            color: item.isCut ? '#9ca3af' : '#111827',
            textDecoration: item.isCut ? 'line-through' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.partName}
        </div>
        <div style={{ fontSize: subSize, color: '#9ca3af', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span>{item.partNumber}</span>
          <span>·</span>
          <span data-testid="item-dimensions">{formatDimensions(item.dimensions)}</span>
          {item.stockReference && (
            <>
              <span>·</span>
              <span>Stock: {item.stockReference}</span>
            </>
          )}
        </div>
        {item.notes && (
          <div
            data-testid="item-notes"
            style={{ fontSize: subSize - 1, color: '#f59e0b', marginTop: 4, fontStyle: 'italic' }}
          >
            Note: {item.notes}
          </div>
        )}
      </div>

      {/* Quantity */}
      <div
        data-testid="item-quantity"
        style={{
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: large ? 22 : 16, color: item.isCut ? '#9ca3af' : '#111827' }}>
          {item.isCut ? item.quantity : item.quantity}
        </div>
        <div style={{ fontSize: subSize - 1, color: '#9ca3af' }}>
          {item.isCut ? 'cut' : 'pcs'}
        </div>
      </div>
    </div>
  );
};

// ─── MaterialGroupSection ─────────────────────────────────────────────────────

interface MaterialGroupSectionProps {
  group: CutListGroup;
  onToggle: (partId: string) => void;
  expanded?: boolean;
  large?: boolean;
}

export const MaterialGroupSection: React.FC<MaterialGroupSectionProps> = ({
  group,
  onToggle,
  expanded: defaultExpanded = true,
  large = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const colors = MATERIAL_COLORS[group.material];
  const allCut = group.items.every((i) => i.isCut);
  const pct = group.totalParts > 0
    ? Math.round((group.cutParts / group.totalParts) * 100)
    : 0;

  return (
    <div
      data-testid="material-group-section"
      data-material={group.material}
      style={{
        border: `1.5px solid ${colors.border}`,
        borderRadius: 14,
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      {/* Group header */}
      <button
        data-testid="material-group-header"
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: '100%',
          background: colors.bg,
          border: 'none',
          padding: large ? '16px 20px' : '12px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          textAlign: 'left',
        }}
      >
        {/* Material label */}
        <span
          style={{
            fontWeight: 700,
            fontSize: large ? 18 : 14,
            color: colors.text,
            flex: 1,
          }}
        >
          {getMaterialLabel(group.material)}
        </span>

        {/* Progress indicator */}
        <span
          style={{
            fontSize: large ? 15 : 12,
            color: allCut ? '#22c55e' : colors.text,
            fontWeight: 600,
          }}
        >
          {group.cutParts}/{group.totalParts} pcs · {pct}%
        </span>

        {/* Expand chevron */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            color: colors.text,
            flexShrink: 0,
          }}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Items */}
      {expanded && (
        <div style={{ padding: large ? '0 20px' : '0 16px', background: '#fff' }}>
          {group.items.map((item) => (
            <CutListItemRow
              key={item.id}
              item={item}
              onToggle={onToggle}
              large={large}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── CutListProgress ──────────────────────────────────────────────────────────

interface CutListProgressProps {
  total: number;
  cut: number;
  percent: number;
}

export const CutListProgress: React.FC<CutListProgressProps> = ({
  total,
  cut,
  percent,
}) => {
  const isComplete = percent === 100;

  return (
    <div
      data-testid="cut-list-progress"
      style={{
        background: isComplete ? '#f0fdf4' : '#fff',
        border: `1.5px solid ${isComplete ? '#86efac' : '#e5e7eb'}`,
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>
          {isComplete ? '✓ All parts cut' : 'Cutting Progress'}
        </span>
        <span
          style={{
            fontWeight: 700,
            fontSize: 28,
            color: isComplete ? '#16a34a' : '#3b82f6',
            lineHeight: 1,
          }}
        >
          {percent}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 10,
          background: '#e5e7eb',
          borderRadius: 5,
          overflow: 'hidden',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            background: isComplete ? '#22c55e' : '#3b82f6',
            borderRadius: 5,
            transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)',
          }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <div style={{ fontSize: 13, color: '#6b7280' }}>
        {cut} of {total} pieces cut
      </div>
    </div>
  );
};

// ─── CutListView (main component) ─────────────────────────────────────────────

export interface CutListViewProps {
  /** Job name/number to display in the header */
  jobLabel?: string;
  /** Cut list groups (from useCutList().groups) */
  groups?: CutListGroup[];
  /** Individual items (from useCutList().items) */
  items?: CutListItem[];
  /** Overall progress */
  progress?: { total: number; cut: number; percent: number };
  loading?: boolean;
  error?: string | null;
  /** Toggle function from useCutList */
  onToggleCut?: (partId: string) => void;
  /** Operator ID for action logging */
  operatorId?: string;
  /** Increase font/target sizes for large screens near machines */
  largeMode?: boolean;
  /** CSS class */
  className?: string;
}

export const CutListView: React.FC<CutListViewProps> = ({
  jobLabel,
  groups = [],
  items = [],
  progress = { total: 0, cut: 0, percent: 0 },
  loading = false,
  error = null,
  onToggleCut,
  operatorId = 'Operator',
  largeMode = false,
  className,
}) => {
  const [filterMaterial, setFilterMaterial] = useState<MaterialType | 'all'>('all');
  const [showOnlyUncut, setShowOnlyUncut] = useState(false);

  const handleToggle = (partId: string) => {
    onToggleCut?.(partId);
  };

  const filteredGroups = groups
    .filter((g) => filterMaterial === 'all' || g.material === filterMaterial)
    .map((g) => ({
      ...g,
      items: showOnlyUncut ? g.items.filter((i) => !i.isCut) : g.items,
    }))
    .filter((g) => g.items.length > 0);

  const uniqueMaterials = [...new Set(groups.map((g) => g.material))];

  if (loading) {
    return (
      <div data-testid="cut-list-loading" style={cutListStyles.centered}>
        <div style={cutListStyles.spinner} />
        <p style={{ color: '#6b7280', marginTop: 16, fontSize: largeMode ? 18 : 14 }}>
          Loading cut list…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="cut-list-error" style={cutListStyles.centered}>
        <div style={{ color: '#ef4444', fontWeight: 700, fontSize: largeMode ? 20 : 16 }}>
          Error Loading Cut List
        </div>
        <p style={{ color: '#6b7280', marginTop: 8 }}>{error}</p>
      </div>
    );
  }

  return (
    <div
      data-testid="cut-list-view"
      className={className}
      style={{
        ...cutListStyles.container,
        fontSize: largeMode ? 18 : 14,
      }}
    >
      {/* ── Header ── */}
      <header style={cutListStyles.header}>
        <div>
          <h1
            style={{
              fontSize: largeMode ? 28 : 20,
              fontWeight: 700,
              color: '#111827',
              margin: 0,
            }}
          >
            Cut List
            {jobLabel && (
              <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: 10 }}>
                — {jobLabel}
              </span>
            )}
          </h1>
          <div style={{ fontSize: largeMode ? 15 : 12, color: '#9ca3af', marginTop: 4 }}>
            {operatorId} · {new Date().toLocaleDateString()}
          </div>
        </div>
      </header>

      <div style={{ padding: largeMode ? '24px 32px' : '16px 20px' }}>
        {/* Progress summary */}
        <CutListProgress {...progress} />

        {/* Filters */}
        {groups.length > 1 && (
          <div
            data-testid="cut-list-filters"
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}
          >
            <button
              data-testid="filter-all"
              onClick={() => setFilterMaterial('all')}
              style={filterMaterial === 'all' ? cutListStyles.filterActive : cutListStyles.filter}
            >
              All materials
            </button>
            {uniqueMaterials.map((mat) => (
              <button
                key={mat}
                data-testid={`filter-${mat}`}
                onClick={() => setFilterMaterial(mat)}
                style={filterMaterial === mat ? cutListStyles.filterActive : cutListStyles.filter}
              >
                {getMaterialLabel(mat)}
              </button>
            ))}

            <label
              data-testid="show-uncut-toggle"
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', cursor: 'pointer', fontSize: 13, color: '#374151' }}
            >
              <input
                type="checkbox"
                checked={showOnlyUncut}
                onChange={(e) => setShowOnlyUncut(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              Show uncut only
            </label>
          </div>
        )}

        {/* Empty state */}
        {filteredGroups.length === 0 ? (
          <div
            data-testid="cut-list-empty"
            style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: largeMode ? 18 : 14 }}
          >
            {showOnlyUncut ? 'All parts have been cut!' : 'No items in cut list'}
          </div>
        ) : (
          filteredGroups.map((group) => (
            <MaterialGroupSection
              key={group.material}
              group={group}
              onToggle={handleToggle}
              large={largeMode}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const cutListStyles = {
  container: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'Inter', system-ui, sans-serif",
  } as React.CSSProperties,
  header: {
    background: '#fff',
    borderBottom: '1px solid #e5e7eb',
    padding: '16px 20px',
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
  } as React.CSSProperties,
  centered: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '50vh',
  } as React.CSSProperties,
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'shopfloor-spin 0.8s linear infinite',
  } as React.CSSProperties,
  filter: {
    padding: '5px 12px',
    borderRadius: 9999,
    border: '1.5px solid #e5e7eb',
    background: '#fff',
    color: '#374151',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  } as React.CSSProperties,
  filterActive: {
    padding: '5px 12px',
    borderRadius: 9999,
    border: '1.5px solid #3b82f6',
    background: '#eff6ff',
    color: '#2563eb',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  } as React.CSSProperties,
};

export default CutListView;
