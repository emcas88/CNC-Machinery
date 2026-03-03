import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomsService } from '@/services/rooms';
import { productsService } from '@/services/products';
import { useDesignStore } from '@/store/designStore';
import { useAppStore } from '@/store/appStore';
import type { Room, Product } from '@/types';

/* ───────── constants ───────── */
const GRID_SIZE = 20; // px per grid cell
const SNAP_THRESHOLD = 10;
const CANVAS_W = 1200;
const CANVAS_H = 800;

type Tool = 'select' | 'wall' | 'dimension' | 'pan';

interface WallPoint { x: number; y: number }
interface Wall { points: WallPoint[] }

interface CanvasObject {
  id: string;
  type: 'product' | 'wall';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  name: string;
  data?: Product;
}

/* ───────── snap helper ───────── */
const snapToGrid = (v: number): number => Math.round(v / GRID_SIZE) * GRID_SIZE;

/* ═══════════════════════════════════════════ */
export default function RoomDesigner() {
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* ── stores ── */
  const currentRoom = useAppStore((s) => s.currentRoom);
  const selectedProduct = useAppStore((s) => s.selectedProduct);
  const {
    products: storeProducts,
    addProduct,
    updateProduct: storeUpdateProduct,
    removeProduct,
    selectProduct,
    moveProduct: storeMoveProduct,
    rotateProduct: storeRotateProduct,
    undo,
    redo,
  } = useDesignStore();

  /* ── local state ── */
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [wallPoints, setWallPoints] = useState<WallPoint[]>([]);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingDimension, setEditingDimension] = useState<{ id: string; field: 'width' | 'height' } | null>(null);
  const [dimensionValue, setDimensionValue] = useState('');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [searchFilter, setSearchFilter] = useState('');

  const roomId = currentRoom ?? '';

  /* ── queries ── */
  const {
    data: room,
    isLoading: roomLoading,
    error: roomError,
  } = useQuery<Room>({
    queryKey: ['room', roomId],
    queryFn: () => roomsService.getRoom(roomId),
    enabled: !!roomId,
  });

  const {
    data: products = [],
    isLoading: productsLoading,
    error: productsError,
  } = useQuery<Product[]>({
    queryKey: ['products', roomId],
    queryFn: () => productsService.getProducts({ roomId }),
    enabled: !!roomId,
  });

  /* seed design store when products arrive */
  useEffect(() => {
    if (products.length) {
      products.forEach((p) => {
        if (!storeProducts.find((sp) => sp.id === p.id)) addProduct(p);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  /* ── mutations ── */
  const saveRoomMutation = useMutation({
    mutationFn: (data: Partial<Room>) => roomsService.updateRoom(roomId, data),
    onMutate: () => setSaveStatus('saving'),
    onSuccess: () => {
      setSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: ['room', roomId] });
    },
    onError: () => setSaveStatus('unsaved'),
  });

  const addProductMutation = useMutation({
    mutationFn: (data: Partial<Product>) => productsService.createProduct(data as Product),
    onSuccess: (created) => {
      addProduct(created);
      queryClient.invalidateQueries({ queryKey: ['products', roomId] });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      productsService.updateProduct(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', roomId] }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => productsService.deleteProduct(id),
    onSuccess: (_, id) => {
      removeProduct(id);
      queryClient.invalidateQueries({ queryKey: ['products', roomId] });
    },
  });

  const moveProductMutation = useMutation({
    mutationFn: ({ id, x, y }: { id: string; x: number; y: number }) =>
      productsService.moveProduct(id, { x, y, z: 0 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', roomId] }),
  });

  const rotateProductMutation = useMutation({
    mutationFn: ({ id, angle }: { id: string; angle: number }) =>
      productsService.rotateProduct(id, angle),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', roomId] }),
  });

  /* ── derived canvas objects ── */
  const canvasObjects = useMemo<CanvasObject[]>(
    () =>
      storeProducts.map((p) => ({
        id: p.id,
        type: 'product' as const,
        x: (p as any).x ?? 100,
        y: (p as any).y ?? 100,
        width: (p as any).width ?? 80,
        height: (p as any).height ?? 40,
        rotation: (p as any).rotation ?? 0,
        name: p.name ?? 'Product',
        data: p,
      })),
    [storeProducts],
  );

  /* ── auto-save debounce ── */
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const triggerAutoSave = useCallback(() => {
    if (!autoSaveEnabled || !roomId) return;
    setSaveStatus('unsaved');
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveRoomMutation.mutate({
        id: roomId,
        layout: { walls, products: canvasObjects } as any,
      } as any);
    }, 2000);
  }, [autoSaveEnabled, roomId, walls, canvasObjects, saveRoomMutation]);

  /* ── canvas drawing ── */
  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const w = CANVAS_W;
    const h = CANVAS_H;
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // walls
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 4;
    walls.forEach((wall) => {
      if (wall.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(wall.points[0].x, wall.points[0].y);
      wall.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });

    // in-progress wall
    if (activeTool === 'wall' && wallPoints.length) {
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(wallPoints[0].x, wallPoints[0].y);
      wallPoints.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // objects
    canvasObjects.forEach((obj) => {
      ctx.save();
      ctx.translate(obj.x + obj.width / 2, obj.y + obj.height / 2);
      ctx.rotate((obj.rotation * Math.PI) / 180);
      const isSelected = selectedProduct === obj.id;
      ctx.fillStyle = isSelected ? '#0e7490' : '#1e3a5f';
      ctx.strokeStyle = isSelected ? '#06b6d4' : '#38bdf8';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.fillRect(-obj.width / 2, -obj.height / 2, obj.width, obj.height);
      ctx.strokeRect(-obj.width / 2, -obj.height / 2, obj.width, obj.height);
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(obj.name, 0, 4);

      // dimensions
      ctx.fillStyle = '#9ca3af';
      ctx.font = '9px sans-serif';
      ctx.fillText(`${obj.width}×${obj.height}`, 0, obj.height / 2 + 12);
      ctx.restore();
    });
  }, [canvasObjects, walls, wallPoints, activeTool, selectedProduct]);

  useEffect(() => { draw(); }, [draw]);

  /* ── hit test ── */
  const hitTest = (mx: number, my: number): CanvasObject | null => {
    for (let i = canvasObjects.length - 1; i >= 0; i--) {
      const o = canvasObjects[i];
      if (mx >= o.x && mx <= o.x + o.width && my >= o.y && my <= o.y + o.height) return o;
    }
    return null;
  };

  /* ── canvas events ── */
  const getCanvasPos = (e: React.MouseEvent): { x: number; y: number } => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    if (activeTool === 'select') {
      const hit = hitTest(pos.x, pos.y);
      if (hit) {
        selectProduct(hit.id);
        setDragTarget(hit.id);
        setDragOffset({ x: pos.x - hit.x, y: pos.y - hit.y });
      } else {
        selectProduct(null as any);
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (activeTool === 'select' && dragTarget) {
      const pos = getCanvasPos(e);
      const nx = snapToGrid(pos.x - dragOffset.x);
      const ny = snapToGrid(pos.y - dragOffset.y);
      storeMoveProduct(dragTarget, { x: nx, y: ny, z: 0 });
    }
  };

  const handleCanvasMouseUp = () => {
    if (dragTarget) {
      const obj = canvasObjects.find((o) => o.id === dragTarget);
      if (obj) {
        moveProductMutation.mutate({ id: dragTarget, x: obj.x, y: obj.y });
        triggerAutoSave();
      }
      setDragTarget(null);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    if (activeTool === 'wall') {
      setWallPoints((prev) => [...prev, { x: snapToGrid(pos.x), y: snapToGrid(pos.y) }]);
    }
    if (activeTool === 'dimension') {
      const hit = hitTest(pos.x, pos.y);
      if (hit) {
        setEditingDimension({ id: hit.id, field: 'width' });
        setDimensionValue(String(hit.width));
      }
    }
  };

  const handleCanvasDoubleClick = () => {
    if (activeTool === 'wall' && wallPoints.length >= 2) {
      setWalls((prev) => [...prev, { points: [...wallPoints] }]);
      setWallPoints([]);
      triggerAutoSave();
    }
  };

  /* ── drag-and-drop from library ── */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    const product = JSON.parse(data);
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = snapToGrid(e.clientX - rect.left);
    const y = snapToGrid(e.clientY - rect.top);
    addProductMutation.mutate({ ...product, roomId, x, y });
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  /* ── dimension submit ── */
  const handleDimensionSubmit = () => {
    if (!editingDimension) return;
    const val = parseInt(dimensionValue, 10);
    if (isNaN(val) || val <= 0) return;
    storeUpdateProduct(editingDimension.id, { [editingDimension.field]: val } as any);
    updateProductMutation.mutate({
      id: editingDimension.id,
      data: { [editingDimension.field]: val } as any,
    });
    setEditingDimension(null);
    triggerAutoSave();
  };

  /* ── manual save ── */
  const handleManualSave = () => {
    saveRoomMutation.mutate({
      id: roomId,
      layout: { walls, products: canvasObjects } as any,
    } as any);
  };

  /* ── delete selected ── */
  const handleDeleteSelected = () => {
    if (selectedProduct) deleteProductMutation.mutate(selectedProduct);
  };

  /* ── rotate selected ── */
  const handleRotateSelected = () => {
    if (!selectedProduct) return;
    const obj = canvasObjects.find((o) => o.id === selectedProduct);
    const newAngle = ((obj?.rotation ?? 0) + 90) % 360;
    storeRotateProduct(selectedProduct, newAngle);
    rotateProductMutation.mutate({ id: selectedProduct, angle: newAngle });
    triggerAutoSave();
  };

  /* ── selected object for properties panel ── */
  const selectedObj = canvasObjects.find((o) => o.id === selectedProduct);

  /* ── product library (drag source) ── */
  const libraryProducts = useMemo(
    () => products.filter((p) => p.name?.toLowerCase().includes(searchFilter.toLowerCase())),
    [products, searchFilter],
  );

  /* ── loading / error ── */
  if (!roomId)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-400" data-testid="no-room">
        No room selected. Please select a room to start designing.
      </div>
    );

  if (roomLoading || productsLoading)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white" data-testid="loading">
        <svg className="animate-spin h-8 w-8 mr-3 text-cyan-400" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Loading room…
      </div>
    );

  if (roomError || productsError)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-red-400" data-testid="error">
        Failed to load room data. Please try again.
      </div>
    );

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* ── left: product library ── */}
      <aside className="w-60 bg-gray-800 border-r border-gray-700 flex flex-col">
        <h2 className="px-4 py-3 text-sm font-semibold text-cyan-400 border-b border-gray-700">Product Library</h2>
        <input
          type="text"
          placeholder="Search products…"
          className="mx-2 mt-2 px-2 py-1 text-sm rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          data-testid="library-search"
        />
        <ul className="flex-1 overflow-y-auto mt-2" data-testid="product-library">
          {libraryProducts.length === 0 && (
            <li className="px-4 py-2 text-gray-500 text-sm" data-testid="library-empty">No products found</li>
          )}
          {libraryProducts.map((p) => (
            <li
              key={p.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify(p))}
              className="px-4 py-2 text-sm hover:bg-gray-700 cursor-grab"
              data-testid={`library-item-${p.id}`}
            >
              {p.name}
            </li>
          ))}
        </ul>
      </aside>

      {/* ── center ── */}
      <main className="flex-1 flex flex-col">
        {/* toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700" data-testid="toolbar">
          {(['select', 'wall', 'dimension', 'pan'] as Tool[]).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTool(t)}
              className={`px-3 py-1 text-sm rounded ${activeTool === t ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              data-testid={`tool-${t}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          <span className="w-px h-6 bg-gray-600 mx-1" />
          <button onClick={undo} className="px-3 py-1 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600" data-testid="undo-btn">Undo</button>
          <button onClick={redo} className="px-3 py-1 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600" data-testid="redo-btn">Redo</button>
          <span className="w-px h-6 bg-gray-600 mx-1" />
          <button onClick={handleRotateSelected} disabled={!selectedProduct} className="px-3 py-1 text-sm rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40" data-testid="rotate-btn">Rotate</button>
          <button onClick={handleDeleteSelected} disabled={!selectedProduct} className="px-3 py-1 text-sm rounded bg-red-700 text-white hover:bg-red-600 disabled:opacity-40" data-testid="delete-btn">Delete</button>
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-400">
              <input type="checkbox" checked={autoSaveEnabled} onChange={(e) => setAutoSaveEnabled(e.target.checked)} data-testid="autosave-toggle" />
              Auto-save
            </label>
            <button onClick={handleManualSave} className="px-3 py-1 text-sm rounded bg-cyan-600 text-white hover:bg-cyan-500" data-testid="save-btn">
              {saveRoomMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <span className="text-xs text-gray-500" data-testid="save-status">{saveStatus}</span>
          </div>
        </div>

        {/* canvas */}
        <div className="flex-1 overflow-auto p-4">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="bg-gray-950 rounded border border-gray-700 cursor-crosshair"
            data-testid="design-canvas"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onClick={handleCanvasClick}
            onDoubleClick={handleCanvasDoubleClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          />
        </div>

        {/* room info bar */}
        <div className="px-4 py-1 bg-gray-800 border-t border-gray-700 text-xs text-gray-400 flex gap-4" data-testid="room-info">
          <span>Room: {room?.name ?? '—'}</span>
          <span>Objects: {canvasObjects.length}</span>
          <span>Walls: {walls.length}</span>
          <span>Tool: {activeTool}</span>
        </div>
      </main>

      {/* ── right: properties panel ── */}
      <aside className="w-72 bg-gray-800 border-l border-gray-700 flex flex-col" data-testid="properties-panel">
        <h2 className="px-4 py-3 text-sm font-semibold text-cyan-400 border-b border-gray-700">Properties</h2>
        {!selectedObj ? (
          <p className="px-4 py-4 text-sm text-gray-500" data-testid="no-selection">Select an object to view properties</p>
        ) : (
          <div className="p-4 space-y-3 text-sm overflow-y-auto flex-1">
            <div>
              <label className="block text-gray-400 mb-1">Name</label>
              <input
                className="w-full px-2 py-1 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                value={selectedObj.name}
                onChange={(e) => {
                  storeUpdateProduct(selectedObj.id, { name: e.target.value } as any);
                  triggerAutoSave();
                }}
                data-testid="prop-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-400 mb-1">X</label>
                <input
                  type="number"
                  className="w-full px-2 py-1 rounded bg-gray-700 border border-gray-600"
                  value={selectedObj.x}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    storeMoveProduct(selectedObj.id, { x: v, y: selectedObj.y, z: 0 });
                    triggerAutoSave();
                  }}
                  data-testid="prop-x"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Y</label>
                <input
                  type="number"
                  className="w-full px-2 py-1 rounded bg-gray-700 border border-gray-600"
                  value={selectedObj.y}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    storeMoveProduct(selectedObj.id, { x: selectedObj.x, y: v, z: 0 });
                    triggerAutoSave();
                  }}
                  data-testid="prop-y"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-400 mb-1">Width</label>
                <input
                  type="number"
                  className="w-full px-2 py-1 rounded bg-gray-700 border border-gray-600"
                  value={selectedObj.width}
                  onChange={(e) => {
                    storeUpdateProduct(selectedObj.id, { width: Number(e.target.value) } as any);
                    triggerAutoSave();
                  }}
                  data-testid="prop-width"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Height</label>
                <input
                  type="number"
                  className="w-full px-2 py-1 rounded bg-gray-700 border border-gray-600"
                  value={selectedObj.height}
                  onChange={(e) => {
                    storeUpdateProduct(selectedObj.id, { height: Number(e.target.value) } as any);
                    triggerAutoSave();
                  }}
                  data-testid="prop-height"
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Rotation (°)</label>
              <input
                type="number"
                className="w-full px-2 py-1 rounded bg-gray-700 border border-gray-600"
                value={selectedObj.rotation}
                onChange={(e) => {
                  storeRotateProduct(selectedObj.id, Number(e.target.value));
                  triggerAutoSave();
                }}
                data-testid="prop-rotation"
              />
            </div>
            <button
              onClick={handleDeleteSelected}
              className="w-full mt-2 px-3 py-2 rounded bg-red-700 text-white hover:bg-red-600 text-sm"
              data-testid="prop-delete"
            >
              Delete Object
            </button>
          </div>
        )}
      </aside>

      {/* ── dimension editing modal ── */}
      {editingDimension && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" data-testid="dimension-modal">
          <div className="bg-gray-800 rounded-lg p-6 w-80">
            <h3 className="text-lg font-semibold mb-4">Edit {editingDimension.field}</h3>
            <input
              type="number"
              className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              value={dimensionValue}
              onChange={(e) => setDimensionValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleDimensionSubmit()}
              data-testid="dimension-input"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditingDimension(null)} className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 text-sm" data-testid="dimension-cancel">Cancel</button>
              <button onClick={handleDimensionSubmit} className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-sm" data-testid="dimension-save">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
