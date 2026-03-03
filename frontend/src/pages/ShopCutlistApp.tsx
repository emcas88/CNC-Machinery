// F24 – ShopCutlistApp: Real API-driven shop cutlist with sort, filter,
// group-by-material, mark-as-cut, grain direction display, and print.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CutlistPart {
  id: string;
  name: string;
  length: number;
  width: number;
  thickness: number;
  material: string;
  grainDirection: 'length' | 'width' | 'none';
  quantity: number;
  isCut: boolean;
  edgeBanding?: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  notes?: string;
  jobId: string;
  productName?: string;
}

export interface CutlistResponse {
  jobId: string;
  jobName: string;
  parts: CutlistPart[];
  totalParts: number;
  cutParts: number;
}

export type SortField = 'name' | 'material' | 'length' | 'width' | 'thickness';
export type SortDirection = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// API helpers (replaceable with a real HTTP client)
// ---------------------------------------------------------------------------

export const cutlistApi = {
  async fetchCutlist(jobId: string): Promise<CutlistResponse> {
    const res = await fetch(`/api/cutlists/${jobId}`);
    if (!res.ok) throw new Error(`Failed to load cutlist: ${res.status}`);
    return res.json();
  },

  async markPartCut(jobId: string, partId: string, isCut: boolean): Promise<void> {
    const res = await fetch(`/api/cutlists/${jobId}/parts/${partId}/cut`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isCut }),
    });
    if (!res.ok) throw new Error(`Failed to update part: ${res.status}`);
  },
};

// ---------------------------------------------------------------------------
// Grain direction icon
// ---------------------------------------------------------------------------

export function GrainDirectionIcon({ direction }: { direction: CutlistPart['grainDirection'] }) {
  if (direction === 'none') return null;

  const rotation = direction === 'width' ? 90 : 0;

  return (
    <svg
      data-testid={`grain-${direction}`}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      className="inline-block text-amber-400"
      aria-label={`Grain direction: ${direction}`}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <line x1="3" y1="4" x2="17" y2="4" stroke="currentColor" strokeWidth="1.5" />
      <line x1="3" y1="8" x2="17" y2="8" stroke="currentColor" strokeWidth="1.5" />
      <line x1="3" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.5" />
      <line x1="3" y1="16" x2="17" y2="16" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Edge banding indicator
// ---------------------------------------------------------------------------

function EdgeBandingIndicator({ edges }: { edges: CutlistPart['edgeBanding'] }) {
  if (!edges) return null;
  const sides = [
    edges.top && 'T',
    edges.bottom && 'B',
    edges.left && 'L',
    edges.right && 'R',
  ].filter(Boolean);
  if (sides.length === 0) return null;

  return (
    <span className="text-xs bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded" data-testid="edge-banding">
      EB: {sides.join('')}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Part row
// ---------------------------------------------------------------------------

interface PartRowProps {
  part: CutlistPart;
  onToggleCut: (partId: string) => void;
}

export function PartRow({ part, onToggleCut }: PartRowProps) {
  return (
    <div
      data-testid={`part-row-${part.id}`}
      className={`flex items-center gap-3 px-4 py-3 border-b border-gray-800 transition-colors ${
        part.isCut ? 'bg-green-950/20 opacity-70' : 'bg-gray-900/50'
      }`}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={part.isCut}
        onChange={() => onToggleCut(part.id)}
        className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-green-500 focus:ring-green-500"
        aria-label={`Mark ${part.name} as cut`}
      />

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium text-sm ${part.isCut ? 'line-through text-gray-500' : 'text-gray-100'}`}>
            {part.name}
          </span>
          <GrainDirectionIcon direction={part.grainDirection} />
          <EdgeBandingIndicator edges={part.edgeBanding} />
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          {part.length} × {part.width} × {part.thickness}mm · {part.material}
          {part.productName && ` · ${part.productName}`}
        </div>
        {part.notes && (
          <div className="text-xs text-yellow-400/70 mt-0.5 italic">{part.notes}</div>
        )}
      </div>

      {/* Quantity */}
      <span className="text-sm text-gray-400 font-mono">×{part.quantity}</span>

      {/* Status */}
      {part.isCut && (
        <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded-full">Cut</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Material group header
// ---------------------------------------------------------------------------

function MaterialGroupHeader({ material, count, cutCount }: { material: string; count: number; cutCount: number }) {
  return (
    <div className="sticky top-0 z-10 px-4 py-2 bg-gray-800 border-b border-gray-700" data-testid={`group-${material}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm text-gray-200">{material}</span>
        <span className="text-xs text-gray-400">
          {cutCount}/{count} cut
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ShopCutlistAppProps {
  jobId: string;
  api?: typeof cutlistApi;
}

export function ShopCutlistApp({ jobId, api = cutlistApi }: ShopCutlistAppProps) {
  const [cutlist, setCutlist] = useState<CutlistResponse | null>(null);
  const [parts, setParts] = useState<CutlistPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search / filter / sort state
  const [search, setSearch] = useState('');
  const [materialFilter, setMaterialFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [groupByMaterial, setGroupByMaterial] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  // -----------------------------------------------------------------------
  // Fetch cutlist
  // -----------------------------------------------------------------------

  const loadCutlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.fetchCutlist(jobId);
      setCutlist(data);
      setParts(data.parts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [jobId, api]);

  useEffect(() => {
    loadCutlist();
  }, [loadCutlist]);

  // -----------------------------------------------------------------------
  // Toggle cut status
  // -----------------------------------------------------------------------

  const toggleCut = useCallback(
    async (partId: string) => {
      setParts((prev) =>
        prev.map((p) => (p.id === partId ? { ...p, isCut: !p.isCut } : p))
      );

      const part = parts.find((p) => p.id === partId);
      if (part) {
        try {
          await api.markPartCut(jobId, partId, !part.isCut);
        } catch {
          // Revert on failure
          setParts((prev) =>
            prev.map((p) => (p.id === partId ? { ...p, isCut: part.isCut } : p))
          );
        }
      }
    },
    [parts, jobId, api]
  );

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  const materials = useMemo(() => {
    const set = new Set(parts.map((p) => p.material));
    return Array.from(set).sort();
  }, [parts]);

  const processedParts = useMemo(() => {
    let result = [...parts];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.material.toLowerCase().includes(q) ||
          p.notes?.toLowerCase().includes(q)
      );
    }

    // Material filter
    if (materialFilter !== 'all') {
      result = result.filter((p) => p.material === materialFilter);
    }

    // Hide completed
    if (hideCompleted) {
      result = result.filter((p) => !p.isCut);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'material':
          cmp = a.material.localeCompare(b.material);
          break;
        case 'length':
          cmp = a.length - b.length;
          break;
        case 'width':
          cmp = a.width - b.width;
          break;
        case 'thickness':
          cmp = a.thickness - b.thickness;
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [parts, search, materialFilter, sortField, sortDirection, hideCompleted]);

  const groupedParts = useMemo(() => {
    if (!groupByMaterial) return null;
    const groups: Record<string, CutlistPart[]> = {};
    for (const p of processedParts) {
      if (!groups[p.material]) groups[p.material] = [];
      groups[p.material].push(p);
    }
    return groups;
  }, [processedParts, groupByMaterial]);

  const doneCount = parts.filter((p) => p.isCut).length;
  const totalCount = parts.length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // -----------------------------------------------------------------------
  // Print
  // -----------------------------------------------------------------------

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // -----------------------------------------------------------------------
  // Sort toggle
  // -----------------------------------------------------------------------

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950" data-testid="loading">
        <div className="text-gray-400 animate-pulse">Loading cutlist…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-950 gap-4" data-testid="error">
        <div className="text-red-400">{error}</div>
        <button onClick={loadCutlist} className="px-4 py-2 bg-gray-800 text-gray-200 rounded hover:bg-gray-700">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950" ref={printRef}>
      {/* Header */}
      <div className="px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-bold text-gray-100">Shop Cut List</h1>
            {cutlist && <p className="text-xs text-gray-500">{cutlist.jobName}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {doneCount}/{totalCount} cut
            </span>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-gray-800 text-gray-200 rounded text-sm hover:bg-gray-700 flex items-center gap-1.5"
              data-testid="print-btn"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-400">
                <path d="M4 6V1h8v5M4 12H2a1 1 0 01-1-1V7a1 1 0 011-1h12a1 1 0 011 1v4a1 1 0 01-1 1h-2" stroke="currentColor" strokeWidth="1.5" />
                <rect x="4" y="10" width="8" height="5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              Print
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
            data-testid="progress-bar"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={totalCount}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-3 bg-gray-900/50 border-b border-gray-800 flex flex-wrap gap-2 items-center">
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search parts…"
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 flex-1 min-w-[200px]"
          data-testid="search-input"
        />

        {/* Material filter */}
        <select
          value={materialFilter}
          onChange={(e) => setMaterialFilter(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200"
          data-testid="material-filter"
        >
          <option value="all">All Materials</option>
          {materials.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* Sort buttons */}
        <div className="flex gap-1">
          {(['name', 'material', 'length', 'width'] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`px-2 py-1 text-xs rounded ${
                sortField === field ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-800 text-gray-400'
              }`}
              data-testid={`sort-${field}`}
            >
              {field.charAt(0).toUpperCase() + field.slice(1)}
              {sortField === field && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
            </button>
          ))}
        </div>

        {/* Toggle controls */}
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={groupByMaterial}
            onChange={(e) => setGroupByMaterial(e.target.checked)}
            className="rounded border-gray-600"
            data-testid="group-toggle"
          />
          Group by material
        </label>

        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => setHideCompleted(e.target.checked)}
            className="rounded border-gray-600"
            data-testid="hide-completed"
          />
          Hide completed
        </label>
      </div>

      {/* Parts list */}
      <div className="flex-1 overflow-y-auto" data-testid="parts-list">
        {processedParts.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm" data-testid="empty-state">
            No parts match your filters
          </div>
        ) : groupedParts ? (
          Object.entries(groupedParts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([material, matParts]) => (
              <div key={material}>
                <MaterialGroupHeader
                  material={material}
                  count={matParts.length}
                  cutCount={matParts.filter((p) => p.isCut).length}
                />
                {matParts.map((part) => (
                  <PartRow key={part.id} part={part} onToggleCut={toggleCut} />
                ))}
              </div>
            ))
        ) : (
          processedParts.map((part) => (
            <PartRow key={part.id} part={part} onToggleCut={toggleCut} />
          ))
        )}
      </div>
    </div>
  );
}

export default ShopCutlistApp;
