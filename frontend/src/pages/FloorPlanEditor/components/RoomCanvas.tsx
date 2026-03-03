// ─────────────────────────────────────────────
//  RoomCanvas – SVG-based floor plan canvas
// ─────────────────────────────────────────────

import React, { useCallback, useRef, MouseEvent, WheelEvent, DragEvent } from 'react';
import {
  Room,
  Wall,
  PlacedCabinet,
  ViewTransform,
  EditorTool,
  WallDrawState,
  CabinetTemplate,
  Point2D,
  SnapResult,
} from '../types';
import MeasurementLines from './MeasurementLines';
import { wallLength, wallAngleDeg, formatMM } from '../api';

interface RoomCanvasProps {
  room: Room;
  transform: ViewTransform;
  activeTool: EditorTool;
  drawState: WallDrawState;
  showMeasurements: boolean;
  pendingTemplate: CabinetTemplate | null;
  screenToWorld: (x: number, y: number) => Point2D;
  worldToScreen: (x: number, y: number) => Point2D;
  snapToGrid: (p: Point2D) => SnapResult;
  onMouseDown: (e: MouseEvent<SVGSVGElement>) => void;
  onMouseMove: (e: MouseEvent<SVGSVGElement>) => void;
  onMouseUp: (e: MouseEvent<SVGSVGElement>) => void;
  onWheel: (e: WheelEvent<SVGSVGElement>) => void;
  onWallClick: (wallId: string) => void;
  onCabinetClick: (cabinetId: string) => void;
  onCanvasDrop: (e: DragEvent<SVGSVGElement>) => void;
  onCanvasDragOver: (e: DragEvent<SVGSVGElement>) => void;
  selectedWallId: string | null;
  selectedCabinetId: string | null;
}

const GRID_LINE_COLOR = '#e5e7eb';
const WALL_COLOR = '#374151';
const WALL_SELECTED_COLOR = '#2563eb';
const CABINET_STROKE = '#4b5563';
const OPENING_COLOR = '#ffffff';
const DOOR_SWING_COLOR = '#6b7280';
const PREVIEW_WALL_COLOR = '#93c5fd';

const RoomCanvas: React.FC<RoomCanvasProps> = ({
  room,
  transform,
  activeTool,
  drawState,
  showMeasurements,
  pendingTemplate,
  screenToWorld,
  worldToScreen,
  snapToGrid,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onWheel,
  onWallClick,
  onCabinetClick,
  onCanvasDrop,
  onCanvasDragOver,
  selectedWallId,
  selectedCabinetId,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // ─── cursor ───────────────────────────────
  const cursorMap: Record<EditorTool, string> = {
    select: 'default',
    drawWall: 'crosshair',
    placeCabinet: 'copy',
    addOpening: 'cell',
    measure: 'crosshair',
    pan: 'grab',
  };

  // ─── helpers ──────────────────────────────
  const toSX = (x: number) => x * transform.scale + transform.offsetX;
  const toSY = (y: number) => y * transform.scale + transform.offsetY;
  const sc = transform.scale;

  // ─── grid ─────────────────────────────────
  const renderGrid = () => {
    const gs = room.gridSize * sc;
    if (gs < 4) return null;

    const svgEl = svgRef.current;
    const vw = svgEl?.clientWidth ?? 800;
    const vh = svgEl?.clientHeight ?? 600;

    const startX = ((transform.offsetX % gs) + gs) % gs;
    const startY = ((transform.offsetY % gs) + gs) % gs;

    const lines: React.ReactNode[] = [];
    for (let x = startX; x < vw; x += gs) {
      lines.push(
        <line key={`v${x}`} x1={x} y1={0} x2={x} y2={vh}
          stroke={GRID_LINE_COLOR} strokeWidth={0.5} />
      );
    }
    for (let y = startY; y < vh; y += gs) {
      lines.push(
        <line key={`h${y}`} x1={0} y1={y} x2={vw} y2={y}
          stroke={GRID_LINE_COLOR} strokeWidth={0.5} />
      );
    }
    return <g data-testid="canvas-grid">{lines}</g>;
  };

  // ─── walls ────────────────────────────────
  const renderWall = (wall: Wall) => {
    const x1 = toSX(wall.startPoint.x);
    const y1 = toSY(wall.startPoint.y);
    const x2 = toSX(wall.endPoint.x);
    const y2 = toSY(wall.endPoint.y);
    const thickness = wall.thickness * sc;
    const isSelected = wall.id === selectedWallId;
    const len = wallLength(wall);
    const angle = wallAngleDeg(wall);
    const angleRad = (angle * Math.PI) / 180;
    const perpX = -Math.sin(angleRad) * (thickness / 2);
    const perpY = Math.cos(angleRad) * (thickness / 2);

    // Four corners of wall polygon
    const pts = [
      `${x1 - perpX},${y1 - perpY}`,
      `${x2 - perpX},${y2 - perpY}`,
      `${x2 + perpX},${y2 + perpY}`,
      `${x1 + perpX},${y1 + perpY}`,
    ].join(' ');

    return (
      <g
        key={wall.id}
        data-testid={`wall-${wall.id}`}
        onClick={e => { e.stopPropagation(); onWallClick(wall.id); }}
        style={{ cursor: 'pointer' }}
      >
        <polygon
          points={pts}
          fill={isSelected ? '#dbeafe' : WALL_COLOR}
          stroke={isSelected ? WALL_SELECTED_COLOR : WALL_COLOR}
          strokeWidth={isSelected ? 2 : 1}
        />
        {/* End-cap dots */}
        <circle cx={x1} cy={y1} r={3} fill={isSelected ? WALL_SELECTED_COLOR : '#9ca3af'} />
        <circle cx={x2} cy={y2} r={3} fill={isSelected ? WALL_SELECTED_COLOR : '#9ca3af'} />

        {/* Wall openings */}
        {wall.openings.map(opening => {
          const ox = x1 + (x2 - x1) * opening.position;
          const oy = y1 + (y2 - y1) * opening.position;
          const ow = opening.width * sc;
          const hOw = ow / 2;

          return (
            <g key={opening.id} data-testid={`opening-${opening.id}`}>
              {/* Gap in wall */}
              <rect
                x={ox - hOw - perpX}
                y={oy - hOw - perpY}
                width={ow + thickness}
                height={ow + thickness}
                fill="transparent"
                stroke="none"
              />
              <line
                x1={ox - Math.cos(angleRad) * hOw + perpX}
                y1={oy - Math.sin(angleRad) * hOw + perpY}
                x2={ox + Math.cos(angleRad) * hOw + perpX}
                y2={oy + Math.sin(angleRad) * hOw + perpY}
                stroke={OPENING_COLOR}
                strokeWidth={thickness}
              />
              {/* Door swing arc */}
              {opening.type === 'door' && (
                <path
                  d={`M ${ox - Math.cos(angleRad) * hOw} ${oy - Math.sin(angleRad) * hOw}
                      A ${ow} ${ow} 0 0 1 ${ox - Math.cos(angleRad) * hOw + Math.sin(angleRad) * ow} ${oy - Math.sin(angleRad) * hOw - Math.cos(angleRad) * ow}`}
                  stroke={DOOR_SWING_COLOR}
                  strokeWidth={1}
                  fill="none"
                  strokeDasharray="3 2"
                />
              )}
            </g>
          );
        })}
      </g>
    );
  };

  // ─── cabinets ─────────────────────────────
  const renderCabinet = (cabinet: PlacedCabinet) => {
    const sx = toSX(cabinet.position.x);
    const sy = toSY(cabinet.position.y);
    const sw = cabinet.width * sc;
    const sd = cabinet.depth * sc;
    const isSelected = cabinet.id === selectedCabinetId;

    return (
      <g
        key={cabinet.id}
        data-testid={`cabinet-${cabinet.id}`}
        transform={`translate(${sx}, ${sy}) rotate(${cabinet.rotation})`}
        onClick={e => { e.stopPropagation(); onCabinetClick(cabinet.id); }}
        style={{ cursor: activeTool === 'select' ? 'pointer' : 'default' }}
      >
        <rect
          x={0} y={0}
          width={sw} height={sd}
          fill={cabinet.color}
          stroke={isSelected ? '#2563eb' : CABINET_STROKE}
          strokeWidth={isSelected ? 2 : 1}
          rx={2}
        />
        {/* Handle strip */}
        <rect x={sw * 0.1} y={sd * 0.85} width={sw * 0.8} height={sd * 0.08}
          fill="rgba(0,0,0,0.15)" rx={1} />

        {/* Appliance cutouts */}
        {cabinet.applianceCutouts.map(cutout => (
          <rect
            key={cutout.id}
            x={cutout.offsetX * sc}
            y={cutout.offsetY * sc}
            width={cutout.width * sc}
            height={cutout.depth * sc}
            fill="rgba(255,255,255,0.4)"
            stroke="#6b7280"
            strokeWidth={1}
            strokeDasharray="3 2"
            rx={2}
          />
        ))}

        {/* Selection handles */}
        {isSelected && (
          <>
            <rect x={-3} y={-3} width={6} height={6} fill="#2563eb" rx={1} />
            <rect x={sw - 3} y={-3} width={6} height={6} fill="#2563eb" rx={1} />
            <rect x={sw - 3} y={sd - 3} width={6} height={6} fill="#2563eb" rx={1} />
            <rect x={-3} y={sd - 3} width={6} height={6} fill="#2563eb" rx={1} />
          </>
        )}

        {/* Label */}
        {sw > 30 && (
          <text
            x={sw / 2} y={sd / 2 - 4}
            textAnchor="middle"
            fontSize={Math.max(8, Math.min(11, sw / 8))}
            fill="#111827"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            {cabinet.label}
          </text>
        )}
      </g>
    );
  };

  // ─── preview wall ─────────────────────────
  const renderPreviewWall = () => {
    if (!drawState.isDrawing || !drawState.startPoint || !drawState.currentPoint) return null;
    const x1 = toSX(drawState.startPoint.x);
    const y1 = toSY(drawState.startPoint.y);
    const x2 = toSX(drawState.currentPoint.x);
    const y2 = toSY(drawState.currentPoint.y);
    const dx = drawState.currentPoint.x - drawState.startPoint.x;
    const dy = drawState.currentPoint.y - drawState.startPoint.y;
    const len = Math.round(Math.sqrt(dx * dx + dy * dy));

    return (
      <g data-testid="wall-preview">
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={PREVIEW_WALL_COLOR}
          strokeWidth={Math.max(3, room.gridSize * sc * 0.2)}
          strokeDasharray="6 3"
          strokeLinecap="round"
        />
        <circle cx={x1} cy={y1} r={4} fill={PREVIEW_WALL_COLOR} />
        <circle cx={x2} cy={y2} r={4} fill={PREVIEW_WALL_COLOR} />
        {len > 0 && (
          <text
            x={(x1 + x2) / 2}
            y={(y1 + y2) / 2 - 8}
            textAnchor="middle"
            fontSize={11}
            fill="#2563eb"
            style={{ fontFamily: 'system-ui', userSelect: 'none' }}
          >
            {formatMM(len)}
          </text>
        )}
      </g>
    );
  };

  return (
    <svg
      ref={svgRef}
      data-testid="room-canvas"
      style={{
        width: '100%',
        height: '100%',
        cursor: cursorMap[activeTool],
        display: 'block',
        background: '#f8fafc',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
      onDrop={onCanvasDrop}
      onDragOver={onCanvasDragOver}
      aria-label="Floor plan canvas"
      role="img"
    >
      {renderGrid()}

      {/* Room boundary (if walls define a closed polygon) */}
      <g data-testid="room-walls">
        {room.walls.map(renderWall)}
      </g>

      {/* Cabinets */}
      <g data-testid="room-cabinets">
        {room.placedCabinets.map(renderCabinet)}
      </g>

      {/* Measurement overlay */}
      <MeasurementLines
        walls={room.walls}
        transform={transform}
        visible={showMeasurements}
      />

      {/* Wall drawing preview */}
      {renderPreviewWall()}
    </svg>
  );
};

export default RoomCanvas;
