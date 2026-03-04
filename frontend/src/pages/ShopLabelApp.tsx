// F24 – ShopLabelApp: Real API-driven label printing with QR codes,
// batch print, and label template selection.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { QrCode } from '@/components/shop/QrCode';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LabelData {
  id: string;
  code: string;
  partName: string;
  material: string;
  dimensions: string;
  sheetRef: string;
  position: { x: number; y: number };
  jobId: string;
  jobName: string;
  grainDirection: 'length' | 'width' | 'none';
  edgeBanding: string;
  isPrinted: boolean;
  qrData: string;
}

export interface LabelsResponse {
  labels: LabelData[];
  totalLabels: number;
  printedCount: number;
}

export type LabelTemplate = 'standard' | 'compact' | 'detailed' | 'barcode-only';

export interface LabelTemplateConfig {
  id: LabelTemplate;
  name: string;
  description: string;
  width: number;
  height: number;
}

export const LABEL_TEMPLATES: LabelTemplateConfig[] = [
  { id: 'standard', name: 'Standard', description: '2" × 1" with QR + part info', width: 200, height: 100 },
  { id: 'compact', name: 'Compact', description: '1.5" × 0.75" QR + code only', width: 150, height: 75 },
  { id: 'detailed', name: 'Detailed', description: '3" × 2" full info + edge banding', width: 300, height: 200 },
  { id: 'barcode-only', name: 'Barcode Only', description: '2" × 0.5" QR code strip', width: 200, height: 50 },
];

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

export const labelsApi = {
  async fetchLabels(params?: { jobId?: string; sheetRef?: string }): Promise<LabelsResponse> {
    const url = new URL('/api/labels', window.location.origin);
    if (params?.jobId) url.searchParams.set('jobId', params.jobId);
    if (params?.sheetRef) url.searchParams.set('sheetRef', params.sheetRef);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Failed to load labels: ${res.status}`);
    return res.json();
  },

  async markPrinted(labelIds: string[]): Promise<void> {
    const res = await fetch('/api/labels/mark-printed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labelIds }),
    });
    if (!res.ok) throw new Error(`Failed to mark labels as printed: ${res.status}`);
  },

  async batchPrint(labelIds: string[], template: LabelTemplate): Promise<Blob> {
    const res = await fetch('/api/labels/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ labelIds, template }),
    });
    if (!res.ok) throw new Error(`Failed to print labels: ${res.status}`);
    return res.blob();
  },
};

// ---------------------------------------------------------------------------
// Label card component
// ---------------------------------------------------------------------------

interface LabelCardProps {
  label: LabelData;
  template: LabelTemplate;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function LabelCard({ label, template, selected, onSelect }: LabelCardProps) {
  return (
    <div
      data-testid={`label-card-${label.id}`}
      className={`border rounded-lg p-3 transition-all cursor-pointer ${
        selected
          ? 'border-blue-500 bg-blue-950/20 ring-1 ring-blue-500/50'
          : label.isPrinted
          ? 'border-gray-700 bg-gray-900/30 opacity-60'
          : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
      }`}
      onClick={() => onSelect(label.id)}
    >
      <div className="flex gap-3">
        {/* QR Code */}
        <div className="flex-shrink-0">
          <QrCode
            data={label.qrData}
            size={template === 'compact' ? 48 : template === 'detailed' ? 80 : 64}
            testId={`qr-${label.id}`}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm text-gray-100">{label.code}</span>
            {label.isPrinted && (
              <span className="text-xs bg-green-900/40 text-green-400 px-1.5 py-0.5 rounded-full">
                Printed
              </span>
            )}
          </div>
          <div className="text-sm text-gray-300 truncate">{label.partName}</div>
          {(template === 'standard' || template === 'detailed') && (
            <>
              <div className="text-xs text-gray-500 mt-0.5">{label.dimensions} · {label.material}</div>
              <div className="text-xs text-gray-500">{label.sheetRef} · X:{label.position.x} Y:{label.position.y}</div>
            </>
          )}
          {template === 'detailed' && (
            <>
              {label.grainDirection !== 'none' && (
                <div className="text-xs text-amber-400/70 mt-0.5">
                  Grain: {label.grainDirection}
                </div>
              )}
              {label.edgeBanding && (
                <div className="text-xs text-blue-400/70">EB: {label.edgeBanding}</div>
              )}
            </>
          )}
        </div>

        {/* Selection checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(label.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 self-start mt-1"
          aria-label={`Select ${label.code}`}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template selector
// ---------------------------------------------------------------------------

interface TemplateSelectorProps {
  value: LabelTemplate;
  onChange: (t: LabelTemplate) => void;
}

export function TemplateSelector({ value, onChange }: TemplateSelectorProps) {
  return (
    <div className="flex gap-2" data-testid="template-selector">
      {LABEL_TEMPLATES.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-3 py-1.5 rounded text-xs transition-colors ${
            value === t.id
              ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
              : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
          }`}
          title={t.description}
          data-testid={`template-${t.id}`}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ShopLabelAppProps {
  jobId?: string;
  api?: typeof labelsApi;
}

export function ShopLabelApp({ jobId, api = labelsApi }: ShopLabelAppProps) {
  const [labels, setLabels] = useState<LabelData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [template, setTemplate] = useState<LabelTemplate>('standard');
  const [printing, setPrinting] = useState(false);
  const [search, setSearch] = useState('');
  const [sheetFilter, setSheetFilter] = useState<string>('all');
  const [showPrintedOnly, setShowPrintedOnly] = useState<'all' | 'printed' | 'unprinted'>('all');

  // -----------------------------------------------------------------------
  // Fetch labels
  // -----------------------------------------------------------------------

  const loadLabels = useCallback(async () => {
    if (!jobId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await api.fetchLabels({ jobId });
      setLabels(data.labels ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load labels');
    } finally {
      setLoading(false);
    }
  }, [jobId, api]);

  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  // -----------------------------------------------------------------------
  // Selection
  // -----------------------------------------------------------------------

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredLabels.map((l) => l.id)));
  }, []);

  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectUnprinted = useCallback(() => {
    setSelectedIds(new Set(labels.filter((l) => !l.isPrinted).map((l) => l.id)));
  }, [labels]);

  // -----------------------------------------------------------------------
  // Filtering
  // -----------------------------------------------------------------------

  const sheets = useMemo(() => {
    const set = new Set(labels.map((l) => l.sheetRef));
    return Array.from(set).sort();
  }, [labels]);

  const filteredLabels = useMemo(() => {
    let result = [...labels];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.code.toLowerCase().includes(q) ||
          l.partName.toLowerCase().includes(q) ||
          l.material.toLowerCase().includes(q)
      );
    }

    if (sheetFilter !== 'all') {
      result = result.filter((l) => l.sheetRef === sheetFilter);
    }

    if (showPrintedOnly === 'printed') {
      result = result.filter((l) => l.isPrinted);
    } else if (showPrintedOnly === 'unprinted') {
      result = result.filter((l) => !l.isPrinted);
    }

    return result;
  }, [labels, search, sheetFilter, showPrintedOnly]);

  // -----------------------------------------------------------------------
  // Print actions
  // -----------------------------------------------------------------------

  const handleBatchPrint = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setPrinting(true);
    try {
      const blob = await api.batchPrint(Array.from(selectedIds), template);
      // Create download link for the print PDF
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `labels-${template}-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      // Mark as printed
      await api.markPrinted(Array.from(selectedIds));
      setLabels((prev) =>
        prev.map((l) => (selectedIds.has(l.id) ? { ...l, isPrinted: true } : l))
      );
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Print failed');
    } finally {
      setPrinting(false);
    }
  }, [selectedIds, template, api]);

  const handleBrowserPrint = useCallback(() => {
    window.print();
  }, []);

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------

  const printedCount = labels.filter((l) => l.isPrinted).length;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!jobId) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950 text-gray-400">
        No job selected. Please select a job to view shop labels.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950" data-testid="loading">
        <div className="text-gray-400 animate-pulse">Loading labels…</div>
      </div>
    );
  }

  if (error && labels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-950 gap-4" data-testid="error">
        <div className="text-red-400">{error}</div>
        <button onClick={loadLabels} className="px-4 py-2 bg-gray-800 text-gray-200 rounded hover:bg-gray-700">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-100">Label Printing</h1>
            <p className="text-xs text-gray-500">
              {printedCount}/{labels.length} printed · {selectedIds.size} selected
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBrowserPrint}
              className="px-3 py-1.5 bg-gray-800 text-gray-200 rounded text-sm hover:bg-gray-700"
              data-testid="browser-print-btn"
            >
              Browser Print
            </button>
            <button
              onClick={handleBatchPrint}
              disabled={selectedIds.size === 0 || printing}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              data-testid="batch-print-btn"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-white">
                <path d="M4 6V1h8v5M4 12H2a1 1 0 01-1-1V7a1 1 0 011-1h12a1 1 0 011 1v4a1 1 0 01-1 1h-2" stroke="currentColor" strokeWidth="1.5" />
                <rect x="4" y="10" width="8" height="5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              {printing ? 'Printing…' : `Print ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`}
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-3 bg-gray-900/50 border-b border-gray-800 space-y-2">
        {/* Template selection */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Template:</span>
          <TemplateSelector value={template} onChange={setTemplate} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search labels…"
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 flex-1 min-w-[200px]"
            data-testid="search-input"
          />

          <select
            value={sheetFilter}
            onChange={(e) => setSheetFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200"
            data-testid="sheet-filter"
          >
            <option value="all">All Sheets</option>
            {sheets.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={showPrintedOnly}
            onChange={(e) => setShowPrintedOnly(e.target.value as 'all' | 'printed' | 'unprinted')}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200"
            data-testid="printed-filter"
          >
            <option value="all">All</option>
            <option value="printed">Printed</option>
            <option value="unprinted">Unprinted</option>
          </select>

          {/* Selection shortcuts */}
          <div className="flex gap-1 ml-auto">
            <button
              onClick={selectAll}
              className="px-2 py-1 text-xs bg-gray-800 text-gray-400 rounded hover:bg-gray-700"
              data-testid="select-all-btn"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              className="px-2 py-1 text-xs bg-gray-800 text-gray-400 rounded hover:bg-gray-700"
              data-testid="select-none-btn"
            >
              Select None
            </button>
            <button
              onClick={selectUnprinted}
              className="px-2 py-1 text-xs bg-gray-800 text-gray-400 rounded hover:bg-gray-700"
              data-testid="select-unprinted-btn"
            >
              Select Unprinted
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-950/50 border-b border-red-900 text-red-400 text-sm" data-testid="error-banner">
          {error}
        </div>
      )}

      {/* Labels grid */}
      <div className="flex-1 overflow-y-auto p-4" data-testid="labels-grid">
        {filteredLabels.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm" data-testid="empty-state">
            No labels match your filters
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredLabels.map((label) => (
              <LabelCard
                key={label.id}
                label={label}
                template={template}
                selected={selectedIds.has(label.id)}
                onSelect={toggleSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ShopLabelApp;
