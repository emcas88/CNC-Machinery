import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { labelsService } from '@/services/labels';
import { shopService } from '@/services/shop';
import { useAppStore } from '@/store/useAppStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LabelTemplate {
  id: string;
  name: string;
  description: string;
  pageSize: string;
  orientation: 'portrait' | 'landscape';
  labelsPerPage: number;
  category: string;
}

interface PrintPreset {
  id: string;
  name: string;
  description: string;
  templateId: string;
  itemCount: number;
  pageSize: string;
  orientation: 'portrait' | 'landscape';
  labelsPerPage: number;
}

interface PrintSettings {
  copies: number;
  printer: string;
  labelWidth: number;
  labelHeight: number;
}

const SETTINGS_STORAGE_KEY = 'cnc_print_settings';
const DEFAULT_SETTINGS: PrintSettings = {
  copies: 1,
  printer: '',
  labelWidth: 4,
  labelHeight: 2,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function loadSettings(): PrintSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: PrintSettings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function calcPageCount(itemCount: number, copies: number, labelsPerPage: number): number {
  if (labelsPerPage <= 0) return 0;
  return Math.ceil((itemCount * copies) / labelsPerPage);
}

const PRESET_ICONS: Record<string, string> = {
  cutlist: '\u2702\uFE0F',
  part: '\uD83C\uDFF7\uFE0F',
  sheet: '\uD83D\uDCCB',
  box: '\uD83D\uDCE6',
  shipping: '\uD83D\uDE9A',
};

// ---------------------------------------------------------------------------
// Preview Panel
// ---------------------------------------------------------------------------
interface PreviewPanelProps {
  preset: PrintPreset | null;
  settings: PrintSettings;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ preset, settings }) => {
  if (!preset) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 flex items-center justify-center h-64" data-testid="preview-empty">
        <p className="text-gray-500 text-sm">Select a preset to preview label layout</p>
      </div>
    );
  }

  const cols = preset.orientation === 'landscape' ? 3 : 2;
  const rows = Math.ceil(preset.labelsPerPage / cols);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6" data-testid="preview-panel">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Label Preview \u2014 {preset.name}</h3>
      <div
        className={`border border-gray-600 rounded bg-white/5 p-3 ${
          preset.orientation === 'landscape' ? 'aspect-[11/8.5]' : 'aspect-[8.5/11]'
        } max-h-64 overflow-hidden`}
      >
        <div
          className="grid gap-1 h-full"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
          }}
        >
          {Array.from({ length: preset.labelsPerPage }).map((_, i) => (
            <div
              key={i}
              className="border border-dashed border-gray-600 rounded flex items-center justify-center text-xs text-gray-500"
            >
              {settings.labelWidth}" \u00D7 {settings.labelHeight}"
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex gap-4 text-xs text-gray-400">
        <span>Page: {preset.pageSize}</span>
        <span>{preset.orientation}</span>
        <span>{preset.labelsPerPage} labels/page</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Settings Panel
// ---------------------------------------------------------------------------
interface SettingsPanelProps {
  settings: PrintSettings;
  onChange: (s: PrintSettings) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onChange }) => {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-5" data-testid="settings-panel">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Print Settings</h3>
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-gray-400">Printer</span>
          <input
            type="text"
            value={settings.printer}
            onChange={(e) => onChange({ ...settings, printer: e.target.value })}
            placeholder="Default printer"
            className="mt-1 w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
            data-testid="printer-input"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-400">Copies per label</span>
          <input
            type="number"
            min={1}
            max={100}
            value={settings.copies}
            onChange={(e) =>
              onChange({ ...settings, copies: Math.max(1, parseInt(e.target.value) || 1) })
            }
            className="mt-1 w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
            data-testid="copies-input"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-gray-400">Label Width (in)</span>
            <input
              type="number"
              min={1}
              max={12}
              step={0.25}
              value={settings.labelWidth}
              onChange={(e) =>
                onChange({ ...settings, labelWidth: parseFloat(e.target.value) || 4 })
              }
              className="mt-1 w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
              data-testid="label-width-input"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-400">Label Height (in)</span>
            <input
              type="number"
              min={0.5}
              max={12}
              step={0.25}
              value={settings.labelHeight}
              onChange={(e) =>
                onChange({ ...settings, labelHeight: parseFloat(e.target.value) || 2 })
              }
              className="mt-1 w-full rounded bg-gray-700 border border-gray-600 px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
              data-testid="label-height-input"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const MultiPrintEditor: React.FC = () => {
  const currentJob = useAppStore((s) => s.currentJob);
  const queryClient = useQueryClient();

  const [settings, setSettings] = useState<PrintSettings>(loadSettings);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  // Persist settings
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Fetch label templates
  const {
    data: templates = [],
    isLoading: templatesLoading,
    error: templatesError,
  } = useQuery<LabelTemplate[]>({
    queryKey: ['labelTemplates'],
    queryFn: () => labelsService.getTemplates(),
  });

  // Build presets from templates
  const presets: PrintPreset[] = useMemo(() => {
    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      templateId: t.id,
      itemCount: 0, // populated per-preset logic below
      pageSize: t.pageSize,
      orientation: t.orientation,
      labelsPerPage: t.labelsPerPage,
    }));
  }, [templates]);

  const selectedPreset = useMemo(
    () => presets.find((p) => p.id === selectedPresetId) ?? null,
    [presets, selectedPresetId],
  );

  // Print single preset
  const printMutation = useMutation({
    mutationFn: async (preset: PrintPreset) => {
      const labels = await labelsService.generateLabels({
        templateId: preset.templateId,
        jobId: currentJob!.id,
        copies: settings.copies,
      });
      return labelsService.printLabels({
        labels,
        printer: settings.printer,
      });
    },
    onMutate: (preset) => setPrintingId(preset.id),
    onSettled: () => setPrintingId(null),
  });

  // Print all
  const printAllMutation = useMutation({
    mutationFn: async () => {
      const results = [];
      for (const preset of presets) {
        const labels = await labelsService.generateLabels({
          templateId: preset.templateId,
          jobId: currentJob!.id,
          copies: settings.copies,
        });
        const result = await labelsService.printLabels({
          labels,
          printer: settings.printer,
        });
        results.push(result);
      }
      return results;
    },
  });

  const handlePrint = useCallback(
    (preset: PrintPreset) => {
      printMutation.mutate(preset);
    },
    [printMutation],
  );

  const handlePrintAll = useCallback(() => {
    printAllMutation.mutate();
  }, [printAllMutation]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (!currentJob) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900" data-testid="no-job-message">
        <div className="text-center p-8">
          <div className="text-5xl mb-4">\uD83D\uDDA8\uFE0F</div>
          <h2 className="text-xl font-semibold text-white mb-2">No Job Selected</h2>
          <p className="text-gray-400">Select a job to use the Multi-Print Editor.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6" data-testid="multi-print-editor">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Multi-Print Editor</h1>
          <p className="text-sm text-gray-400 mt-1">
            Job: <span className="text-cyan-400">{currentJob.name}</span>
          </p>
        </div>
        <button
          onClick={handlePrintAll}
          disabled={printAllMutation.isPending || presets.length === 0}
          className="px-5 py-2.5 rounded text-sm font-medium bg-cyan-600 text-white hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="print-all-btn"
        >
          {printAllMutation.isPending ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Printing All\u2026
            </span>
          ) : (
            'Print All'
          )}
        </button>
      </div>

      {/* Mutation Errors */}
      {printMutation.isError && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm mb-4" data-testid="print-error" role="alert">
          Print failed: {(printMutation.error as Error)?.message ?? 'Unknown error'}
        </div>
      )}
      {printAllMutation.isError && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm mb-4" data-testid="print-all-error" role="alert">
          Batch print failed: {(printAllMutation.error as Error)?.message ?? 'Unknown error'}
        </div>
      )}

      {/* Success feedback */}
      {printMutation.isSuccess && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-green-300 text-sm mb-4" data-testid="print-success">
          Print job sent successfully!
        </div>
      )}
      {printAllMutation.isSuccess && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-green-300 text-sm mb-4" data-testid="print-all-success">
          All print jobs sent successfully!
        </div>
      )}

      {/* Loading */}
      {templatesLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-testid="loading-skeleton">
          <div className="lg:col-span-2 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-gray-800 rounded-lg h-24 animate-pulse border border-gray-700" />
            ))}
          </div>
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg h-64 animate-pulse border border-gray-700" />
            <div className="bg-gray-800 rounded-lg h-48 animate-pulse border border-gray-700" />
          </div>
        </div>
      )}

      {/* Error */}
      {templatesError && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300" data-testid="error-message" role="alert">
          Failed to load label templates.
        </div>
      )}

      {/* Main Content */}
      {!templatesLoading && !templatesError && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Presets List */}
          <div className="lg:col-span-2">
            {presets.length === 0 ? (
              <div className="text-center py-12 text-gray-500" data-testid="empty-presets">
                No print presets available.
              </div>
            ) : (
              <div className="space-y-3" data-testid="presets-list">
                {presets.map((preset) => {
                  const pageCount = calcPageCount(
                    preset.itemCount || 1,
                    settings.copies,
                    preset.labelsPerPage,
                  );
                  const isPrinting = printingId === preset.id && printMutation.isPending;
                  const isSelected = selectedPresetId === preset.id;

                  return (
                    <div
                      key={preset.id}
                      className={`bg-gray-800 border rounded-lg p-4 cursor-pointer transition-colors ${
                        isSelected ? 'border-cyan-500' : 'border-gray-700 hover:border-gray-600'
                      }`}
                      onClick={() => setSelectedPresetId(preset.id)}
                      data-testid={`preset-card-${preset.id}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl flex-shrink-0">
                            {PRESET_ICONS[preset.name.split(' ')[0].toLowerCase()] ?? '\uD83C\uDFF7\uFE0F'}
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-white font-medium truncate">{preset.name}</h3>
                            <p className="text-sm text-gray-400 truncate">{preset.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right hidden sm:block">
                            <div className="text-xs text-gray-400">
                              {preset.pageSize} \u2022 {preset.orientation}
                            </div>
                            <div className="text-xs text-gray-500">
                              {pageCount} page{pageCount !== 1 ? 's' : ''} \u2022 {settings.copies} cop{settings.copies !== 1 ? 'ies' : 'y'}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrint(preset);
                            }}
                            disabled={isPrinting}
                            className="px-4 py-2 rounded text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            data-testid={`print-btn-${preset.id}`}
                          >
                            {isPrinting ? 'Printing\u2026' : 'Print'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Sidebar: Preview + Settings */}
          <div className="space-y-4">
            <PreviewPanel preset={selectedPreset} settings={settings} />
            <SettingsPanel settings={settings} onChange={setSettings} />
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiPrintEditor;
