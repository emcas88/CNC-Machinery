// ─────────────────────────────────────────────────────────────────────────────
// PartOutlineSVG — 2D part preview with operations plotted
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import type { Dimensions, Operation, GrainDirection, OperationType } from '../types';

interface Props {
  dimensions: Dimensions;
  operations: Operation[];
  grainDirection: GrainDirection;
  /** SVG canvas size in pixels (square) */
  canvasSize?: number;
}

/** Colour coding per operation type */
const OP_COLORS: Record<OperationType, string> = {
  Cut: '#ef4444',
  Bore: '#3b82f6',
  Route: '#8b5cf6',
  Dado: '#f97316',
  Pocket: '#22c55e',
  Tenon: '#eab308',
  EdgeProfile: '#ec4899',
  Drill: '#06b6d4',
};

const PADDING = 24; // px margin around the part rectangle

function buildGrainLines(
  x: number,
  y: number,
  w: number,
  h: number,
  dir: GrainDirection
): React.SVGProps<SVGLineElement>[] {
  const lines: React.SVGProps<SVGLineElement>[] = [];
  const step = 16;

  if (dir === 'Horizontal') {
    for (let cy = y + step; cy < y + h; cy += step) {
      lines.push({ x1: x, y1: cy, x2: x + w, y2: cy });
    }
  } else if (dir === 'Vertical') {
    for (let cx = x + step; cx < x + w; cx += step) {
      lines.push({ x1: cx, y1: y, x2: cx, y2: y + h });
    }
  } else if (dir === 'Diagonal') {
    for (let offset = -h; offset < w + h; offset += step) {
      lines.push({
        x1: x + offset,
        y1: y,
        x2: x + offset + h,
        y2: y + h,
      });
    }
  }
  return lines;
}

export const PartOutlineSVG: React.FC<Props> = ({
  dimensions,
  operations,
  grainDirection,
  canvasSize = 300,
}) => {
  const { length, width } = dimensions;
  const availW = canvasSize - PADDING * 2;
  const availH = canvasSize - PADDING * 2;

  // Scale to fit inside the available area while preserving aspect ratio
  const scale =
    length > 0 && width > 0
      ? Math.min(availW / length, availH / width)
      : 1;

  const rectW = length * scale;
  const rectH = width * scale;
  const rectX = PADDING + (availW - rectW) / 2;
  const rectY = PADDING + (availH - rectH) / 2;

  const grainLines = buildGrainLines(rectX, rectY, rectW, rectH, grainDirection);

  return (
    <svg
      className="part-outline-svg"
      width={canvasSize}
      height={canvasSize}
      viewBox={`0 0 ${canvasSize} ${canvasSize}`}
      aria-label="Part 2D outline preview"
      role="img"
      data-testid="part-outline-svg"
    >
      {/* Background */}
      <rect width={canvasSize} height={canvasSize} fill="var(--surface-2, #f8f9fa)" />

      {/* Grain lines — render before border so they are clipped */}
      <clipPath id="part-clip">
        <rect x={rectX} y={rectY} width={rectW} height={rectH} />
      </clipPath>
      {grainDirection !== 'None' && (
        <g
          clipPath="url(#part-clip)"
          stroke="var(--grain-color, #cbd5e1)"
          strokeWidth={0.8}
          aria-label={`Grain direction: ${grainDirection}`}
        >
          {grainLines.map((props, i) => (
            <line key={i} {...props} />
          ))}
        </g>
      )}

      {/* Part rectangle */}
      <rect
        x={rectX}
        y={rectY}
        width={rectW}
        height={rectH}
        fill="none"
        stroke="var(--part-stroke, #334155)"
        strokeWidth={2}
        data-testid="part-rect"
      />

      {/* Dimension labels */}
      <text
        x={rectX + rectW / 2}
        y={rectY - 8}
        textAnchor="middle"
        fontSize={11}
        fill="var(--text-muted, #64748b)"
        data-testid="dim-label-length"
      >
        {length} mm
      </text>
      <text
        x={rectX - 8}
        y={rectY + rectH / 2}
        textAnchor="middle"
        fontSize={11}
        fill="var(--text-muted, #64748b)"
        transform={`rotate(-90, ${rectX - 8}, ${rectY + rectH / 2})`}
        data-testid="dim-label-width"
      >
        {width} mm
      </text>

      {/* Operations */}
      {operations.map((op) => {
        const cx = rectX + op.position.x * scale;
        const cy = rectY + op.position.y * scale;
        const color = OP_COLORS[op.type] ?? '#64748b';
        const r = 5;

        return (
          <g
            key={op.id}
            data-testid={`op-marker-${op.id}`}
            role="graphics-symbol"
            aria-label={`${op.type} at (${op.position.x}, ${op.position.y})`}
          >
            <circle cx={cx} cy={cy} r={r} fill={color} opacity={0.85} />
            <text
              x={cx + r + 3}
              y={cy + 4}
              fontSize={9}
              fill={color}
            >
              {op.type}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {operations.length > 0 && (
        <g data-testid="op-legend">
          {[...new Set(operations.map((o) => o.type))].map((type, i) => (
            <g key={type} transform={`translate(8, ${canvasSize - 12 - i * 14})`}>
              <circle r={4} fill={OP_COLORS[type]} />
              <text x={10} y={4} fontSize={9} fill="var(--text-muted, #64748b)">
                {type}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
};

export default PartOutlineSVG;
