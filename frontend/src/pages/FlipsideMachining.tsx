import React, { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { gcodeService } from '@/services/gcode';
import { useOptimizerStore } from '@/store/optimizerStore';

/* ── types ── */
interface FlipsideSettings {
  zDepth: number;
  feedRate: number;
  spindleSpeed: number;
  tool: string;
}

interface FlipsideOperation {
  id: string;
  sheetId: string;
  partId: string;
  partName: string;
  operationType: string;
  needsFlipside: boolean;
  generated: boolean;
}

const TOOL_OPTIONS = [
  { value: 'flat_6mm', label: '6mm Flat End Mill' },
  { value: 'flat_8mm', label: '8mm Flat End Mill' },
  { value: 'flat_12mm', label: '12mm Flat End Mill' },
  { value: 'ball_6mm', label: '6mm Ball Nose' },
  { value: 'vbit_90', label: '90° V-Bit' },
];

/* ═══════════════════════════════════════════ */
export default function FlipsideMachining() {
  const { sheets: sheetsMap, currentRunId, currentSheet, setCurrentSheet, settings: optimizerSettings } = useOptimizerStore();
  const sheets = sheetsMap[currentRunId ?? ''] ?? [];

  const [flipsideSettings, setFlipsideSettings] = useState<FlipsideSettings>({
    zDepth: -3,
    feedRate: 3000,
    spindleSpeed: 18000,
    tool: 'flat_6mm',
  });

  const [generatedSheets, setGeneratedSheets] = useState<Set<string>>(new Set());
  const [previewGcode, setPreviewGcode] = useState<string | null>(null);
  const [simulationData, setSimulationData] = useState<any>(null);

  /* ── derived data ── */
  const currentSheetData = useMemo(
    () => sheets.find((s) => s.id === currentSheet),
    [sheets, currentSheet],
  );

  const flipsideOperations = useMemo<FlipsideOperation[]>(() => {
    if (!currentSheetData) return [];
    return ((currentSheetData as any).parts ?? []).map((part: any, idx: number) => ({
      id: `op-${currentSheetData.id}-${idx}`,
      sheetId: currentSheetData.id,
      partId: part.id ?? `part-${idx}`,
      partName: part.name ?? `Part ${idx + 1}`,
      operationType: part.flipsideOp ?? 'drilling',
      needsFlipside: part.needsFlipside ?? true,
      generated: generatedSheets.has(currentSheetData.id),
    }));
  }, [currentSheetData, generatedSheets]);

  const flipsideOpsNeeded = flipsideOperations.filter((o) => o.needsFlipside);

  /* ── mutations ── */
  const generateMutation = useMutation({
    mutationFn: () =>
      gcodeService.generate({
        sheetId: currentSheet,
        mode: 'flipside',
        settings: {
          zDepth: flipsideSettings.zDepth,
          feedRate: flipsideSettings.feedRate,
          spindleSpeed: flipsideSettings.spindleSpeed,
          tool: flipsideSettings.tool,
        },
      } as any),
    onSuccess: (data: any) => {
      setGeneratedSheets((prev) => new Set([...prev, currentSheet!]));
      setPreviewGcode(data?.gcode ?? null);
    },
  });

  const simulateMutation = useMutation({
    mutationFn: () =>
      gcodeService.simulate({
        sheetId: currentSheet,
        gcode: previewGcode,
      } as any),
    onSuccess: (data: any) => {
      setSimulationData(data);
    },
  });

  /* ── handlers ── */
  const updateSetting = <K extends keyof FlipsideSettings>(key: K, value: FlipsideSettings[K]) => {
    setFlipsideSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerate = () => {
    if (!currentSheet) return;
    generateMutation.mutate();
  };

  const handlePreview = () => {
    if (!currentSheet || !previewGcode) return;
    simulateMutation.mutate();
  };

  /* ── no sheets ── */
  if (!sheets.length) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-400" data-testid="no-sheets">
        No sheets available. Run the optimizer first to generate sheet layouts.
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* ── left: sheet selector ── */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <h2 className="px-4 py-3 text-sm font-semibold text-cyan-400 border-b border-gray-700">Sheet Selector</h2>
        <ul className="flex-1 overflow-y-auto" data-testid="sheet-list">
          {sheets.map((sheet, idx) => (
            <li
              key={sheet.id}
              onClick={() => setCurrentSheet(sheet.id)}
              className={`px-4 py-3 cursor-pointer border-b border-gray-700 ${
                currentSheet === sheet.id ? 'bg-gray-700 text-cyan-300' : 'hover:bg-gray-750 text-gray-300'
              }`}
              data-testid={`sheet-item-${sheet.id}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Sheet {idx + 1}</span>
                {generatedSheets.has(sheet.id) ? (
                  <span className="text-xs px-2 py-0.5 rounded bg-green-700 text-green-200" data-testid={`status-generated-${sheet.id}`}>Generated</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded bg-yellow-700 text-yellow-200" data-testid={`status-pending-${sheet.id}`}>Pending</span>
                )}
              </div>
              {/* thumbnail placeholder */}
              <div className="mt-2 h-16 bg-gray-900 rounded border border-gray-600 flex items-center justify-center text-xs text-gray-500">
                {(sheet as any).width ?? 2440} × {(sheet as any).height ?? 1220}mm
              </div>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── main content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* header */}
        <div className="px-6 py-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Flipside Machining</h1>
            <p className="text-xs text-gray-400 mt-1">
              {currentSheetData
                ? `Sheet: ${currentSheetData.id} | ${flipsideOpsNeeded.length} flipside operations`
                : 'Select a sheet'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={!currentSheet || generateMutation.isPending}
              className="px-4 py-2 rounded bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 text-sm"
              data-testid="generate-btn"
            >
              {generateMutation.isPending ? 'Generating…' : 'Generate Flipside G-Code'}
            </button>
            <button
              onClick={handlePreview}
              disabled={!previewGcode || simulateMutation.isPending}
              className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 text-sm"
              data-testid="preview-btn"
            >
              {simulateMutation.isPending ? 'Simulating…' : 'Preview Flipside'}
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* operations list + preview */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* operations table */}
            <h3 className="text-sm font-semibold text-cyan-400 mb-3">Flipside Operations</h3>
            {flipsideOpsNeeded.length === 0 ? (
              <div className="text-gray-500 text-sm py-4" data-testid="no-operations">
                No flipside operations found for this sheet.
              </div>
            ) : (
              <table className="w-full text-sm mb-6" data-testid="operations-table">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400 text-left">
                    <th className="pb-2">Part</th>
                    <th className="pb-2">Operation</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {flipsideOpsNeeded.map((op) => (
                    <tr key={op.id} className="border-b border-gray-700/50">
                      <td className="py-2 text-gray-300">{op.partName}</td>
                      <td className="py-2 capitalize text-gray-400">{op.operationType}</td>
                      <td className="py-2">
                        {op.generated ? (
                          <span className="text-green-400 text-xs" data-testid={`op-done-${op.id}`}>✓ Generated</span>
                        ) : (
                          <span className="text-yellow-400 text-xs" data-testid={`op-pending-${op.id}`}>Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* simulation preview area */}
            {simulationData && (
              <div className="mt-4" data-testid="simulation-view">
                <h3 className="text-sm font-semibold text-cyan-400 mb-3">Toolpath Preview</h3>
                <div className="bg-gray-950 rounded border border-gray-700 h-64 flex items-center justify-center text-gray-500 text-sm">
                  <pre className="text-xs text-gray-400 max-h-full overflow-auto p-4">
                    {typeof simulationData === 'string'
                      ? simulationData
                      : JSON.stringify(simulationData, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* G-code preview */}
            {previewGcode && !simulationData && (
              <div className="mt-4" data-testid="gcode-preview">
                <h3 className="text-sm font-semibold text-cyan-400 mb-3">Generated G-Code</h3>
                <pre className="bg-gray-950 rounded border border-gray-700 p-4 text-xs text-gray-400 max-h-64 overflow-auto">
                  {previewGcode}
                </pre>
              </div>
            )}

            {/* mutation feedback */}
            {generateMutation.isError && (
              <p className="text-red-400 text-sm mt-4" data-testid="generate-error">
                Failed to generate flipside G-code. {(generateMutation.error as Error)?.message}
              </p>
            )}
            {generateMutation.isSuccess && (
              <p className="text-green-400 text-sm mt-4" data-testid="generate-success">
                Flipside G-code generated successfully.
              </p>
            )}
            {simulateMutation.isError && (
              <p className="text-red-400 text-sm mt-4" data-testid="simulate-error">
                Simulation failed. {(simulateMutation.error as Error)?.message}
              </p>
            )}
          </div>

          {/* settings panel */}
          <aside className="w-72 border-l border-gray-700 p-6 overflow-y-auto bg-gray-800">
            <h3 className="text-sm font-semibold text-cyan-400 mb-4">Flipside Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Z Depth (mm)</label>
                <input
                  type="number"
                  step="0.5"
                  className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  value={flipsideSettings.zDepth}
                  onChange={(e) => updateSetting('zDepth', parseFloat(e.target.value) || 0)}
                  data-testid="input-zDepth"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Feed Rate (mm/min)</label>
                <input
                  type="number"
                  step="100"
                  min="100"
                  className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  value={flipsideSettings.feedRate}
                  onChange={(e) => updateSetting('feedRate', parseInt(e.target.value, 10) || 0)}
                  data-testid="input-feedRate"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Spindle Speed (RPM)</label>
                <input
                  type="number"
                  step="1000"
                  min="1000"
                  className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  value={flipsideSettings.spindleSpeed}
                  onChange={(e) => updateSetting('spindleSpeed', parseInt(e.target.value, 10) || 0)}
                  data-testid="input-spindleSpeed"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Tool Selection</label>
                <select
                  className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  value={flipsideSettings.tool}
                  onChange={(e) => updateSetting('tool', e.target.value)}
                  data-testid="input-tool"
                >
                  {TOOL_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* quick stats */}
            <div className="mt-6 pt-4 border-t border-gray-700">
              <h4 className="text-xs font-semibold text-gray-400 mb-2">Summary</h4>
              <div className="space-y-2 text-xs text-gray-400">
                <div className="flex justify-between">
                  <span>Total Sheets</span>
                  <span className="text-white" data-testid="stat-total-sheets">{sheets.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Generated</span>
                  <span className="text-green-400" data-testid="stat-generated">{generatedSheets.size}</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining</span>
                  <span className="text-yellow-400" data-testid="stat-remaining">{sheets.length - generatedSheets.size}</span>
                </div>
                <div className="flex justify-between">
                  <span>Flipside Ops (this sheet)</span>
                  <span className="text-white" data-testid="stat-ops">{flipsideOpsNeeded.length}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
