import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { exportsService } from '@/services/exports';
import { useAppStore } from '@/store/useAppStore';
import { useOptimizerStore } from '@/store/useOptimizerStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ExportFormat {
  id: string;
  name: string;
  description: string;
  extension: string;
  category: 'job' | 'cutlist' | 'gcode';
  icon: string;
  hasOptions?: boolean;
}

interface ExportHistoryEntry {
  id: string;
  formatName: string;
  fileName: string;
  timestamp: number;
  jobName: string;
}

interface ExportOptions {
  pageSize?: string;
  orientation?: string;
  layers?: string[];
  includeHeaders?: boolean;
  delimiter?: string;
}

const STORAGE_KEY = 'cnc_export_history';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function loadHistory(): ExportHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: ExportHistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 50)));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

const FORMAT_ICONS: Record<string, string> = {
  csv: '📊',
  dxf: '📐',
  svg: '🖼️',
  pdf: '📄',
  xml: '📋',
  json: '🔧',
  gcode: '⚙️',
};

// ---------------------------------------------------------------------------
// Options Dialog
// ---------------------------------------------------------------------------
interface OptionsDialogProps {
  format: ExportFormat;
  options: ExportOptions;
  onChange: (opts: ExportOptions) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const OptionsDialog: React.FC<OptionsDialogProps> = ({
  format,
  options,
  onChange,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" data-testid="options-dialog">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">
          Export Options — {format.name}
        </h3>

        {format.extension === 'dxf' && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm text-gray-300">Layers</span>
              <input
                type="text"
                value={(options.layers ?? []).join(', ')}
                onChange={(e) =>
                  onChange({
                    ...options,
                    layers: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="e.g. cuts, labels, dimensions"
                className="mt-1 w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                data-testid="layers-input"
              />
            </label>
          </div>
        )}

        {format.extension === 'pdf' && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm text-gray-300">Page Size</span>
              <select
                value={options.pageSize ?? 'letter'}
                onChange={(e) => onChange({ ...options, pageSize: e.target.value })}
                className="mt-1 w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                data-testid="page-size-select"
              >
                <option value="letter">Letter</option>
                <option value="a4">A4</option>
                <option value="legal">Legal</option>
                <option value="tabloid">Tabloid</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm text-gray-300">Orientation</span>
              <select
                value={options.orientation ?? 'portrait'}
                onChange={(e) => onChange({ ...options, orientation: e.target.value })}
                className="mt-1 w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                data-testid="orientation-select"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>
          </div>
        )}

        {format.extension === 'csv' && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm text-gray-300">Delimiter</span>
              <select
                value={options.delimiter ?? ','}
                onChange={(e) => onChange({ ...options, delimiter: e.target.value })}
                className="mt-1 w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                data-testid="delimiter-select"
              >
                <option value=",">Comma (,)</option>
                <option value=";">Semicolon (;)</option>
                <option value="\t">Tab</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={options.includeHeaders ?? true}
                onChange={(e) => onChange({ ...options, includeHeaders: e.target.checked })}
                className="rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500"
                data-testid="include-headers-checkbox"
              />
              Include headers
            </label>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
            data-testid="confirm-export-btn"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const ExportCenter: React.FC = () => {
  const currentJob = useAppStore((s) => s.currentJob);
  const currentSheet = useOptimizerStore((s) => s.currentSheet);
  const [history, setHistory] = useState<ExportHistoryEntry[]>(loadHistory);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [optionsFormat, setOptionsFormat] = useState<ExportFormat | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({});
  const [showHistory, setShowHistory] = useState(false);

  // Persist history to localStorage whenever it changes
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  // Fetch export formats
  const {
    data: formats = [],
    isLoading: formatsLoading,
    error: formatsError,
  } = useQuery<ExportFormat[]>({
    queryKey: ['exportFormats'],
    queryFn: () => exportsService.getExportFormats() as Promise<ExportFormat[]>,
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async ({
      format,
      options,
    }: {
      format: ExportFormat;
      options?: ExportOptions;
    }) => {
      if (!currentJob) throw new Error('No job selected');

      let blob: Blob;
      const jobId = currentJob.id;

      switch (format.category) {
        case 'gcode':
          blob = await exportsService.exportGcode(currentSheet?.id ?? jobId);
          break;
        case 'cutlist':
          blob = await exportsService.exportCutlist(jobId, format.extension);
          break;
        case 'job':
        default:
          blob = await exportsService.exportJob(jobId, format.extension, options);
          break;
      }

      return { blob, format };
    },
    onSuccess: ({ blob, format }) => {
      const fileName = `${currentJob?.name ?? 'export'}_${Date.now()}.${format.extension}`;
      downloadBlob(blob, fileName);

      const entry: ExportHistoryEntry = {
        id: crypto.randomUUID?.() ?? String(Date.now()),
        formatName: format.name,
        fileName,
        timestamp: Date.now(),
        jobName: currentJob?.name ?? 'Unknown',
      };
      setHistory((prev) => [entry, ...prev]);
      setExportingId(null);
    },
    onError: () => {
      setExportingId(null);
    },
  });

  const handleExportClick = useCallback(
    (format: ExportFormat) => {
      if (format.hasOptions) {
        setOptionsFormat(format);
        setExportOptions({});
      } else {
        setExportingId(format.id);
        exportMutation.mutate({ format });
      }
    },
    [exportMutation],
  );

  const handleConfirmOptions = useCallback(() => {
    if (!optionsFormat) return;
    setExportingId(optionsFormat.id);
    exportMutation.mutate({ format: optionsFormat, options: exportOptions });
    setOptionsFormat(null);
  }, [optionsFormat, exportOptions, exportMutation]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (!currentJob) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900" data-testid="no-job-message">
        <div className="text-center p-8">
          <div className="text-5xl mb-4">📦</div>
          <h2 className="text-xl font-semibold text-white mb-2">No Job Selected</h2>
          <p className="text-gray-400">Please select a job to access the Export Center.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6" data-testid="export-center">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Export Center</h1>
          <p className="text-sm text-gray-400 mt-1">
            Job: <span className="text-cyan-400">{currentJob.name}</span>
          </p>
        </div>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="px-4 py-2 text-sm rounded bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors"
          data-testid="toggle-history-btn"
        >
          {showHistory ? 'Hide History' : 'Export History'}
        </button>
      </div>

      {/* Loading / Error */}
      {formatsLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="loading-skeleton">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-5 animate-pulse h-40 border border-gray-700" />
          ))}
        </div>
      )}

      {formatsError && (
        <div
          className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300"
          data-testid="error-message"
          role="alert"
        >
          Failed to load export formats. Please try again.
        </div>
      )}

      {/* Export mutation error */}
      {exportMutation.isError && (
        <div
          className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 mb-4"
          data-testid="export-error"
          role="alert"
        >
          Export failed: {(exportMutation.error as Error)?.message ?? 'Unknown error'}
        </div>
      )}

      {/* Format Grid */}
      {!formatsLoading && !formatsError && (
        <>
          {formats.length === 0 ? (
            <div className="text-center py-12 text-gray-500" data-testid="empty-formats">
              No export formats available.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="formats-grid">
              {formats.map((fmt) => {
                const isExporting = exportingId === fmt.id && exportMutation.isPending;
                return (
                  <div
                    key={fmt.id}
                    className="bg-gray-800 rounded-lg p-5 border border-gray-700 hover:border-cyan-600 transition-colors flex flex-col"
                    data-testid={`format-card-${fmt.id}`}
                  >
                    <div className="text-3xl mb-3">
                      {FORMAT_ICONS[fmt.extension] ?? fmt.icon ?? '📁'}
                    </div>
                    <h3 className="text-lg font-semibold text-white">{fmt.name}</h3>
                    <p className="text-sm text-gray-400 mt-1 flex-1">{fmt.description}</p>
                    <span className="inline-block mt-2 text-xs text-gray-500 uppercase tracking-wider">
                      {fmt.category}
                    </span>
                    <button
                      disabled={isExporting}
                      onClick={() => handleExportClick(fmt)}
                      className="mt-4 w-full px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-cyan-600 hover:bg-cyan-500 text-white"
                      data-testid={`export-btn-${fmt.id}`}
                    >
                      {isExporting ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg
                            className="animate-spin h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                            />
                          </svg>
                          Exporting…
                        </span>
                      ) : (
                        'Export'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* History Panel */}
      {showHistory && (
        <div className="mt-8 bg-gray-800 rounded-lg border border-gray-700 p-5" data-testid="history-panel">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Exports</h2>
            <button
              onClick={clearHistory}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
              data-testid="clear-history-btn"
            >
              Clear History
            </button>
          </div>
          {history.length === 0 ? (
            <p className="text-gray-500 text-sm" data-testid="empty-history">
              No exports yet.
            </p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto" data-testid="history-list">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between bg-gray-700/50 rounded px-4 py-2 text-sm"
                >
                  <div>
                    <span className="text-white font-medium">{entry.formatName}</span>
                    <span className="text-gray-400 ml-2">— {entry.fileName}</span>
                  </div>
                  <span className="text-gray-500 text-xs whitespace-nowrap ml-4">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Options Dialog */}
      {optionsFormat && (
        <OptionsDialog
          format={optionsFormat}
          options={exportOptions}
          onChange={setExportOptions}
          onConfirm={handleConfirmOptions}
          onCancel={() => setOptionsFormat(null)}
        />
      )}
    </div>
  );
};

export default ExportCenter;
