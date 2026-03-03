// ─────────────────────────────────────────────
//  FloorPlanEditor – main component
// ─────────────────────────────────────────────

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  MouseEvent,
  WheelEvent,
  DragEvent,
  KeyboardEvent,
} from 'react';

import {
  EditorTool,
  CabinetTemplate,
  Room,
  RoomDimensions,
  Point2D,
} from './types';

import { useFloorPlan } from './hooks';
import { useCanvasInteraction } from './hooks';
import { useWallEditor } from './hooks';
import {
  downloadRoomJSON,
  exportRoomJSON,
  importRoomJSON,
  formatMM,
  formatM2,
  computeRoomArea,
  validateRoom,
  CABINET_TEMPLATES,
} from './api';

import RoomCanvas from './components/RoomCanvas';
import ToolBar from './components/ToolBar';
import ZoomControls from './components/ZoomControls';
import CabinetPalette from './components/CabinetPalette';
import CabinetProperties from './components/CabinetProperties';
import WallProperties from './components/WallProperties';
import MeasurementLines from './components/MeasurementLines';

// ─────────────────────────────────────────────

interface FloorPlanEditorProps {
  initialRoom?: Room;
  onRoomChange?: (room: Room) => void;
  onExport?: (json: string) => void;
  /** read-only mode */
  readOnly?: boolean;
}

// ─────────────────────────────────────────────

const FloorPlanEditor: React.FC<FloorPlanEditorProps> = ({
  initialRoom,
  onRoomChange,
  onExport,
  readOnly = false,
}) => {
  // ── state ──────────────────────────────────
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [showMeasurements, setShowMeasurements] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [pendingTemplate, setPendingTemplate] = useState<CabinetTemplate | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportJSON, setExportJSON] = useState('');
  const [sidebarTab, setSidebarTab] = useState<'palette' | 'properties' | 'list'>('palette');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── floor plan hook ────────────────────────
  const fp = useFloorPlan(initialRoom);

  // ── canvas interaction hook ────────────────
  const ci = useCanvasInteraction(fp.room.gridSize, fp.room.walls);

  // ── wall editor hook ───────────────────────
  const we = useWallEditor(fp.addWall, ci.snapToGrid);

  // ── notify parent ──────────────────────────
  useEffect(() => {
    onRoomChange?.(fp.room);
  }, [fp.room, onRoomChange]);

  // ── keyboard shortcuts ─────────────────────
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      switch (e.key.toLowerCase()) {
        case 's': setActiveTool('select'); break;
        case 'w': if (!readOnly) setActiveTool('drawWall'); break;
        case 'c': if (!readOnly) setActiveTool('placeCabinet'); break;
        case 'o': if (!readOnly) setActiveTool('addOpening'); break;
        case 'm': setActiveTool('measure'); break;
        case 'h': setActiveTool('pan'); break;
        case 'escape':
          we.cancelWall();
          setPendingTemplate(null);
          fp.selectCabinet(null);
          fp.selectWall(null);
          break;
        case 'delete':
        case 'backspace':
          if (fp.selection.selectedCabinetId) fp.deleteCabinet(fp.selection.selectedCabinetId);
          if (fp.selection.selectedWallId) fp.deleteWall(fp.selection.selectedWallId);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fp, we, readOnly]);

  // ── canvas mouse events ────────────────────

  const handleMouseDown = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      if (readOnly) return;
      const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = ci.screenToWorld(sx, sy);

      if (activeTool === 'pan' || e.button === 1) {
        ci.startPan(sx, sy);
        return;
      }

      if (activeTool === 'drawWall') {
        const snap = ci.snapToGrid(world);
        we.startWall(snap.point);
        return;
      }

      if (activeTool === 'select') {
        // deselect on canvas click (individual item clicks call stopPropagation)
        fp.selectCabinet(null);
        fp.selectWall(null);
      }
    },
    [activeTool, ci, we, fp, readOnly]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = ci.screenToWorld(sx, sy);

      if (ci.isPanning) {
        ci.updatePan(sx, sy);
        return;
      }

      if (activeTool === 'drawWall' && we.drawState.isDrawing) {
        const snap = ci.snapToGrid(world);
        we.updateWallPreview(snap.point);
        return;
      }

      if (ci.dragState.isDragging) {
        const newPos = ci.updateDrag(sx, sy);
        if (newPos && ci.dragState.dragItem) {
          fp.moveCabinet(ci.dragState.dragItem.id, newPos);
        }
      }
    },
    [activeTool, ci, we, fp]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      if (ci.isPanning) {
        ci.endPan();
        return;
      }

      if (activeTool === 'drawWall' && we.drawState.isDrawing) {
        const wall = we.finishWall();
        if (wall) {
          setStatusMessage(`Wall added – ${formatMM(
            Math.hypot(wall.endPoint.x - wall.startPoint.x, wall.endPoint.y - wall.startPoint.y)
          )}`);
        }
        return;
      }

      if (ci.dragState.isDragging) {
        ci.endDrag();
      }
    },
    [activeTool, ci, we]
  );

  const handleWheel = useCallback(
    (e: WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
      ci.zoomAtPoint(-e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
    },
    [ci]
  );

  // ── drag-and-drop from palette ─────────────

  const handleCanvasDragOver = useCallback((e: DragEvent<SVGSVGElement>) => {
    e.preventDefault();
  }, []);

  const handleCanvasDrop = useCallback(
    (e: DragEvent<SVGSVGElement>) => {
      e.preventDefault();
      if (!pendingTemplate) return;
      const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = ci.screenToWorld(sx, sy);
      const snap = ci.snapToGrid(world);
      fp.placeCabinet(pendingTemplate, snap.point);
      setStatusMessage(`${pendingTemplate.name} placed`);
    },
    [pendingTemplate, ci, fp]
  );

  const handlePaletteDragStart = useCallback((template: CabinetTemplate) => {
    setPendingTemplate(template);
  }, []);

  const handlePaletteSelect = useCallback((template: CabinetTemplate) => {
    setPendingTemplate(template);
    if (!readOnly) setActiveTool('placeCabinet');
    setStatusMessage(`${template.name} selected – click canvas to place`);
    setSidebarTab('palette');
  }, [readOnly]);

  // ── wall / cabinet click ───────────────────

  const handleWallClick = useCallback(
    (wallId: string) => {
      if (readOnly) return;
      fp.selectWall(wallId);
      setSidebarTab('properties');
    },
    [fp, readOnly]
  );

  const handleCabinetClick = useCallback(
    (cabinetId: string) => {
      if (readOnly) return;
      fp.selectCabinet(cabinetId);
      setSidebarTab('properties');
    },
    [fp, readOnly]
  );

  // ── canvas click for placeCabinet tool ─────
  const handleCanvasClick = useCallback(
    (e: MouseEvent<SVGSVGElement>) => {
      if (activeTool !== 'placeCabinet' || !pendingTemplate || readOnly) return;
      const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = ci.screenToWorld(sx, sy);
      const snap = ci.snapToGrid(world);
      fp.placeCabinet(pendingTemplate, snap.point);
      setStatusMessage(`${pendingTemplate.name} placed`);
    },
    [activeTool, pendingTemplate, ci, fp, readOnly]
  );

  // ── export ─────────────────────────────────

  const handleExport = useCallback(() => {
    const validation = validateRoom(fp.room);
    if (!validation.isValid) {
      setStatusMessage(`Validation errors: ${validation.errors.map(e => e.message).join(', ')}`);
      return;
    }
    const json = exportRoomJSON(fp.room);
    setExportJSON(json);
    setExportModalOpen(true);
    onExport?.(json);
  }, [fp.room, onExport]);

  const handleDownload = useCallback(() => {
    downloadRoomJSON(fp.room);
  }, [fp.room]);

  // ── import ─────────────────────────────────

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const room = importRoomJSON(text);
        fp.setRoom(room);
        setStatusMessage(`Room "${room.name}" imported successfully`);
      } catch (err) {
        setStatusMessage(`Import failed: ${(err as Error).message}`);
      }
      e.target.value = '';
    },
    [fp]
  );

  // ── computed dimensions ────────────────────

  const dims = fp.computedDimensions;
  const area = computeRoomArea(fp.room.walls);

  // ─────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────

  return (
    <div
      data-testid="floor-plan-editor"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 600,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#f1f5f9',
        overflow: 'hidden',
      }}
    >
      {/* ── Top bar ── */}
      <div
        data-testid="top-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          flexShrink: 0,
        }}
      >
        {/* Room name */}
        <input
          data-testid="room-name-input"
          value={fp.room.name}
          onChange={e => fp.updateRoomName(e.target.value)}
          readOnly={readOnly}
          style={{
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: '#111827',
            width: 200,
          }}
          aria-label="Room name"
        />

        {/* Dirty indicator */}
        {fp.isDirty && (
          <span
            data-testid="dirty-indicator"
            style={{ fontSize: 11, color: '#f59e0b' }}
            title="Unsaved changes"
          >
            ●
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Dimension display */}
        <div data-testid="room-dimensions-display" style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6b7280' }}>
          <span>W: <strong>{formatMM(dims.width || fp.room.dimensions.width)}</strong></span>
          <span>D: <strong>{formatMM(dims.depth || fp.room.dimensions.depth)}</strong></span>
          <span>H: <strong>{formatMM(fp.room.dimensions.height)}</strong></span>
          {area > 0 && <span>Area: <strong>{formatM2(area)}</strong></span>}
        </div>

        <div style={{ flex: 1 }} />

        {/* View toggles */}
        <label style={toggleLabelStyle}>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={e => setShowGrid(e.target.checked)}
            data-testid="show-grid-toggle"
          />
          Grid
        </label>
        <label style={toggleLabelStyle}>
          <input
            type="checkbox"
            checked={showMeasurements}
            onChange={e => setShowMeasurements(e.target.checked)}
            data-testid="show-measurements-toggle"
          />
          Measurements
        </label>

        {/* Import/Export */}
        {!readOnly && (
          <>
            <button onClick={handleImportClick} style={topBtnStyle} data-testid="import-btn">
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              data-testid="file-input"
            />
            <button onClick={handleExport} style={{ ...topBtnStyle, background: '#2563eb', color: '#fff', borderColor: '#2563eb' }} data-testid="export-btn">
              Export JSON
            </button>
            <button onClick={handleDownload} style={topBtnStyle} data-testid="download-btn">
              Download
            </button>
          </>
        )}
      </div>

      {/* ── Main body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left: ToolBar ── */}
        {!readOnly && (
          <div style={{ padding: 8, flexShrink: 0 }}>
            <ToolBar activeTool={activeTool} onToolChange={setActiveTool} />
          </div>
        )}

        {/* ── Center: Canvas ── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }} data-testid="canvas-container">
          <RoomCanvas
            room={{ ...fp.room, walls: showGrid ? fp.room.walls : fp.room.walls }}
            transform={ci.transform}
            activeTool={activeTool}
            drawState={we.drawState}
            showMeasurements={showMeasurements}
            pendingTemplate={pendingTemplate}
            screenToWorld={ci.screenToWorld}
            worldToScreen={ci.worldToScreen}
            snapToGrid={ci.snapToGrid}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            onWallClick={handleWallClick}
            onCabinetClick={handleCabinetClick}
            onCanvasDrop={handleCanvasDrop}
            onCanvasDragOver={handleCanvasDragOver}
            selectedWallId={fp.selection.selectedWallId}
            selectedCabinetId={fp.selection.selectedCabinetId}
          />

          {/* Zoom controls overlay */}
          <div style={{ position: 'absolute', bottom: 16, right: 16 }}>
            <ZoomControls
              transform={ci.transform}
              onZoomIn={ci.zoomIn}
              onZoomOut={ci.zoomOut}
              onReset={ci.resetZoom}
            />
          </div>

          {/* Status bar */}
          {statusMessage && (
            <div
              data-testid="status-message"
              style={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.75)',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 12,
                pointerEvents: 'none',
              }}
            >
              {statusMessage}
            </div>
          )}

          {/* Wall preview length indicator */}
          {we.drawState.isDrawing && we.previewLength > 0 && (
            <div
              data-testid="wall-length-preview"
              style={{
                position: 'absolute',
                top: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#2563eb',
                color: '#fff',
                padding: '3px 10px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                pointerEvents: 'none',
              }}
            >
              {formatMM(we.previewLength)}
            </div>
          )}
        </div>

        {/* ── Right: Sidebar ── */}
        <div
          data-testid="sidebar"
          style={{
            width: 240,
            flexShrink: 0,
            background: '#fff',
            borderLeft: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Sidebar tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
            {(['palette', 'properties', 'list'] as const).map(tab => (
              <button
                key={tab}
                data-testid={`sidebar-tab-${tab}`}
                onClick={() => setSidebarTab(tab)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  border: 'none',
                  background: sidebarTab === tab ? '#eff6ff' : 'transparent',
                  color: sidebarTab === tab ? '#2563eb' : '#6b7280',
                  fontSize: 11,
                  fontWeight: sidebarTab === tab ? 600 : 400,
                  cursor: 'pointer',
                  borderBottom: sidebarTab === tab ? '2px solid #2563eb' : '2px solid transparent',
                  textTransform: 'capitalize',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {/* Cabinet palette */}
            {sidebarTab === 'palette' && (
              <CabinetPalette
                onDragStart={handlePaletteDragStart}
                onSelectTemplate={handlePaletteSelect}
              />
            )}

            {/* Properties panel */}
            {sidebarTab === 'properties' && (
              <>
                {fp.selectedWall && (
                  <WallProperties
                    wall={fp.selectedWall}
                    onUpdate={fp.updateWall}
                    onDelete={fp.deleteWall}
                    onAddOpening={fp.addOpening}
                    onDeleteOpening={fp.deleteOpening}
                  />
                )}
                {fp.selectedCabinet && (
                  <CabinetProperties
                    cabinet={fp.selectedCabinet}
                    onUpdate={fp.updateCabinet}
                    onDelete={fp.deleteCabinet}
                    onRotate={fp.rotateCabinet}
                    onAddCutout={fp.addApplianceCutout}
                    onRemoveCutout={fp.removeApplianceCutout}
                  />
                )}
                {!fp.selectedWall && !fp.selectedCabinet && (
                  <div style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', paddingTop: 24 }}>
                    Select a wall or cabinet to edit its properties
                  </div>
                )}
              </>
            )}

            {/* Cabinet list */}
            {sidebarTab === 'list' && (
              <div data-testid="cabinet-list">
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  Cabinets ({fp.room.placedCabinets.length})
                </div>
                {fp.room.placedCabinets.length === 0 && (
                  <div style={{ color: '#9ca3af', fontSize: 12 }}>No cabinets placed yet</div>
                )}
                {fp.room.placedCabinets.map(cabinet => (
                  <div
                    key={cabinet.id}
                    data-testid={`cabinet-list-item-${cabinet.id}`}
                    onClick={() => { fp.selectCabinet(cabinet.id); setSidebarTab('properties'); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '5px 6px',
                      borderRadius: 5,
                      marginBottom: 2,
                      cursor: 'pointer',
                      background: cabinet.isSelected ? '#eff6ff' : 'transparent',
                      border: cabinet.isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: cabinet.color,
                        flexShrink: 0,
                        border: '1px solid #d1d5db',
                      }}
                    />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cabinet.label}
                      </div>
                      <div style={{ fontSize: 10, color: '#6b7280' }}>
                        {cabinet.width}×{cabinet.depth} mm · {cabinet.rotation}°
                      </div>
                    </div>
                    <button
                      data-testid={`list-delete-cabinet-${cabinet.id}`}
                      onClick={e => { e.stopPropagation(); fp.deleteCabinet(cabinet.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 14, padding: '0 2px' }}
                      aria-label={`Remove ${cabinet.label}`}
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* Walls list */}
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginTop: 16, marginBottom: 8 }}>
                  Walls ({fp.room.walls.length})
                </div>
                {fp.room.walls.map(wall => (
                  <div
                    key={wall.id}
                    data-testid={`wall-list-item-${wall.id}`}
                    onClick={() => { fp.selectWall(wall.id); setSidebarTab('properties'); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 6px',
                      borderRadius: 5,
                      marginBottom: 2,
                      cursor: 'pointer',
                      background: fp.selection.selectedWallId === wall.id ? '#eff6ff' : 'transparent',
                      border: fp.selection.selectedWallId === wall.id ? '1px solid #bfdbfe' : '1px solid transparent',
                      fontSize: 11,
                      color: '#374151',
                    }}
                  >
                    <span style={{ flex: 1 }}>{wall.label || `Wall ${wall.id.slice(0, 6)}`}</span>
                    <span style={{ color: '#6b7280', flexShrink: 0 }}>
                      {formatMM(Math.hypot(
                        wall.endPoint.x - wall.startPoint.x,
                        wall.endPoint.y - wall.startPoint.y
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grid size control */}
          <div style={{ padding: '8px 12px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <label htmlFor="grid-size-input" style={{ color: '#6b7280', flexShrink: 0 }}>Grid</label>
            <input
              id="grid-size-input"
              data-testid="grid-size-input"
              type="number"
              min={10}
              max={1000}
              step={10}
              value={fp.room.gridSize}
              onChange={e => fp.updateGridSize(Number(e.target.value))}
              style={{ width: 60, padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 11 }}
            />
            <span style={{ color: '#9ca3af' }}>mm</span>
          </div>
        </div>
      </div>

      {/* ── Export Modal ── */}
      {exportModalOpen && (
        <div
          data-testid="export-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Export floor plan"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setExportModalOpen(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: 560,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Export Floor Plan</h2>
              <button
                data-testid="close-export-modal"
                onClick={() => setExportModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6b7280' }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <textarea
              data-testid="export-json-textarea"
              value={exportJSON}
              readOnly
              style={{
                flex: 1,
                minHeight: 300,
                fontFamily: 'monospace',
                fontSize: 11,
                border: '1px solid #d1d5db',
                borderRadius: 6,
                padding: 10,
                resize: 'vertical',
                color: '#374151',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                data-testid="copy-json-btn"
                onClick={() => navigator.clipboard?.writeText(exportJSON)}
                style={topBtnStyle}
              >
                Copy to Clipboard
              </button>
              <button
                data-testid="download-json-btn"
                onClick={handleDownload}
                style={{ ...topBtnStyle, background: '#2563eb', color: '#fff', borderColor: '#2563eb' }}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── shared styles ─────────────────────────────

const topBtnStyle: React.CSSProperties = {
  padding: '5px 12px',
  fontSize: 12,
  border: '1px solid #d1d5db',
  borderRadius: 6,
  cursor: 'pointer',
  background: '#fff',
  color: '#374151',
  fontWeight: 500,
};

const toggleLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 12,
  color: '#6b7280',
  cursor: 'pointer',
  userSelect: 'none',
};

export default FloorPlanEditor;
