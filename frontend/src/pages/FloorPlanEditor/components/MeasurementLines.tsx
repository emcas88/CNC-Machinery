// ─────────────────────────────────────────────
//  MeasurementLines – SVG overlay for dimensions
// ─────────────────────────────────────────────

import React from 'react';
import { Wall, ViewTransform } from '../types';
import { wallLength, wallAngleDeg, formatMM } from '../api';

interface MeasurementLinesProps {
  walls: Wall[];
  transform: ViewTransform;
  visible: boolean;
}

const TICK = 6; // tick mark half-length in screen px

const MeasurementLines: React.FC<MeasurementLinesProps> = ({
  walls,
  transform,
  visible,
}) => {
  if (!visible || walls.length === 0) return null;

  const toScreen = (x: number, y: number) => ({
    sx: x * transform.scale + transform.offsetX,
    sy: y * transform.scale + transform.offsetY,
  });

  return (
    <g data-testid="measurement-lines">
      {walls.map(wall => {
        const { sx: x1, sy: y1 } = toScreen(wall.startPoint.x, wall.startPoint.y);
        const { sx: x2, sy: y2 } = toScreen(wall.endPoint.x, wall.endPoint.y);

        const angleDeg = wallAngleDeg(wall);
        const angleRad = (angleDeg * Math.PI) / 180;
        const len = wallLength(wall);

        // Offset direction perpendicular (outward)
        const offsetDist = 18;
        const perpX = -Math.sin(angleRad) * offsetDist;
        const perpY = Math.cos(angleRad) * offsetDist;

        const lx1 = x1 + perpX;
        const ly1 = y1 + perpY;
        const lx2 = x2 + perpX;
        const ly2 = y2 + perpY;

        const mx = (lx1 + lx2) / 2;
        const my = (ly1 + ly2) / 2;

        // tick normal
        const tickNX = Math.cos(angleRad) * TICK;
        const tickNY = Math.sin(angleRad) * TICK;

        return (
          <g key={wall.id} data-testid={`measurement-line-${wall.id}`}>
            {/* dimension line */}
            <line
              x1={lx1} y1={ly1}
              x2={lx2} y2={ly2}
              stroke="#2563eb"
              strokeWidth={1}
              strokeDasharray="4 2"
            />
            {/* tick at start */}
            <line
              x1={lx1 - tickNX} y1={ly1 - tickNY}
              x2={lx1 + tickNX} y2={ly1 + tickNY}
              stroke="#2563eb"
              strokeWidth={1}
            />
            {/* tick at end */}
            <line
              x1={lx2 - tickNX} y1={ly2 - tickNY}
              x2={lx2 + tickNX} y2={ly2 + tickNY}
              stroke="#2563eb"
              strokeWidth={1}
            />
            {/* label */}
            <text
              x={mx}
              y={my - 6}
              textAnchor="middle"
              fontSize={10}
              fill="#1d4ed8"
              style={{ fontFamily: 'system-ui, sans-serif', userSelect: 'none' }}
              transform={`rotate(${angleDeg > 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg}, ${mx}, ${my - 6})`}
            >
              {formatMM(len)}
            </text>
          </g>
        );
      })}
    </g>
  );
};

export default MeasurementLines;
