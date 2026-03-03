// ─────────────────────────────────────────────
//  FloorPlanEditor – custom hooks
// ─────────────────────────────────────────────

import { useCallback, useReducer, useRef, useState, useEffect } from 'react';
import {
  Room,
  Wall,
  WallOpening,
  PlacedCabinet,
  Point2D,
  ViewTransform,
  EditorTool,
  SnapResult,
  DragState,
  WallDrawState,
  SelectionState,
  CabinetTemplate,
  ApplianceCutout,
  RoomDimensions,
} from './types';
import { generateId, computeRoomDimensions, snapPointToGrid, pointToWallSnap } from './api';

// ─────────────────────────────────────────────
//  useFloorPlan
// ─────────────────────────────────────────────

type FloorPlanAction =
  | { type: 'SET_ROOM'; payload: Room }
  | { type: 'ADD_WALL'; payload: Wall }
  | { type: 'UPDATE_WALL'; payload: Wall }
  | { type: 'DELETE_WALL'; payload: string }
  | { type: 'ADD_OPENING'; payload: { wallId: string; opening: WallOpening } }
  | { type: 'UPDATE_OPENING'; payload: { wallId: string; opening: WallOpening } }
  | { type: 'DELETE_OPENING'; payload: { wallId: string; openingId: string } }
  | { type: 'ADD_CABINET'; payload: PlacedCabinet }
  | { type: 'UPDATE_CABINET'; payload: PlacedCabinet }
  | { type: 'DELETE_CABINET'; payload: string }
  | { type: 'MOVE_CABINET'; payload: { id: string; position: Point2D } }
  | { type: 'ROTATE_CABINET'; payload: { id: string; rotation: number } }
  | { type: 'SELECT_CABINET'; payload: string | null }
  | { type: 'SELECT_WALL'; payload: string | null }
  | { type: 'UPDATE_ROOM_NAME'; payload: string }
  | { type: 'UPDATE_GRID_SIZE'; payload: number }
  | { type: 'UPDATE_DIMENSIONS'; payload: Partial<RoomDimensions> }
  | { type: 'ADD_APPLIANCE_CUTOUT'; payload: { cabinetId: string; cutout: ApplianceCutout } }
  | { type: 'REMOVE_APPLIANCE_CUTOUT'; payload: { cabinetId: string; cutoutId: string } };

interface FloorPlanState {
  room: Room;
  selection: SelectionState;
  isDirty: boolean;
}

function createDefaultRoom(): Room {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: 'New Room',
    walls: [],
    placedCabinets: [],
    dimensions: { width: 4000, depth: 3000, height: 2400 },
    gridSize: 100,
    createdAt: now,
    updatedAt: now,
  };
}

function floorPlanReducer(state: FloorPlanState, action: FloorPlanAction): FloorPlanState {
  const now = new Date().toISOString();

  switch (action.type) {
    case 'SET_ROOM':
      return { ...state, room: action.payload, isDirty: false };

    case 'ADD_WALL': {
      const walls = [...state.room.walls, action.payload];
      return {
        ...state,
        room: { ...state.room, walls, updatedAt: now },
        isDirty: true,
      };
    }

    case 'UPDATE_WALL': {
      const walls = state.room.walls.map(w =>
        w.id === action.payload.id ? action.payload : w
      );
      return {
        ...state,
        room: { ...state.room, walls, updatedAt: now },
        isDirty: true,
      };
    }

    case 'DELETE_WALL': {
      const walls = state.room.walls.filter(w => w.id !== action.payload);
      return {
        ...state,
        room: { ...state.room, walls, updatedAt: now },
        selection: {
          ...state.selection,
          selectedWallId:
            state.selection.selectedWallId === action.payload
              ? null
              : state.selection.selectedWallId,
        },
        isDirty: true,
      };
    }

    case 'ADD_OPENING': {
      const walls = state.room.walls.map(w =>
        w.id === action.payload.wallId
          ? { ...w, openings: [...w.openings, action.payload.opening] }
          : w
      );
      return {
        ...state,
        room: { ...state.room, walls, updatedAt: now },
        isDirty: true,
      };
    }

    case 'UPDATE_OPENING': {
      const walls = state.room.walls.map(w =>
        w.id === action.payload.wallId
          ? {
              ...w,
              openings: w.openings.map(o =>
                o.id === action.payload.opening.id ? action.payload.opening : o
              ),
            }
          : w
      );
      return {
        ...state,
        room: { ...state.room, walls, updatedAt: now },
        isDirty: true,
      };
    }

    case 'DELETE_OPENING': {
      const walls = state.room.walls.map(w =>
        w.id === action.payload.wallId
          ? { ...w, openings: w.openings.filter(o => o.id !== action.payload.openingId) }
          : w
      );
      return {
        ...state,
        room: { ...state.room, walls, updatedAt: now },
        isDirty: true,
      };
    }

    case 'ADD_CABINET': {
      const placedCabinets = [...state.room.placedCabinets, action.payload];
      return {
        ...state,
        room: { ...state.room, placedCabinets, updatedAt: now },
        isDirty: true,
      };
    }

    case 'UPDATE_CABINET': {
      const placedCabinets = state.room.placedCabinets.map(c =>
        c.id === action.payload.id ? action.payload : c
      );
      return {
        ...state,
        room: { ...state.room, placedCabinets, updatedAt: now },
        isDirty: true,
      };
    }

    case 'DELETE_CABINET': {
      const placedCabinets = state.room.placedCabinets.filter(c => c.id !== action.payload);
      return {
        ...state,
        room: { ...state.room, placedCabinets, updatedAt: now },
        selection: {
          ...state.selection,
          selectedCabinetId:
            state.selection.selectedCabinetId === action.payload
              ? null
              : state.selection.selectedCabinetId,
        },
        isDirty: true,
      };
    }

    case 'MOVE_CABINET': {
      const placedCabinets = state.room.placedCabinets.map(c =>
        c.id === action.payload.id ? { ...c, position: action.payload.position } : c
      );
      return {
        ...state,
        room: { ...state.room, placedCabinets, updatedAt: now },
        isDirty: true,
      };
    }

    case 'ROTATE_CABINET': {
      const placedCabinets = state.room.placedCabinets.map(c =>
        c.id === action.payload.id ? { ...c, rotation: action.payload.rotation } : c
      );
      return {
        ...state,
        room: { ...state.room, placedCabinets, updatedAt: now },
        isDirty: true,
      };
    }

    case 'SELECT_CABINET':
      return {
        ...state,
        selection: {
          selectedWallId: null,
          selectedCabinetId: action.payload,
          selectedOpeningId: null,
        },
        room: {
          ...state.room,
          placedCabinets: state.room.placedCabinets.map(c => ({
            ...c,
            isSelected: c.id === action.payload,
          })),
        },
      };

    case 'SELECT_WALL':
      return {
        ...state,
        selection: {
          selectedWallId: action.payload,
          selectedCabinetId: null,
          selectedOpeningId: null,
        },
      };

    case 'UPDATE_ROOM_NAME':
      return {
        ...state,
        room: { ...state.room, name: action.payload, updatedAt: now },
        isDirty: true,
      };

    case 'UPDATE_GRID_SIZE':
      return {
        ...state,
        room: { ...state.room, gridSize: action.payload, updatedAt: now },
        isDirty: true,
      };

    case 'UPDATE_DIMENSIONS':
      return {
        ...state,
        room: {
          ...state.room,
          dimensions: { ...state.room.dimensions, ...action.payload },
          updatedAt: now,
        },
        isDirty: true,
      };

    case 'ADD_APPLIANCE_CUTOUT': {
      const placedCabinets = state.room.placedCabinets.map(c =>
        c.id === action.payload.cabinetId
          ? { ...c, applianceCutouts: [...c.applianceCutouts, action.payload.cutout] }
          : c
      );
      return {
        ...state,
        room: { ...state.room, placedCabinets, updatedAt: now },
        isDirty: true,
      };
    }

    case 'REMOVE_APPLIANCE_CUTOUT': {
      const placedCabinets = state.room.placedCabinets.map(c =>
        c.id === action.payload.cabinetId
          ? {
              ...c,
              applianceCutouts: c.applianceCutouts.filter(
                a => a.id !== action.payload.cutoutId
              ),
            }
          : c
      );
      return {
        ...state,
        room: { ...state.room, placedCabinets, updatedAt: now },
        isDirty: true,
      };
    }

    default:
      return state;
  }
}

export function useFloorPlan(initialRoom?: Room) {
  const [state, dispatch] = useReducer(floorPlanReducer, {
    room: initialRoom ?? createDefaultRoom(),
    selection: { selectedWallId: null, selectedCabinetId: null, selectedOpeningId: null },
    isDirty: false,
  });

  const addWall = useCallback(
    (start: Point2D, end: Point2D, thickness = 200, height = 2400) => {
      const wall: Wall = {
        id: generateId(),
        startPoint: start,
        endPoint: end,
        thickness,
        height,
        openings: [],
      };
      dispatch({ type: 'ADD_WALL', payload: wall });
      return wall;
    },
    []
  );

  const updateWall = useCallback((wall: Wall) => {
    dispatch({ type: 'UPDATE_WALL', payload: wall });
  }, []);

  const deleteWall = useCallback((wallId: string) => {
    dispatch({ type: 'DELETE_WALL', payload: wallId });
  }, []);

  const addOpening = useCallback(
    (wallId: string, opening: Omit<WallOpening, 'id'>) => {
      const full: WallOpening = { ...opening, id: generateId() };
      dispatch({ type: 'ADD_OPENING', payload: { wallId, opening: full } });
      return full;
    },
    []
  );

  const updateOpening = useCallback((wallId: string, opening: WallOpening) => {
    dispatch({ type: 'UPDATE_OPENING', payload: { wallId, opening } });
  }, []);

  const deleteOpening = useCallback((wallId: string, openingId: string) => {
    dispatch({ type: 'DELETE_OPENING', payload: { wallId, openingId } });
  }, []);

  const placeCabinet = useCallback(
    (template: CabinetTemplate, position: Point2D, rotation = 0): PlacedCabinet => {
      const cabinet: PlacedCabinet = {
        id: generateId(),
        templateId: template.id,
        label: template.name,
        position,
        rotation,
        width: template.width,
        depth: template.depth,
        height: template.height,
        color: template.color,
        applianceCutouts: [],
        isSelected: false,
      };
      dispatch({ type: 'ADD_CABINET', payload: cabinet });
      return cabinet;
    },
    []
  );

  const updateCabinet = useCallback((cabinet: PlacedCabinet) => {
    dispatch({ type: 'UPDATE_CABINET', payload: cabinet });
  }, []);

  const deleteCabinet = useCallback((cabinetId: string) => {
    dispatch({ type: 'DELETE_CABINET', payload: cabinetId });
  }, []);

  const moveCabinet = useCallback((id: string, position: Point2D) => {
    dispatch({ type: 'MOVE_CABINET', payload: { id, position } });
  }, []);

  const rotateCabinet = useCallback((id: string, rotation: number) => {
    dispatch({ type: 'ROTATE_CABINET', payload: { id, rotation } });
  }, []);

  const selectCabinet = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_CABINET', payload: id });
  }, []);

  const selectWall = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_WALL', payload: id });
  }, []);

  const updateRoomName = useCallback((name: string) => {
    dispatch({ type: 'UPDATE_ROOM_NAME', payload: name });
  }, []);

  const updateGridSize = useCallback((size: number) => {
    dispatch({ type: 'UPDATE_GRID_SIZE', payload: size });
  }, []);

  const updateDimensions = useCallback((dims: Partial<RoomDimensions>) => {
    dispatch({ type: 'UPDATE_DIMENSIONS', payload: dims });
  }, []);

  const addApplianceCutout = useCallback(
    (cabinetId: string, cutout: Omit<ApplianceCutout, 'id'>) => {
      const full: ApplianceCutout = { ...cutout, id: generateId() };
      dispatch({ type: 'ADD_APPLIANCE_CUTOUT', payload: { cabinetId, cutout: full } });
      return full;
    },
    []
  );

  const removeApplianceCutout = useCallback((cabinetId: string, cutoutId: string) => {
    dispatch({ type: 'REMOVE_APPLIANCE_CUTOUT', payload: { cabinetId, cutoutId } });
  }, []);

  const setRoom = useCallback((room: Room) => {
    dispatch({ type: 'SET_ROOM', payload: room });
  }, []);

  const computedDimensions = computeRoomDimensions(state.room.walls);

  const selectedCabinet = state.room.placedCabinets.find(
    c => c.id === state.selection.selectedCabinetId
  ) ?? null;

  const selectedWall = state.room.walls.find(
    w => w.id === state.selection.selectedWallId
  ) ?? null;

  return {
    room: state.room,
    selection: state.selection,
    isDirty: state.isDirty,
    computedDimensions,
    selectedCabinet,
    selectedWall,
    // actions
    addWall,
    updateWall,
    deleteWall,
    addOpening,
    updateOpening,
    deleteOpening,
    placeCabinet,
    updateCabinet,
    deleteCabinet,
    moveCabinet,
    rotateCabinet,
    selectCabinet,
    selectWall,
    updateRoomName,
    updateGridSize,
    updateDimensions,
    addApplianceCutout,
    removeApplianceCutout,
    setRoom,
  };
}

// ─────────────────────────────────────────────
//  useCanvasInteraction
// ─────────────────────────────────────────────

const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const ZOOM_STEP = 0.15;

export function useCanvasInteraction(gridSize: number, walls: Wall[]) {
  const [transform, setTransform] = useState<ViewTransform>({
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  });
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragItem: null,
    startMousePos: null,
    startItemPos: null,
  });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<Point2D | null>(null);
  const panOrigin = useRef<ViewTransform | null>(null);

  /** Convert screen px → world mm */
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): Point2D => ({
      x: (screenX - transform.offsetX) / transform.scale,
      y: (screenY - transform.offsetY) / transform.scale,
    }),
    [transform]
  );

  /** Convert world mm → screen px */
  const worldToScreen = useCallback(
    (worldX: number, worldY: number): Point2D => ({
      x: worldX * transform.scale + transform.offsetX,
      y: worldY * transform.scale + transform.offsetY,
    }),
    [transform]
  );

  const snapToGrid = useCallback(
    (point: Point2D): SnapResult => {
      const snapped = snapPointToGrid(point, gridSize);
      const wallSnap = pointToWallSnap(snapped, walls, gridSize / 2);
      return wallSnap ?? { point: snapped, snappedToGrid: true, snappedToWall: false };
    },
    [gridSize, walls]
  );

  const zoomIn = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      scale: Math.min(prev.scale * (1 + ZOOM_STEP), MAX_SCALE),
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setTransform(prev => ({
      ...prev,
      scale: Math.max(prev.scale * (1 - ZOOM_STEP), MIN_SCALE),
    }));
  }, []);

  const resetZoom = useCallback(() => {
    setTransform({ offsetX: 0, offsetY: 0, scale: 1 });
  }, []);

  const setScale = useCallback((scale: number) => {
    setTransform(prev => ({
      ...prev,
      scale: Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE),
    }));
  }, []);

  /** Zoom toward a focal point (e.g., mouse position during wheel event) */
  const zoomAtPoint = useCallback((delta: number, focalX: number, focalY: number) => {
    setTransform(prev => {
      const factor = delta > 0 ? 1 + ZOOM_STEP : 1 - ZOOM_STEP;
      const newScale = Math.min(Math.max(prev.scale * factor, MIN_SCALE), MAX_SCALE);
      const scaleRatio = newScale / prev.scale;
      return {
        scale: newScale,
        offsetX: focalX - scaleRatio * (focalX - prev.offsetX),
        offsetY: focalY - scaleRatio * (focalY - prev.offsetY),
      };
    });
  }, []);

  const startPan = useCallback((x: number, y: number) => {
    setIsPanning(true);
    panStart.current = { x, y };
    panOrigin.current = null;
    setTransform(prev => {
      panOrigin.current = prev;
      return prev;
    });
  }, []);

  const updatePan = useCallback((x: number, y: number) => {
    if (!panStart.current || !panOrigin.current) return;
    const dx = x - panStart.current.x;
    const dy = y - panStart.current.y;
    setTransform({
      ...panOrigin.current,
      offsetX: panOrigin.current.offsetX + dx,
      offsetY: panOrigin.current.offsetY + dy,
    });
  }, []);

  const endPan = useCallback(() => {
    setIsPanning(false);
    panStart.current = null;
    panOrigin.current = null;
  }, []);

  const startDrag = useCallback((item: PlacedCabinet, mouseX: number, mouseY: number) => {
    setDragState({
      isDragging: true,
      dragItem: item,
      startMousePos: { x: mouseX, y: mouseY },
      startItemPos: { ...item.position },
    });
  }, []);

  const updateDrag = useCallback(
    (mouseX: number, mouseY: number): Point2D | null => {
      if (!dragState.isDragging || !dragState.startMousePos || !dragState.startItemPos) {
        return null;
      }
      const dx = (mouseX - dragState.startMousePos.x) / transform.scale;
      const dy = (mouseY - dragState.startMousePos.y) / transform.scale;
      const raw: Point2D = {
        x: dragState.startItemPos.x + dx,
        y: dragState.startItemPos.y + dy,
      };
      return snapPointToGrid(raw, gridSize).point;
    },
    [dragState, transform.scale, gridSize]
  );

  const endDrag = useCallback(() => {
    setDragState({
      isDragging: false,
      dragItem: null,
      startMousePos: null,
      startItemPos: null,
    });
  }, []);

  return {
    transform,
    dragState,
    isPanning,
    screenToWorld,
    worldToScreen,
    snapToGrid,
    zoomIn,
    zoomOut,
    resetZoom,
    setScale,
    zoomAtPoint,
    startPan,
    updatePan,
    endPan,
    startDrag,
    updateDrag,
    endDrag,
  };
}

// ─────────────────────────────────────────────
//  useWallEditor
// ─────────────────────────────────────────────

export function useWallEditor(
  addWall: (start: Point2D, end: Point2D, thickness?: number, height?: number) => Wall,
  snapToGrid: (p: Point2D) => SnapResult
) {
  const [drawState, setDrawState] = useState<WallDrawState>({
    isDrawing: false,
    startPoint: null,
    currentPoint: null,
  });

  const startWall = useCallback(
    (screenPoint: Point2D) => {
      const snap = snapToGrid(screenPoint);
      setDrawState({
        isDrawing: true,
        startPoint: snap.point,
        currentPoint: snap.point,
      });
    },
    [snapToGrid]
  );

  const updateWallPreview = useCallback(
    (screenPoint: Point2D) => {
      if (!drawState.isDrawing) return;
      const snap = snapToGrid(screenPoint);
      setDrawState(prev => ({ ...prev, currentPoint: snap.point }));
    },
    [drawState.isDrawing, snapToGrid]
  );

  const finishWall = useCallback(
    (thickness = 200, height = 2400): Wall | null => {
      if (
        !drawState.isDrawing ||
        !drawState.startPoint ||
        !drawState.currentPoint
      ) {
        return null;
      }

      const dx = drawState.currentPoint.x - drawState.startPoint.x;
      const dy = drawState.currentPoint.y - drawState.startPoint.y;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length < 10) {
        // too short – cancel
        setDrawState({ isDrawing: false, startPoint: null, currentPoint: null });
        return null;
      }

      const wall = addWall(drawState.startPoint, drawState.currentPoint, thickness, height);
      setDrawState({ isDrawing: false, startPoint: null, currentPoint: null });
      return wall;
    },
    [drawState, addWall]
  );

  const cancelWall = useCallback(() => {
    setDrawState({ isDrawing: false, startPoint: null, currentPoint: null });
  }, []);

  /** Compute preview line length in mm */
  const previewLength = (() => {
    if (!drawState.startPoint || !drawState.currentPoint) return 0;
    const dx = drawState.currentPoint.x - drawState.startPoint.x;
    const dy = drawState.currentPoint.y - drawState.startPoint.y;
    return Math.round(Math.sqrt(dx * dx + dy * dy));
  })();

  return {
    drawState,
    previewLength,
    startWall,
    updateWallPreview,
    finishWall,
    cancelWall,
  };
}
