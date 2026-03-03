import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { constructionMethodsService } from '@/services/construction-methods';
import type { ConstructionMethod, CreateConstructionMethod } from '@/types';
import { JoiningMethod, BackPanelStyle, BottomPanelStyle } from '@/types';

const JOINING_METHODS = Object.values(JoiningMethod);
const BACK_PANEL_STYLES = Object.values(BackPanelStyle);
const BOTTOM_PANEL_STYLES = Object.values(BottomPanelStyle);

const JOINING_LABELS: Record<JoiningMethod, string> = {
  [JoiningMethod.DOWEL]: 'Dowel',
  [JoiningMethod.CAM_LOCK]: 'Cam Lock',
  [JoiningMethod.BISCUIT]: 'Biscuit',
  [JoiningMethod.SCREW]: 'Screw',
  [JoiningMethod.DOMINO]: 'Domino',
  [JoiningMethod.RABBET]: 'Rabbet',
  [JoiningMethod.POCKET_SCREW]: 'Pocket Screw',
};

const BACK_PANEL_LABELS: Record<BackPanelStyle, string> = {
  [BackPanelStyle.DADO]: 'Dado',
  [BackPanelStyle.RABBET]: 'Rabbet',
  [BackPanelStyle.SURFACE_MOUNT]: 'Surface Mount',
  [BackPanelStyle.NONE]: 'None',
};

const BOTTOM_PANEL_LABELS: Record<BottomPanelStyle, string> = {
  [BottomPanelStyle.DADO]: 'Dado',
  [BottomPanelStyle.SURFACE_MOUNT]: 'Surface Mount',
  [BottomPanelStyle.RABBET]: 'Rabbet',
};

const DEFAULT_METHOD: CreateConstructionMethod = {
  name: '',
  description: '',
  joiningMethod: JoiningMethod.DOWEL,
  backPanel: BackPanelStyle.DADO,
  bottomPanel: BottomPanelStyle.DADO,
  caseThickness: 18,
  backThickness: 6,
  insetDepth: 3,
  overlap: 0,
  blumSystemHole: false,
  systemHoleSpacing: 32,
  notes: '',
};

export default function ConstructionMethods() {
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<CreateConstructionMethod>({ ...DEFAULT_METHOD });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // ── Queries ──
  const {
    data: methods = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['construction-methods'],
    queryFn: () => constructionMethodsService.getConstructionMethods(),
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: CreateConstructionMethod) =>
      constructionMethodsService.createConstructionMethod(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['construction-methods'] });
      setSelectedId(created.id);
      setIsCreating(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateConstructionMethod> }) =>
      constructionMethodsService.updateConstructionMethod(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['construction-methods'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => constructionMethodsService.deleteConstructionMethod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['construction-methods'] });
      setSelectedId(null);
      setFormData({ ...DEFAULT_METHOD });
      setShowDeleteConfirm(false);
    },
  });

  // ── Handlers ──
  const selectMethod = useCallback((method: ConstructionMethod) => {
    setSelectedId(method.id);
    setIsCreating(false);
    setShowDeleteConfirm(false);
    setFormData({
      name: method.name,
      description: method.description || '',
      joiningMethod: method.joiningMethod,
      backPanel: method.backPanel,
      bottomPanel: method.bottomPanel,
      caseThickness: method.caseThickness,
      backThickness: method.backThickness,
      insetDepth: method.insetDepth,
      overlap: method.overlap,
      blumSystemHole: method.blumSystemHole,
      systemHoleSpacing: method.systemHoleSpacing,
      notes: method.notes || '',
    });
  }, []);

  const handleNewMethod = () => {
    setSelectedId(null);
    setIsCreating(true);
    setFormData({ ...DEFAULT_METHOD });
    setShowDeleteConfirm(false);
  };

  const handleFieldChange = (field: keyof CreateConstructionMethod, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNumericChange = (field: keyof CreateConstructionMethod, raw: string) => {
    const val = parseFloat(raw);
    if (!isNaN(val)) {
      handleFieldChange(field, val);
    } else if (raw === '') {
      handleFieldChange(field, 0);
    }
  };

  const handleSave = () => {
    if (isCreating) {
      createMutation.mutate(formData);
    } else if (selectedId) {
      updateMutation.mutate({ id: selectedId, data: formData });
    }
  };

  const handleSetDefault = () => {
    if (selectedId) {
      updateMutation.mutate({ id: selectedId, data: { ...formData, isDefault: true } as any });
    }
  };

  const handleDelete = () => {
    if (selectedId) {
      deleteMutation.mutate(selectedId);
    }
  };

  // ── Filter ──
  const filteredMethods = methods.filter(
    (m: ConstructionMethod) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.description || '').toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectedMethod = methods.find((m: ConstructionMethod) => m.id === selectedId);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading construction methods…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-6 max-w-md text-center">
          <p className="text-red-400 font-medium mb-2">Failed to load construction methods</p>
          <p className="text-red-300 text-sm">{(error as Error)?.message || 'Unknown error'}</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['construction-methods'] })}
            className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* ── Sidebar ── */}
      <aside className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Methods</h2>
            <button
              onClick={handleNewMethod}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded transition-colors"
              aria-label="New construction method"
            >
              + New
            </button>
          </div>
          <input
            type="text"
            placeholder="Search methods…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredMethods.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              {methods.length === 0 ? 'No methods yet' : 'No matching methods'}
            </div>
          ) : (
            filteredMethods.map((method: ConstructionMethod) => (
              <button
                key={method.id}
                onClick={() => selectMethod(method)}
                className={`w-full text-left p-3 border-b border-gray-700 hover:bg-gray-700 transition-colors ${
                  selectedId === method.id ? 'bg-gray-700 border-l-2 border-l-cyan-400' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{method.name}</span>
                  {method.isDefault && (
                    <span className="px-1.5 py-0.5 bg-cyan-900 text-cyan-300 text-xs rounded">
                      Default
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {JOINING_LABELS[method.joiningMethod]} · {method.caseThickness}mm
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ── Main Panel ── */}
      <main className="flex-1 overflow-y-auto">
        {!selectedId && !isCreating ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">Select a method or create a new one</p>
              <button
                onClick={handleNewMethod}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
              >
                + New Construction Method
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 max-w-3xl">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">
                {isCreating ? 'New Construction Method' : 'Edit Construction Method'}
              </h1>
              <div className="flex gap-2">
                {!isCreating && selectedId && (
                  <>
                    {!selectedMethod?.isDefault && (
                      <button
                        onClick={handleSetDefault}
                        disabled={updateMutation.isPending}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-cyan-400 text-sm rounded transition-colors"
                      >
                        Set as Default
                      </button>
                    )}
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-2 bg-red-900/50 hover:bg-red-800 text-red-400 text-sm rounded transition-colors"
                    >
                      Delete
                    </button>
                  </>
                )}
                <button
                  onClick={handleSave}
                  disabled={isSaving || !formData.name}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                >
                  {isSaving ? 'Saving…' : isCreating ? 'Create Method' : 'Save Method'}
                </button>
              </div>
            </div>

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
              <div className="mb-4 p-4 bg-red-900/30 border border-red-700 rounded-lg">
                <p className="text-red-300 mb-3">
                  Are you sure you want to delete this method? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-sm rounded"
                  >
                    {deleteMutation.isPending ? 'Deleting…' : 'Confirm Delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Mutation errors */}
            {(createMutation.isError || updateMutation.isError || deleteMutation.isError) && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
                {(createMutation.error as Error)?.message ||
                  (updateMutation.error as Error)?.message ||
                  (deleteMutation.error as Error)?.message ||
                  'An error occurred'}
              </div>
            )}

            {/* ── Form ── */}
            <div className="space-y-6">
              {/* Name & Description */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    placeholder="Method name"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description || ''}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    placeholder="Brief description"
                  />
                </div>
              </div>

              {/* Joining & Panel Styles */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Joining Method</label>
                  <select
                    value={formData.joiningMethod}
                    onChange={(e) =>
                      handleFieldChange('joiningMethod', e.target.value as JoiningMethod)
                    }
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    {JOINING_METHODS.map((jm) => (
                      <option key={jm} value={jm}>
                        {JOINING_LABELS[jm]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Back Panel Style</label>
                  <select
                    value={formData.backPanel}
                    onChange={(e) =>
                      handleFieldChange('backPanel', e.target.value as BackPanelStyle)
                    }
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    {BACK_PANEL_STYLES.map((bp) => (
                      <option key={bp} value={bp}>
                        {BACK_PANEL_LABELS[bp]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Bottom Panel Style</label>
                  <select
                    value={formData.bottomPanel}
                    onChange={(e) =>
                      handleFieldChange('bottomPanel', e.target.value as BottomPanelStyle)
                    }
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    {BOTTOM_PANEL_STYLES.map((bp) => (
                      <option key={bp} value={bp}>
                        {BOTTOM_PANEL_LABELS[bp]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dimensions */}
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-3">Dimensions (mm)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Case Thickness</label>
                    <input
                      type="number"
                      value={formData.caseThickness}
                      onChange={(e) => handleNumericChange('caseThickness', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                      min={0}
                      step={0.5}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Back Thickness</label>
                    <input
                      type="number"
                      value={formData.backThickness}
                      onChange={(e) => handleNumericChange('backThickness', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                      min={0}
                      step={0.5}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Inset Depth</label>
                    <input
                      type="number"
                      value={formData.insetDepth}
                      onChange={(e) => handleNumericChange('insetDepth', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                      min={0}
                      step={0.5}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Overlap</label>
                    <input
                      type="number"
                      value={formData.overlap}
                      onChange={(e) => handleNumericChange('overlap', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                      min={0}
                      step={0.5}
                    />
                  </div>
                </div>
              </div>

              {/* Blum System Hole */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-300">Blum System Hole</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Enable system hole pattern for Blum hardware
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.blumSystemHole || false}
                      onChange={(e) => handleFieldChange('blumSystemHole', e.target.checked)}
                      className="sr-only peer"
                      role="switch"
                      aria-label="Toggle Blum system hole"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600" />
                  </label>
                </div>
                {formData.blumSystemHole && (
                  <div className="mt-3">
                    <label className="block text-xs text-gray-400 mb-1">
                      System Hole Spacing (mm)
                    </label>
                    <input
                      type="number"
                      value={formData.systemHoleSpacing}
                      onChange={(e) => handleNumericChange('systemHoleSpacing', e.target.value)}
                      className="w-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                      min={0}
                      step={1}
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500 resize-y"
                  placeholder="Additional notes…"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
