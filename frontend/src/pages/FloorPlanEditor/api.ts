// ─────────────────────────────────────────────
//  FloorPlanEditor – API / utilities
// ─────────────────────────────────────────────

import {
  Room,
  Wall,
  Point2D,
  SnapResult,
  RoomDimensions,
  RoomExportData,
  CabinetTemplate,
  ValidationResult,
  ValidationError,
  PlacedCabinet,
} from './types';

// ─── ID generation ───────────────────────────

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Wall geometry ───────────────────────────

export function wallLength(wall: Wall): number {
  const dx = wall.endPoint.x - wall.startPoint.x;
  const dy = wall.endPoint.y - wall.startPoint.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function wallAngleDeg(wall: Wall): number {
  const dx = wall.endPoint.x - wall.startPoint.x;
  const dy = wall.endPoint.y - wall.startPoint.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function wallMidPoint(wall: Wall): Point2D {
  return {
    x: (wall.startPoint.x + wall.endPoint.x) / 2,
    y: (wall.startPoint.y + wall.endPoint.y) / 2,
  };
}

/** Distance from a point to a line segment */
export function pointToSegmentDistance(
  p: Point2D,
  a: Point2D,
  b: Point2D
): number {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ap = { x: p.x - a.x, y: p.y - a.y };
  const lenSq = ab.x * ab.x + ab.y * ab.y;
  if (lenSq === 0) {
    return Math.hypot(ap.x, ap.y);
  }
  const t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / lenSq));
  const proj = { x: a.x + t * ab.x, y: a.y + t * ab.y };
  return Math.hypot(p.x - proj.x, p.y - proj.y);
}

/** Project a point onto the nearest wall within tolerance; returns snap info */
export function pointToWallSnap(
  point: Point2D,
  walls: Wall[],
  tolerance: number
): SnapResult | null {
  let bestDist = tolerance;
  let bestWall: Wall | null = null;
  let bestProjected: Point2D = point;

  for (const wall of walls) {
    const a = wall.startPoint;
    const b = wall.endPoint;
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const lenSq = ab.x * ab.x + ab.y * ab.y;
    if (lenSq === 0) continue;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * ab.x + (point.y - a.y) * ab.y) / lenSq));
    const proj: Point2D = { x: a.x + t * ab.x, y: a.y + t * ab.y };
    const dist = Math.hypot(point.x - proj.x, point.y - proj.y);
    if (dist < bestDist) {
      bestDist = dist;
      bestWall = wall;
      bestProjected = proj;
    }
  }

  if (!bestWall) return null;
  return {
    point: bestProjected,
    snappedToGrid: false,
    snappedToWall: true,
    snappedWallId: bestWall.id,
  };
}

// ─── Grid snap ───────────────────────────────

export function snapPointToGrid(
  point: Point2D,
  gridSize: number
): SnapResult {
  return {
    point: {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize,
    },
    snappedToGrid: true,
    snappedToWall: false,
  };
}

// ─── Room dimensions ─────────────────────────

export function computeRoomDimensions(walls: Wall[]): RoomDimensions {
  if (walls.length === 0) {
    return { width: 0, depth: 0, height: 0 };
  }

  const allX = walls.flatMap(w => [w.startPoint.x, w.endPoint.x]);
  const allY = walls.flatMap(w => [w.startPoint.y, w.endPoint.y]);
  const maxH = Math.max(...walls.map(w => w.height));

  return {
    width: Math.max(...allX) - Math.min(...allX),
    depth: Math.max(...allY) - Math.min(...allY),
    height: maxH,
  };
}

export function computeRoomArea(walls: Wall[]): number {
  const dims = computeRoomDimensions(walls);
  return (dims.width * dims.depth) / 1_000_000; // m²
}

// ─── Cabinet catalogue ───────────────────────

export const CABINET_TEMPLATES: CabinetTemplate[] = [
  {
    id: 'base-600',
    name: 'Base 600',
    category: 'base',
    width: 600,
    depth: 600,
    height: 870,
    color: '#E8D5B7',
  },
  {
    id: 'base-900',
    name: 'Base 900',
    category: 'base',
    width: 900,
    depth: 600,
    height: 870,
    color: '#E8D5B7',
  },
  {
    id: 'base-sink-800',
    name: 'Sink Base 800',
    category: 'base',
    width: 800,
    depth: 600,
    height: 870,
    color: '#B7D5E8',
    hasApplianceCutout: true,
    applianceCutoutType: 'sink',
  },
  {
    id: 'upper-600',
    name: 'Upper 600',
    category: 'upper',
    width: 600,
    depth: 330,
    height: 720,
    color: '#D5E8B7',
  },
  {
    id: 'upper-900',
    name: 'Upper 900',
    category: 'upper',
    width: 900,
    depth: 330,
    height: 720,
    color: '#D5E8B7',
  },
  {
    id: 'tall-pantry',
    name: 'Pantry',
    category: 'tall',
    width: 600,
    depth: 600,
    height: 2100,
    color: '#E8B7D5',
  },
  {
    id: 'corner-base',
    name: 'Corner Base',
    category: 'corner',
    width: 900,
    depth: 900,
    height: 870,
    color: '#E8D5B7',
  },
  {
    id: 'island-1200',
    name: 'Island 1200',
    category: 'island',
    width: 1200,
    depth: 900,
    height: 900,
    color: '#D5D5E8',
  },
  {
    id: 'appliance-dishwasher',
    name: 'Dishwasher',
    category: 'appliance',
    width: 600,
    depth: 600,
    height: 870,
    color: '#C0C0C0',
    hasApplianceCutout: true,
    applianceCutoutType: 'dishwasher',
  },
  {
    id: 'appliance-refrigerator',
    name: 'Refrigerator',
    category: 'appliance',
    width: 750,
    depth: 700,
    height: 1800,
    color: '#D0D0D0',
    hasApplianceCutout: true,
    applianceCutoutType: 'refrigerator',
  },
];

// ─── Export / Import ─────────────────────────

export function exportRoom(room: Room): RoomExportData {
  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    room,
    metadata: {
      totalCabinets: room.placedCabinets.length,
      totalWalls: room.walls.length,
      roomArea: computeRoomArea(room.walls),
    },
  };
}

export function exportRoomJSON(room: Room): string {
  return JSON.stringify(exportRoom(room), null, 2);
}

export function importRoomJSON(json: string): Room {
  const data = JSON.parse(json) as RoomExportData;
  if (!data.room) throw new Error('Invalid room data: missing "room" field');
  if (!data.version) throw new Error('Invalid room data: missing "version" field');
  return data.room;
}

export function downloadRoomJSON(room: Room): void {
  const json = exportRoomJSON(room);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${room.name.replace(/\s+/g, '_')}_floorplan.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Validation ──────────────────────────────

export function validateRoom(room: Room): ValidationResult {
  const errors: ValidationError[] = [];

  if (!room.name || room.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Room name is required' });
  }

  if (room.dimensions.width <= 0) {
    errors.push({ field: 'dimensions.width', message: 'Room width must be positive' });
  }

  if (room.dimensions.depth <= 0) {
    errors.push({ field: 'dimensions.depth', message: 'Room depth must be positive' });
  }

  if (room.dimensions.height <= 0) {
    errors.push({ field: 'dimensions.height', message: 'Room height must be positive' });
  }

  if (room.gridSize <= 0) {
    errors.push({ field: 'gridSize', message: 'Grid size must be positive' });
  }

  for (const wall of room.walls) {
    if (wallLength(wall) < 10) {
      errors.push({ field: `wall.${wall.id}`, message: `Wall "${wall.id}" is too short` });
    }
    if (wall.thickness <= 0) {
      errors.push({
        field: `wall.${wall.id}.thickness`,
        message: `Wall "${wall.id}" thickness must be positive`,
      });
    }
    for (const opening of wall.openings) {
      if (opening.position < 0 || opening.position > 1) {
        errors.push({
          field: `opening.${opening.id}.position`,
          message: `Opening position must be between 0 and 1`,
        });
      }
      if (opening.width <= 0) {
        errors.push({
          field: `opening.${opening.id}.width`,
          message: `Opening width must be positive`,
        });
      }
    }
  }

  for (const cabinet of room.placedCabinets) {
    if (cabinet.width <= 0 || cabinet.depth <= 0) {
      errors.push({
        field: `cabinet.${cabinet.id}`,
        message: `Cabinet "${cabinet.label}" must have positive dimensions`,
      });
    }
  }

  return { isValid: errors.length === 0, errors };
}

export function validateWall(wall: Partial<Wall>): ValidationResult {
  const errors: ValidationError[] = [];

  if (wall.thickness !== undefined && wall.thickness <= 0) {
    errors.push({ field: 'thickness', message: 'Thickness must be positive' });
  }

  if (wall.height !== undefined && wall.height <= 0) {
    errors.push({ field: 'height', message: 'Height must be positive' });
  }

  return { isValid: errors.length === 0, errors };
}

export function validateCabinet(cabinet: Partial<PlacedCabinet>): ValidationResult {
  const errors: ValidationError[] = [];

  if (cabinet.width !== undefined && cabinet.width <= 0) {
    errors.push({ field: 'width', message: 'Width must be positive' });
  }
  if (cabinet.depth !== undefined && cabinet.depth <= 0) {
    errors.push({ field: 'depth', message: 'Depth must be positive' });
  }
  if (cabinet.height !== undefined && cabinet.height <= 0) {
    errors.push({ field: 'height', message: 'Height must be positive' });
  }

  return { isValid: errors.length === 0, errors };
}

// ─── Format helpers ──────────────────────────

export function formatMM(mm: number): string {
  if (mm >= 1000) {
    return `${(mm / 1000).toFixed(2)} m`;
  }
  return `${Math.round(mm)} mm`;
}

export function formatM2(m2: number): string {
  return `${(m2 ?? 0).toFixed(2)} m²`;
}
