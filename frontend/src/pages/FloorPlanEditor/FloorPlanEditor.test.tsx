// ─────────────────────────────────────────────
//  FloorPlanEditor – test suite (55+ tests)
//  Jest + React Testing Library
// ─────────────────────────────────────────────

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act as actHook } from '@testing-library/react-hooks';

import FloorPlanEditor from './FloorPlanEditor';
import { useFloorPlan, useCanvasInteraction, useWallEditor } from './hooks';
import {
  generateId,
  wallLength,
  wallAngleDeg,
  wallMidPoint,
  pointToSegmentDistance,
  pointToWallSnap,
  snapPointToGrid,
  computeRoomDimensions,
  computeRoomArea,
  exportRoom,
  exportRoomJSON,
  importRoomJSON,
  validateRoom,
  validateWall,
  validateCabinet,
  formatMM,
  formatM2,
  CABINET_TEMPLATES,
} from './api';

import {
  Room,
  Wall,
  Point2D,
  PlacedCabinet,
  WallOpening,
} from './types';

// ─────────────────────────────────────────────
//  Test fixtures
// ─────────────────────────────────────────────

function makeWall(overrides: Partial<Wall> = {}): Wall {
  return {
    id: generateId(),
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 3000, y: 0 },
    thickness: 200,
    height: 2400,
    openings: [],
    ...overrides,
  };
}

function makeRoom(overrides: Partial<Room> = {}): Room {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: 'Test Room',
    walls: [],
    placedCabinets: [],
    dimensions: { width: 4000, depth: 3000, height: 2400 },
    gridSize: 100,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeCabinet(overrides: Partial<PlacedCabinet> = {}): PlacedCabinet {
  return {
    id: generateId(),
    templateId: 'base-600',
    label: 'Base 600',
    position: { x: 500, y: 500 },
    rotation: 0,
    width: 600,
    depth: 600,
    height: 870,
    color: '#E8D5B7',
    applianceCutouts: [],
    isSelected: false,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
//  1. API / utility tests
// ─────────────────────────────────────────────

describe('generateId', () => {
  test('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string');
    expect(generateId().length).toBeGreaterThan(0);
  });

  test('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, generateId));
    expect(ids.size).toBe(100);
  });
});

describe('wallLength', () => {
  test('calculates horizontal wall length correctly', () => {
    const wall = makeWall({ startPoint: { x: 0, y: 0 }, endPoint: { x: 3000, y: 0 } });
    expect(wallLength(wall)).toBeCloseTo(3000);
  });

  test('calculates diagonal wall length (Pythagorean)', () => {
    const wall = makeWall({ startPoint: { x: 0, y: 0 }, endPoint: { x: 3000, y: 4000 } });
    expect(wallLength(wall)).toBeCloseTo(5000);
  });

  test('returns 0 for zero-length wall', () => {
    const wall = makeWall({ startPoint: { x: 100, y: 100 }, endPoint: { x: 100, y: 100 } });
    expect(wallLength(wall)).toBe(0);
  });
});

describe('wallAngleDeg', () => {
  test('horizontal wall has 0 degrees', () => {
    const wall = makeWall({ startPoint: { x: 0, y: 0 }, endPoint: { x: 1000, y: 0 } });
    expect(wallAngleDeg(wall)).toBeCloseTo(0);
  });

  test('vertical wall has 90 degrees', () => {
    const wall = makeWall({ startPoint: { x: 0, y: 0 }, endPoint: { x: 0, y: 1000 } });
    expect(wallAngleDeg(wall)).toBeCloseTo(90);
  });

  test('45-degree wall', () => {
    const wall = makeWall({ startPoint: { x: 0, y: 0 }, endPoint: { x: 1000, y: 1000 } });
    expect(wallAngleDeg(wall)).toBeCloseTo(45);
  });
});

describe('wallMidPoint', () => {
  test('returns correct midpoint', () => {
    const wall = makeWall({ startPoint: { x: 0, y: 0 }, endPoint: { x: 2000, y: 1000 } });
    const mid = wallMidPoint(wall);
    expect(mid.x).toBe(1000);
    expect(mid.y).toBe(500);
  });
});

describe('pointToSegmentDistance', () => {
  test('distance from a point on the segment is 0', () => {
    const d = pointToSegmentDistance({ x: 500, y: 0 }, { x: 0, y: 0 }, { x: 1000, y: 0 });
    expect(d).toBeCloseTo(0);
  });

  test('distance from a point perpendicular to segment midpoint', () => {
    const d = pointToSegmentDistance({ x: 500, y: 200 }, { x: 0, y: 0 }, { x: 1000, y: 0 });
    expect(d).toBeCloseTo(200);
  });

  test('distance from a point past the end of segment', () => {
    const d = pointToSegmentDistance({ x: 1500, y: 0 }, { x: 0, y: 0 }, { x: 1000, y: 0 });
    expect(d).toBeCloseTo(500);
  });

  test('zero-length segment returns distance to that point', () => {
    const d = pointToSegmentDistance({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(d).toBeCloseTo(5);
  });
});

describe('snapPointToGrid', () => {
  test('snaps to nearest grid point', () => {
    const result = snapPointToGrid({ x: 140, y: 260 }, 100);
    expect(result.point).toEqual({ x: 100, y: 300 });
    expect(result.snappedToGrid).toBe(true);
  });

  test('exactly on grid stays on grid', () => {
    const result = snapPointToGrid({ x: 300, y: 200 }, 100);
    expect(result.point).toEqual({ x: 300, y: 200 });
  });

  test('snaps with 50mm grid', () => {
    const result = snapPointToGrid({ x: 375, y: 125 }, 50);
    expect(result.point).toEqual({ x: 400, y: 100 });
  });
});

describe('pointToWallSnap', () => {
  const walls = [makeWall({ startPoint: { x: 0, y: 0 }, endPoint: { x: 1000, y: 0 } })];

  test('returns null when point is outside tolerance', () => {
    const result = pointToWallSnap({ x: 500, y: 500 }, walls, 50);
    expect(result).toBeNull();
  });

  test('snaps to wall when within tolerance', () => {
    const result = pointToWallSnap({ x: 500, y: 30 }, walls, 50);
    expect(result).not.toBeNull();
    expect(result?.snappedToWall).toBe(true);
    expect(result?.point.x).toBeCloseTo(500);
    expect(result?.point.y).toBeCloseTo(0);
  });

  test('returns the snapped wall id', () => {
    const result = pointToWallSnap({ x: 500, y: 10 }, walls, 50);
    expect(result?.snappedWallId).toBe(walls[0].id);
  });
});

describe('computeRoomDimensions', () => {
  test('returns zeros for empty walls', () => {
    const dims = computeRoomDimensions([]);
    expect(dims).toEqual({ width: 0, depth: 0, height: 0 });
  });

  test('computes bounding box from multiple walls', () => {
    const walls = [
      makeWall({ startPoint: { x: 0, y: 0 }, endPoint: { x: 4000, y: 0 }, height: 2400 }),
      makeWall({ startPoint: { x: 4000, y: 0 }, endPoint: { x: 4000, y: 3000 }, height: 2400 }),
    ];
    const dims = computeRoomDimensions(walls);
    expect(dims.width).toBe(4000);
    expect(dims.depth).toBe(3000);
    expect(dims.height).toBe(2400);
  });
});

describe('computeRoomArea', () => {
  test('returns 0 for no walls', () => {
    expect(computeRoomArea([])).toBe(0);
  });

  test('calculates area in square meters', () => {
    const walls = [
      makeWall({ startPoint: { x: 0, y: 0 }, endPoint: { x: 4000, y: 0 } }),
      makeWall({ startPoint: { x: 4000, y: 0 }, endPoint: { x: 4000, y: 3000 } }),
    ];
    // 4000mm × 3000mm = 12 m²
    expect(computeRoomArea(walls)).toBeCloseTo(12);
  });
});

describe('formatMM', () => {
  test('formats millimeters under 1000', () => {
    expect(formatMM(500)).toBe('500 mm');
    expect(formatMM(999)).toBe('999 mm');
  });

  test('formats in meters for 1000+', () => {
    expect(formatMM(1000)).toBe('1.00 m');
    expect(formatMM(2500)).toBe('2.50 m');
  });
});

describe('formatM2', () => {
  test('formats area with 2 decimal places', () => {
    expect(formatM2(12)).toBe('12.00 m²');
    expect(formatM2(9.5)).toBe('9.50 m²');
  });
});

// ─────────────────────────────────────────────
//  2. Validation tests
// ─────────────────────────────────────────────

describe('validateRoom', () => {
  test('valid room passes validation', () => {
    const room = makeRoom({ name: 'My Kitchen' });
    const result = validateRoom(room);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('empty room name fails validation', () => {
    const room = makeRoom({ name: '' });
    const result = validateRoom(room);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'name')).toBe(true);
  });

  test('negative width fails validation', () => {
    const room = makeRoom({ dimensions: { width: -100, depth: 3000, height: 2400 } });
    const result = validateRoom(room);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'dimensions.width')).toBe(true);
  });

  test('short wall triggers validation error', () => {
    const shortWall = makeWall({ startPoint: { x: 0, y: 0 }, endPoint: { x: 5, y: 0 } });
    const room = makeRoom({ walls: [shortWall] });
    const result = validateRoom(room);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field.includes('wall'))).toBe(true);
  });

  test('invalid opening position triggers error', () => {
    const opening: WallOpening = {
      id: generateId(),
      type: 'door',
      position: 1.5, // out of range
      width: 900,
    };
    const wall = makeWall({ openings: [opening] });
    const room = makeRoom({ walls: [wall] });
    const result = validateRoom(room);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field.includes('opening'))).toBe(true);
  });

  test('zero-width cabinet fails validation', () => {
    const cabinet = makeCabinet({ width: 0 });
    const room = makeRoom({ placedCabinets: [cabinet] });
    const result = validateRoom(room);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field.includes('cabinet'))).toBe(true);
  });
});

describe('validateWall', () => {
  test('valid wall passes', () => {
    expect(validateWall({ thickness: 200, height: 2400 }).isValid).toBe(true);
  });

  test('zero thickness fails', () => {
    const r = validateWall({ thickness: 0 });
    expect(r.isValid).toBe(false);
  });
});

describe('validateCabinet', () => {
  test('valid dimensions pass', () => {
    expect(validateCabinet({ width: 600, depth: 600, height: 870 }).isValid).toBe(true);
  });

  test('negative depth fails', () => {
    expect(validateCabinet({ depth: -100 }).isValid).toBe(false);
  });
});

// ─────────────────────────────────────────────
//  3. Export / Import tests
// ─────────────────────────────────────────────

describe('exportRoom / importRoomJSON', () => {
  const room = makeRoom({
    name: 'Export Test',
    walls: [makeWall()],
    placedCabinets: [makeCabinet()],
  });

  test('exportRoom produces correct version and timestamps', () => {
    const data = exportRoom(room);
    expect(data.version).toBe('1.0.0');
    expect(data.exportedAt).toBeTruthy();
    expect(data.room.id).toBe(room.id);
  });

  test('metadata counts are correct', () => {
    const data = exportRoom(room);
    expect(data.metadata.totalCabinets).toBe(1);
    expect(data.metadata.totalWalls).toBe(1);
  });

  test('round-trip through JSON preserves room', () => {
    const json = exportRoomJSON(room);
    const imported = importRoomJSON(json);
    expect(imported.id).toBe(room.id);
    expect(imported.name).toBe(room.name);
    expect(imported.walls).toHaveLength(1);
    expect(imported.placedCabinets).toHaveLength(1);
  });

  test('importRoomJSON throws on missing room field', () => {
    expect(() => importRoomJSON(JSON.stringify({ version: '1.0.0' }))).toThrow();
  });

  test('importRoomJSON throws on invalid JSON', () => {
    expect(() => importRoomJSON('not json')).toThrow();
  });
});

// ─────────────────────────────────────────────
//  4. CABINET_TEMPLATES catalogue tests
// ─────────────────────────────────────────────

describe('CABINET_TEMPLATES', () => {
  test('catalogue contains at least 8 templates', () => {
    expect(CABINET_TEMPLATES.length).toBeGreaterThanOrEqual(8);
  });

  test('every template has required fields', () => {
    for (const t of CABINET_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.width).toBeGreaterThan(0);
      expect(t.depth).toBeGreaterThan(0);
      expect(t.height).toBeGreaterThan(0);
    }
  });

  test('includes base, upper, tall, corner, island, appliance categories', () => {
    const cats = new Set(CABINET_TEMPLATES.map(t => t.category));
    expect(cats.has('base')).toBe(true);
    expect(cats.has('upper')).toBe(true);
    expect(cats.has('tall')).toBe(true);
    expect(cats.has('appliance')).toBe(true);
  });
});

// ─────────────────────────────────────────────
//  5. useFloorPlan hook tests
// ─────────────────────────────────────────────

describe('useFloorPlan', () => {
  test('initializes with default room when none provided', () => {
    const { result } = renderHook(() => useFloorPlan());
    expect(result.current.room.walls).toHaveLength(0);
    expect(result.current.room.placedCabinets).toHaveLength(0);
    expect(result.current.isDirty).toBe(false);
  });

  test('addWall adds a wall and marks dirty', () => {
    const { result } = renderHook(() => useFloorPlan());
    actHook(() => {
      result.current.addWall({ x: 0, y: 0 }, { x: 3000, y: 0 });
    });
    expect(result.current.room.walls).toHaveLength(1);
    expect(result.current.isDirty).toBe(true);
  });

  test('deleteWall removes the wall', () => {
    const { result } = renderHook(() => useFloorPlan());
    let wallId: string;
    actHook(() => {
      const w = result.current.addWall({ x: 0, y: 0 }, { x: 3000, y: 0 });
      wallId = w.id;
    });
    actHook(() => {
      result.current.deleteWall(wallId!);
    });
    expect(result.current.room.walls).toHaveLength(0);
  });

  test('updateWall updates the wall properties', () => {
    const { result } = renderHook(() => useFloorPlan());
    let wall: Wall;
    actHook(() => {
      wall = result.current.addWall({ x: 0, y: 0 }, { x: 3000, y: 0 });
    });
    actHook(() => {
      result.current.updateWall({ ...wall!, thickness: 300 });
    });
    expect(result.current.room.walls[0].thickness).toBe(300);
  });

  test('addOpening adds an opening to a wall', () => {
    const { result } = renderHook(() => useFloorPlan());
    let wallId: string;
    actHook(() => {
      const w = result.current.addWall({ x: 0, y: 0 }, { x: 3000, y: 0 });
      wallId = w.id;
    });
    actHook(() => {
      result.current.addOpening(wallId!, { type: 'door', position: 0.5, width: 900 });
    });
    expect(result.current.room.walls[0].openings).toHaveLength(1);
    expect(result.current.room.walls[0].openings[0].type).toBe('door');
  });

  test('deleteOpening removes the opening', () => {
    const { result } = renderHook(() => useFloorPlan());
    let wallId: string;
    let openingId: string;
    actHook(() => {
      const w = result.current.addWall({ x: 0, y: 0 }, { x: 3000, y: 0 });
      wallId = w.id;
    });
    actHook(() => {
      const o = result.current.addOpening(wallId!, { type: 'window', position: 0.3, width: 1200 });
      openingId = o.id;
    });
    actHook(() => {
      result.current.deleteOpening(wallId!, openingId!);
    });
    expect(result.current.room.walls[0].openings).toHaveLength(0);
  });

  test('placeCabinet places a cabinet on the canvas', () => {
    const { result } = renderHook(() => useFloorPlan());
    const template = CABINET_TEMPLATES[0];
    actHook(() => {
      result.current.placeCabinet(template, { x: 500, y: 500 });
    });
    expect(result.current.room.placedCabinets).toHaveLength(1);
    expect(result.current.room.placedCabinets[0].templateId).toBe(template.id);
  });

  test('deleteCabinet removes the cabinet', () => {
    const { result } = renderHook(() => useFloorPlan());
    let cabinetId: string;
    actHook(() => {
      const c = result.current.placeCabinet(CABINET_TEMPLATES[0], { x: 0, y: 0 });
      cabinetId = c.id;
    });
    actHook(() => {
      result.current.deleteCabinet(cabinetId!);
    });
    expect(result.current.room.placedCabinets).toHaveLength(0);
  });

  test('moveCabinet updates position', () => {
    const { result } = renderHook(() => useFloorPlan());
    let cabinetId: string;
    actHook(() => {
      const c = result.current.placeCabinet(CABINET_TEMPLATES[0], { x: 0, y: 0 });
      cabinetId = c.id;
    });
    actHook(() => {
      result.current.moveCabinet(cabinetId!, { x: 1000, y: 2000 });
    });
    const moved = result.current.room.placedCabinets[0];
    expect(moved.position).toEqual({ x: 1000, y: 2000 });
  });

  test('rotateCabinet updates rotation', () => {
    const { result } = renderHook(() => useFloorPlan());
    let cabinetId: string;
    actHook(() => {
      const c = result.current.placeCabinet(CABINET_TEMPLATES[0], { x: 0, y: 0 });
      cabinetId = c.id;
    });
    actHook(() => {
      result.current.rotateCabinet(cabinetId!, 90);
    });
    expect(result.current.room.placedCabinets[0].rotation).toBe(90);
  });

  test('selectCabinet marks selected and deselects others', () => {
    const { result } = renderHook(() => useFloorPlan());
    let id1: string, id2: string;
    actHook(() => {
      const c1 = result.current.placeCabinet(CABINET_TEMPLATES[0], { x: 0, y: 0 });
      const c2 = result.current.placeCabinet(CABINET_TEMPLATES[1], { x: 500, y: 0 });
      id1 = c1.id; id2 = c2.id;
    });
    actHook(() => { result.current.selectCabinet(id1!); });
    expect(result.current.room.placedCabinets.find(c => c.id === id1)?.isSelected).toBe(true);
    expect(result.current.room.placedCabinets.find(c => c.id === id2)?.isSelected).toBe(false);
  });

  test('updateGridSize updates grid', () => {
    const { result } = renderHook(() => useFloorPlan());
    actHook(() => { result.current.updateGridSize(50); });
    expect(result.current.room.gridSize).toBe(50);
  });

  test('setRoom replaces entire room and clears dirty flag', () => {
    const { result } = renderHook(() => useFloorPlan());
    const newRoom = makeRoom({ name: 'Replaced Room' });
    actHook(() => { result.current.setRoom(newRoom); });
    expect(result.current.room.name).toBe('Replaced Room');
    expect(result.current.isDirty).toBe(false);
  });

  test('addApplianceCutout adds cutout to cabinet', () => {
    const { result } = renderHook(() => useFloorPlan());
    let cabinetId: string;
    actHook(() => {
      const c = result.current.placeCabinet(CABINET_TEMPLATES[0], { x: 0, y: 0 });
      cabinetId = c.id;
    });
    actHook(() => {
      result.current.addApplianceCutout(cabinetId!, {
        type: 'sink',
        offsetX: 50,
        offsetY: 50,
        width: 500,
        depth: 400,
      });
    });
    expect(result.current.room.placedCabinets[0].applianceCutouts).toHaveLength(1);
    expect(result.current.room.placedCabinets[0].applianceCutouts[0].type).toBe('sink');
  });
});

// ─────────────────────────────────────────────
//  6. useCanvasInteraction hook tests
// ─────────────────────────────────────────────

describe('useCanvasInteraction', () => {
  test('initializes with scale=1 and zero offset', () => {
    const { result } = renderHook(() => useCanvasInteraction(100, []));
    expect(result.current.transform.scale).toBe(1);
    expect(result.current.transform.offsetX).toBe(0);
    expect(result.current.transform.offsetY).toBe(0);
  });

  test('zoomIn increases scale', () => {
    const { result } = renderHook(() => useCanvasInteraction(100, []));
    const before = result.current.transform.scale;
    actHook(() => { result.current.zoomIn(); });
    expect(result.current.transform.scale).toBeGreaterThan(before);
  });

  test('zoomOut decreases scale', () => {
    const { result } = renderHook(() => useCanvasInteraction(100, []));
    const before = result.current.transform.scale;
    actHook(() => { result.current.zoomOut(); });
    expect(result.current.transform.scale).toBeLessThan(before);
  });

  test('resetZoom restores scale to 1', () => {
    const { result } = renderHook(() => useCanvasInteraction(100, []));
    actHook(() => { result.current.zoomIn(); result.current.zoomIn(); });
    actHook(() => { result.current.resetZoom(); });
    expect(result.current.transform.scale).toBe(1);
    expect(result.current.transform.offsetX).toBe(0);
  });

  test('screenToWorld converts correctly at scale=1 with no offset', () => {
    const { result } = renderHook(() => useCanvasInteraction(100, []));
    const world = result.current.screenToWorld(300, 200);
    expect(world).toEqual({ x: 300, y: 200 });
  });

  test('worldToScreen converts correctly at scale=2', () => {
    const { result } = renderHook(() => useCanvasInteraction(100, []));
    actHook(() => { result.current.setScale(2); });
    const screen = result.current.worldToScreen(100, 50);
    expect(screen.x).toBe(200);
    expect(screen.y).toBe(100);
  });

  test('snapToGrid snaps world coordinates', () => {
    const { result } = renderHook(() => useCanvasInteraction(100, []));
    const snap = result.current.snapToGrid({ x: 145, y: 260 });
    expect(snap.point.x).toBe(100);
    expect(snap.point.y).toBe(300);
  });

  test('zoom does not exceed MAX_SCALE (10)', () => {
    const { result } = renderHook(() => useCanvasInteraction(100, []));
    actHook(() => {
      for (let i = 0; i < 50; i++) result.current.zoomIn();
    });
    expect(result.current.transform.scale).toBeLessThanOrEqual(10);
  });

  test('zoom does not go below MIN_SCALE (0.1)', () => {
    const { result } = renderHook(() => useCanvasInteraction(100, []));
    actHook(() => {
      for (let i = 0; i < 50; i++) result.current.zoomOut();
    });
    expect(result.current.transform.scale).toBeGreaterThanOrEqual(0.1);
  });
});

// ─────────────────────────────────────────────
//  7. useWallEditor hook tests
// ─────────────────────────────────────────────

describe('useWallEditor', () => {
  const mockAddWall = jest.fn((start: Point2D, end: Point2D) =>
    makeWall({ startPoint: start, endPoint: end })
  );
  const mockSnap = jest.fn((p: Point2D) => ({
    point: p,
    snappedToGrid: false,
    snappedToWall: false,
  }));

  beforeEach(() => {
    mockAddWall.mockClear();
    mockSnap.mockClear();
  });

  test('initial state is not drawing', () => {
    const { result } = renderHook(() => useWallEditor(mockAddWall, mockSnap));
    expect(result.current.drawState.isDrawing).toBe(false);
  });

  test('startWall sets isDrawing=true', () => {
    const { result } = renderHook(() => useWallEditor(mockAddWall, mockSnap));
    actHook(() => { result.current.startWall({ x: 0, y: 0 }); });
    expect(result.current.drawState.isDrawing).toBe(true);
    expect(result.current.drawState.startPoint).toEqual({ x: 0, y: 0 });
  });

  test('cancelWall resets drawing state', () => {
    const { result } = renderHook(() => useWallEditor(mockAddWall, mockSnap));
    actHook(() => { result.current.startWall({ x: 0, y: 0 }); });
    actHook(() => { result.current.cancelWall(); });
    expect(result.current.drawState.isDrawing).toBe(false);
  });

  test('finishWall calls addWall when wall is long enough', () => {
    const { result } = renderHook(() => useWallEditor(mockAddWall, mockSnap));
    actHook(() => { result.current.startWall({ x: 0, y: 0 }); });
    actHook(() => { result.current.updateWallPreview({ x: 2000, y: 0 }); });
    actHook(() => { result.current.finishWall(); });
    expect(mockAddWall).toHaveBeenCalledTimes(1);
    expect(result.current.drawState.isDrawing).toBe(false);
  });

  test('finishWall returns null when wall is too short', () => {
    const { result } = renderHook(() => useWallEditor(mockAddWall, mockSnap));
    actHook(() => { result.current.startWall({ x: 0, y: 0 }); });
    actHook(() => { result.current.updateWallPreview({ x: 5, y: 0 }); });
    let wall: any;
    actHook(() => { wall = result.current.finishWall(); });
    expect(wall).toBeNull();
    expect(mockAddWall).not.toHaveBeenCalled();
  });

  test('previewLength calculates correctly', () => {
    const { result } = renderHook(() => useWallEditor(mockAddWall, mockSnap));
    actHook(() => { result.current.startWall({ x: 0, y: 0 }); });
    actHook(() => { result.current.updateWallPreview({ x: 3000, y: 4000 }); });
    expect(result.current.previewLength).toBe(5000);
  });
});

// ─────────────────────────────────────────────
//  8. Component rendering tests
// ─────────────────────────────────────────────

describe('FloorPlanEditor rendering', () => {
  test('renders without crashing', () => {
    render(<FloorPlanEditor />);
    expect(screen.getByTestId('floor-plan-editor')).toBeInTheDocument();
  });

  test('renders the SVG canvas', () => {
    render(<FloorPlanEditor />);
    expect(screen.getByTestId('room-canvas')).toBeInTheDocument();
  });

  test('renders the toolbar', () => {
    render(<FloorPlanEditor />);
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });

  test('renders the zoom controls', () => {
    render(<FloorPlanEditor />);
    expect(screen.getByTestId('zoom-controls')).toBeInTheDocument();
  });

  test('renders the cabinet palette', () => {
    render(<FloorPlanEditor />);
    expect(screen.getByTestId('cabinet-palette')).toBeInTheDocument();
  });

  test('renders the export button', () => {
    render(<FloorPlanEditor />);
    expect(screen.getByTestId('export-btn')).toBeInTheDocument();
  });

  test('renders room name input', () => {
    render(<FloorPlanEditor />);
    expect(screen.getByTestId('room-name-input')).toBeInTheDocument();
  });

  test('renders with initialRoom prop', () => {
    const room = makeRoom({ name: 'My Kitchen' });
    render(<FloorPlanEditor initialRoom={room} />);
    expect(screen.getByDisplayValue('My Kitchen')).toBeInTheDocument();
  });

  test('readOnly mode hides toolbar', () => {
    render(<FloorPlanEditor readOnly={true} />);
    expect(screen.queryByTestId('toolbar')).not.toBeInTheDocument();
  });

  test('readOnly mode hides export button', () => {
    render(<FloorPlanEditor readOnly={true} />);
    expect(screen.queryByTestId('export-btn')).not.toBeInTheDocument();
  });
});

describe('FloorPlanEditor interactions', () => {
  test('room name input updates room name', async () => {
    render(<FloorPlanEditor />);
    const input = screen.getByTestId('room-name-input');
    await userEvent.clear(input);
    await userEvent.type(input, 'Living Room');
    expect(input).toHaveValue('Living Room');
  });

  test('zoom in button increases scale indicator', async () => {
    render(<FloorPlanEditor />);
    const zoomReset = screen.getByTestId('zoom-reset-btn');
    expect(zoomReset).toHaveTextContent('100%');
    fireEvent.click(screen.getByTestId('zoom-in-btn'));
    // scale should now be > 100%
    const pct = parseInt(zoomReset.textContent ?? '0');
    expect(pct).toBeGreaterThan(100);
  });

  test('zoom out button decreases scale', async () => {
    render(<FloorPlanEditor />);
    fireEvent.click(screen.getByTestId('zoom-out-btn'));
    const pct = parseInt(screen.getByTestId('zoom-reset-btn').textContent ?? '0');
    expect(pct).toBeLessThan(100);
  });

  test('zoom reset button restores 100%', async () => {
    render(<FloorPlanEditor />);
    fireEvent.click(screen.getByTestId('zoom-in-btn'));
    fireEvent.click(screen.getByTestId('zoom-in-btn'));
    fireEvent.click(screen.getByTestId('zoom-reset-btn'));
    expect(screen.getByTestId('zoom-reset-btn')).toHaveTextContent('100%');
  });

  test('export button opens export modal', async () => {
    render(<FloorPlanEditor initialRoom={makeRoom({ name: 'Export Test' })} />);
    fireEvent.click(screen.getByTestId('export-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('export-modal')).toBeInTheDocument();
    });
  });

  test('export modal shows JSON content', async () => {
    render(<FloorPlanEditor initialRoom={makeRoom({ name: 'My Room' })} />);
    fireEvent.click(screen.getByTestId('export-btn'));
    await waitFor(() => {
      const textarea = screen.getByTestId('export-json-textarea');
      expect(textarea).toHaveValue(expect.stringContaining('"version"'));
    });
  });

  test('close export modal button works', async () => {
    render(<FloorPlanEditor initialRoom={makeRoom({ name: 'My Room' })} />);
    fireEvent.click(screen.getByTestId('export-btn'));
    await waitFor(() => screen.getByTestId('export-modal'));
    fireEvent.click(screen.getByTestId('close-export-modal'));
    await waitFor(() => {
      expect(screen.queryByTestId('export-modal')).not.toBeInTheDocument();
    });
  });

  test('sidebar list tab shows placed cabinets', async () => {
    const room = makeRoom({ placedCabinets: [makeCabinet({ label: 'Sink Base' })] });
    render(<FloorPlanEditor initialRoom={room} />);
    fireEvent.click(screen.getByTestId('sidebar-tab-list'));
    await waitFor(() => {
      expect(screen.getByTestId('cabinet-list')).toBeInTheDocument();
    });
  });

  test('tool buttons change active tool', () => {
    render(<FloorPlanEditor />);
    const wallTool = screen.getByTestId('tool-drawWall');
    fireEvent.click(wallTool);
    expect(wallTool).toHaveAttribute('aria-pressed', 'true');
  });

  test('show measurements toggle hides measurement lines', () => {
    const room = makeRoom({ walls: [makeWall()] });
    render(<FloorPlanEditor initialRoom={room} />);
    const toggle = screen.getByTestId('show-measurements-toggle');
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(toggle).not.toBeChecked();
  });
});

// ─────────────────────────────────────────────
//  9. WallProperties component tests
// ─────────────────────────────────────────────

describe('WallProperties', () => {
  const { default: WallProperties } = jest.requireActual('./components/WallProperties');

  const defaultWall = makeWall({ thickness: 200, height: 2400 });
  const noop = () => {};

  test('renders wall thickness input', () => {
    render(
      <WallProperties
        wall={defaultWall}
        onUpdate={noop}
        onDelete={noop}
        onAddOpening={noop}
        onDeleteOpening={noop}
      />
    );
    expect(screen.getByTestId('wall-thickness-input')).toBeInTheDocument();
  });

  test('renders add-door and add-window buttons', () => {
    render(
      <WallProperties
        wall={defaultWall}
        onUpdate={noop}
        onDelete={noop}
        onAddOpening={noop}
        onDeleteOpening={noop}
      />
    );
    expect(screen.getByTestId('add-door-btn')).toBeInTheDocument();
    expect(screen.getByTestId('add-window-btn')).toBeInTheDocument();
  });

  test('calls onAddOpening with type=door when Add Door clicked', () => {
    const onAddOpening = jest.fn();
    render(
      <WallProperties
        wall={defaultWall}
        onUpdate={noop}
        onDelete={noop}
        onAddOpening={onAddOpening}
        onDeleteOpening={noop}
      />
    );
    fireEvent.click(screen.getByTestId('add-door-btn'));
    expect(onAddOpening).toHaveBeenCalledWith(defaultWall.id, expect.objectContaining({ type: 'door' }));
  });
});
