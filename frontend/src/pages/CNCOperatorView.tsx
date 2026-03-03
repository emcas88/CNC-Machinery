import React, { useState, useMemo, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { labelsService } from '@/services/labels';
import { shopService } from '@/services/shop';
import { useOptimizerStore } from '@/store/optimizerStore';

/* ── types ── */
interface SheetPart {
  id: string;
  name: string;
  material: string;
  x: number;
  y: number;
  width: number;
  height: number;
  completed: boolean;
  grain?: string;
}

interface RemakeReason {
  partId: string;
  reason: string;
}

/* ═══════════════════════════════════════════ */
export default function CNCOperatorView() {
  const { sheets, currentSheet, setCurrentSheet } = useOptimizerStore();

  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [remakeDialog, setRemakeDialog] = useState<string | null>(null);
  const [remakeReason, setRemakeReason] = useState('');
  const [completedParts, setCompletedParts] = useState<Set<string>>(new Set());
  const [currentOperation, setCurrentOperation] = useState('Cutting');
  const [timeEstimate, setTimeEstimate] = useState('12:34');

  /* ── derived data ── */
  const currentSheetData = useMemo(
    () => sheets.find((s) => s.id === currentSheet),
    [sheets, currentSheet],
  );

  const parts = useMemo<SheetPart[]>(() => {
    if (!currentSheetData) return [];
    return ((currentSheetData as any).parts ?? []).map((p: any, idx: number) => ({
      id: p.id ?? `part-${idx}`,
      name: p.name ?? `Part ${idx + 1}`,
      material: p.material ?? 'Unknown',
      x: p.x ?? (idx % 4) * 200 + 20,
      y: p.y ?? Math.floor(idx / 4) * 120 + 20,
      width: p.width ?? 180,
      height: p.height ?? 100,
      completed: completedParts.has(p.id ?? `part-${idx}`),
      grain: p.grain,
    }));
  }, [currentSheetData, completedParts]);

  const currentSheetIndex = useMemo(
    () => sheets.findIndex((s) => s.id === currentSheet),
    [sheets, currentSheet],
  );

  const cutCount = parts.filter((p) => p.completed).length;
  const totalParts = parts.length;
  const partsRemaining = totalParts - cutCount;

  const selectedPart = parts.find((p) => p.id === selectedPartId);

  /* ── mutations ── */
  const printLabelsMutation = useMutation({
    mutationFn: () => {
      const partIds = parts.map((p) => p.id);
      return labelsService.generateLabels({
        sheetId: currentSheet,
        partIds,
      } as any);
    },
  });

  const printSingleLabelMutation = useMutation({
    mutationFn: (partId: string) =>
      shopService.printLabel(partId),
  });

  const remakeMutation = useMutation({
    mutationFn: ({ partId, reason }: RemakeReason) =>
      shopService.addToRemakeBin(partId, reason),
    onSuccess: () => {
      setRemakeDialog(null);
      setRemakeReason('');
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: (partId: string) => shopService.markPartComplete(partId),
    onSuccess: (_, partId) => {
      setCompletedParts((prev) => new Set([...prev, partId]));
    },
  });

  /* ── handlers ── */
  const handleNextSheet = useCallback(() => {
    if (currentSheetIndex < sheets.length - 1) {
      setCurrentSheet(sheets[currentSheetIndex + 1].id);
      setSelectedPartId(null);
      setCompletedParts(new Set());
    }
  }, [currentSheetIndex, sheets, setCurrentSheet]);

  const handlePrevSheet = useCallback(() => {
    if (currentSheetIndex > 0) {
      setCurrentSheet(sheets[currentSheetIndex - 1].id);
      setSelectedPartId(null);
      setCompletedParts(new Set());
    }
  }, [currentSheetIndex, sheets, setCurrentSheet]);

  const handleRemakeSubmit = () => {
    if (!remakeDialog || !remakeReason.trim()) return;
    remakeMutation.mutate({ partId: remakeDialog, reason: remakeReason });
  };

  const handlePartClick = (partId: string) => {
    setSelectedPartId(partId === selectedPartId ? null : partId);
  };

  /* ── no sheets ── */
  if (!sheets.length) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-400" data-testid="no-sheets">
        No sheets available. Run the optimizer first.
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* ── left: sheet list ── */}
      <aside className="w-56 bg-gray-800 border-r border-gray-700 flex flex-col">
        <h2 className="px-4 py-3 text-sm font-semibold text-cyan-400 border-b border-gray-700">Sheets</h2>
        <ul className="flex-1 overflow-y-auto" data-testid="sheet-list">
          {sheets.map((sheet, idx) => (
            <li
              key={sheet.id}
              onClick={() => {
                setCurrentSheet(sheet.id);
                setSelectedPartId(null);
              }}
              className={`px-4 py-3 cursor-pointer border-b border-gray-700 text-sm ${
                currentSheet === sheet.id ? 'bg-gray-700 text-cyan-300' : 'hover:bg-gray-750 text-gray-300'
              }`}
              data-testid={`sheet-item-${sheet.id}`}
            >
              Sheet {idx + 1}
              <div className="text-xs text-gray-500 mt-1">
                {((sheet as any).parts ?? []).length} parts
              </div>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── main ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* header with quick stats and nav */}
        <div className="px-6 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrevSheet}
              disabled={currentSheetIndex <= 0}
              className="px-3 py-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 text-sm"
              data-testid="prev-sheet-btn"
            >
              ← Prev
            </button>
            <div className="text-center">
              <h1 className="text-lg font-bold" data-testid="sheet-title">
                Sheet {currentSheetIndex + 1} of {sheets.length}
              </h1>
              <p className="text-xs text-gray-400">{currentSheetData?.id}</p>
            </div>
            <button
              onClick={handleNextSheet}
              disabled={currentSheetIndex >= sheets.length - 1}
              className="px-3 py-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40 text-sm"
              data-testid="next-sheet-btn"
            >
              Next →
            </button>
          </div>

          {/* quick stats */}
          <div className="flex gap-6 text-sm" data-testid="quick-stats">
            <div className="text-center">
              <div className="text-lg font-bold text-cyan-400" data-testid="stat-total-sheets">{sheets.length}</div>
              <div className="text-xs text-gray-400">Total Sheets</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white" data-testid="stat-current-sheet">{currentSheetIndex + 1}</div>
              <div className="text-xs text-gray-400">Current</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-400" data-testid="stat-cut">{cutCount}</div>
              <div className="text-xs text-gray-400">Cut</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-400" data-testid="stat-remaining">{partsRemaining}</div>
              <div className="text-xs text-gray-400">Remaining</div>
            </div>
          </div>
        </div>

        {/* toolbar */}
        <div className="px-6 py-2 bg-gray-800/50 border-b border-gray-700 flex items-center gap-2">
          <button
            onClick={() => printLabelsMutation.mutate()}
            disabled={printLabelsMutation.isPending || !parts.length}
            className="px-4 py-1.5 rounded bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 text-sm"
            data-testid="print-labels-btn"
          >
            {printLabelsMutation.isPending ? 'Printing…' : 'Print Labels'}
          </button>
          <button
            onClick={handleNextSheet}
            disabled={currentSheetIndex >= sheets.length - 1}
            className="px-4 py-1.5 rounded bg-green-700 text-white hover:bg-green-600 disabled:opacity-50 text-sm"
            data-testid="next-sheet-action-btn"
          >
            Next Sheet
          </button>
          <button
            onClick={() => selectedPartId && setRemakeDialog(selectedPartId)}
            disabled={!selectedPartId}
            className="px-4 py-1.5 rounded bg-red-700 text-white hover:bg-red-600 disabled:opacity-50 text-sm"
            data-testid="remake-btn"
          >
            Remake Part
          </button>
          {printLabelsMutation.isSuccess && <span className="text-green-400 text-xs" data-testid="print-success">Labels printed.</span>}
          {printLabelsMutation.isError && <span className="text-red-400 text-xs" data-testid="print-error">Print failed.</span>}
        </div>

        {/* sheet viewer + details panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* sheet viewer */}
          <div className="flex-1 p-6 overflow-auto">
            {parts.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500" data-testid="no-parts">
                No parts on this sheet.
              </div>
            ) : (
              <div className="relative bg-gray-950 rounded border border-gray-700" style={{ width: 900, height: 500 }} data-testid="sheet-viewer">
                {parts.map((part) => (
                  <div
                    key={part.id}
                    onClick={() => handlePartClick(part.id)}
                    className={`absolute border-2 rounded cursor-pointer flex items-center justify-center text-xs transition-colors ${
                      part.completed
                        ? 'bg-green-900/40 border-green-600 text-green-300'
                        : selectedPartId === part.id
                        ? 'bg-cyan-900/40 border-cyan-400 text-cyan-200'
                        : 'bg-gray-800/60 border-gray-600 text-gray-300 hover:border-gray-400'
                    }`}
                    style={{
                      left: part.x,
                      top: part.y,
                      width: part.width,
                      height: part.height,
                    }}
                    data-testid={`part-${part.id}`}
                  >
                    <div className="text-center p-1 overflow-hidden">
                      <div className="font-medium truncate">{part.name}</div>
                      <div className="text-[10px] opacity-70">{part.width}×{part.height}</div>
                      {part.completed && <div className="text-green-400 mt-0.5">✓</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* right: part details + machine status */}
          <aside className="w-72 border-l border-gray-700 bg-gray-800 flex flex-col overflow-y-auto">
            {/* machine status */}
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-cyan-400 mb-2">Machine Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Operation</span>
                  <span data-testid="machine-operation">{currentOperation}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Time Est.</span>
                  <span data-testid="machine-time">{timeEstimate}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                  <div
                    className="bg-cyan-500 h-2 rounded-full"
                    style={{ width: `${totalParts > 0 ? (cutCount / totalParts) * 100 : 0}%` }}
                    data-testid="sheet-progress-bar"
                  />
                </div>
                <p className="text-xs text-gray-500">{cutCount}/{totalParts} parts complete</p>
              </div>
            </div>

            {/* part details */}
            <div className="p-4 flex-1">
              <h3 className="text-sm font-semibold text-cyan-400 mb-2">Part Details</h3>
              {!selectedPart ? (
                <p className="text-gray-500 text-sm" data-testid="no-part-selected">Click a part on the sheet to view details.</p>
              ) : (
                <div className="space-y-3 text-sm" data-testid="part-details">
                  <div>
                    <label className="text-gray-400 text-xs">Name</label>
                    <p data-testid="detail-name">{selectedPart.name}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs">Material</label>
                    <p data-testid="detail-material">{selectedPart.material}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs">Dimensions</label>
                    <p data-testid="detail-dimensions">{selectedPart.width} × {selectedPart.height}mm</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs">Position</label>
                    <p data-testid="detail-position">X: {selectedPart.x}, Y: {selectedPart.y}</p>
                  </div>
                  {selectedPart.grain && (
                    <div>
                      <label className="text-gray-400 text-xs">Grain</label>
                      <p data-testid="detail-grain">{selectedPart.grain}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-gray-400 text-xs">Status</label>
                    <p data-testid="detail-status" className={selectedPart.completed ? 'text-green-400' : 'text-yellow-400'}>
                      {selectedPart.completed ? 'Completed' : 'Pending'}
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => markCompleteMutation.mutate(selectedPart.id)}
                      disabled={selectedPart.completed || markCompleteMutation.isPending}
                      className="flex-1 px-3 py-1.5 rounded bg-green-700 text-white hover:bg-green-600 disabled:opacity-50 text-xs"
                      data-testid="mark-complete-btn"
                    >
                      {markCompleteMutation.isPending ? 'Marking…' : 'Mark Complete'}
                    </button>
                    <button
                      onClick={() => printSingleLabelMutation.mutate(selectedPart.id)}
                      disabled={printSingleLabelMutation.isPending}
                      className="flex-1 px-3 py-1.5 rounded bg-cyan-700 text-white hover:bg-cyan-600 disabled:opacity-50 text-xs"
                      data-testid="print-single-label-btn"
                    >
                      Print Label
                    </button>
                  </div>
                  <button
                    onClick={() => setRemakeDialog(selectedPart.id)}
                    className="w-full px-3 py-1.5 rounded bg-red-700 text-white hover:bg-red-600 text-xs"
                    data-testid="remake-part-detail-btn"
                  >
                    Flag for Remake
                  </button>
                  {markCompleteMutation.isSuccess && <p className="text-green-400 text-xs" data-testid="mark-success">Part marked complete.</p>}
                  {markCompleteMutation.isError && <p className="text-red-400 text-xs" data-testid="mark-error">Failed to mark complete.</p>}
                  {printSingleLabelMutation.isSuccess && <p className="text-green-400 text-xs" data-testid="single-print-success">Label printed.</p>}
                  {remakeMutation.isSuccess && <p className="text-green-400 text-xs" data-testid="remake-success">Part added to remake bin.</p>}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* ── remake dialog ── */}
      {remakeDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" data-testid="remake-dialog">
          <div className="bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-2">Flag Part for Remake</h3>
            <p className="text-gray-400 text-sm mb-4">
              Part: {parts.find((p) => p.id === remakeDialog)?.name ?? remakeDialog}
            </p>
            <label className="block text-sm text-gray-400 mb-1">Reason</label>
            <textarea
              className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 h-24 resize-none"
              value={remakeReason}
              onChange={(e) => setRemakeReason(e.target.value)}
              placeholder="Describe the issue…"
              data-testid="remake-reason"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setRemakeDialog(null);
                  setRemakeReason('');
                }}
                className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 text-sm"
                data-testid="remake-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleRemakeSubmit}
                disabled={!remakeReason.trim() || remakeMutation.isPending}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-sm text-white disabled:opacity-50"
                data-testid="remake-submit"
              >
                {remakeMutation.isPending ? 'Submitting…' : 'Submit'}
              </button>
            </div>
            {remakeMutation.isError && <p className="text-red-400 text-sm mt-2" data-testid="remake-error">Failed to submit.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
