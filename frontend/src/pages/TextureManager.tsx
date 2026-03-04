import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { texturesService } from '@/services/textures';
import type { Texture, TextureGroup, CreateTexture } from '@/types';
import { Sheen, GrainOrientation } from '@/types';

const SHEEN_OPTIONS = Object.values(Sheen);
const GRAIN_OPTIONS = Object.values(GrainOrientation);

const SHEEN_LABELS: Record<Sheen, string> = {
  [Sheen.MATTE]: 'Matte',
  [Sheen.SATIN]: 'Satin',
  [Sheen.SEMI_GLOSS]: 'Semi Gloss',
  [Sheen.GLOSS]: 'Gloss',
  [Sheen.HIGH_GLOSS]: 'High Gloss',
};

const GRAIN_LABELS: Record<GrainOrientation, string> = {
  [GrainOrientation.NONE]: 'None',
  [GrainOrientation.HORIZONTAL]: 'Horizontal',
  [GrainOrientation.VERTICAL]: 'Vertical',
  [GrainOrientation.DIAGONAL]: 'Diagonal',
};

const GRAIN_ICONS: Record<GrainOrientation, string> = {
  [GrainOrientation.NONE]: '○',
  [GrainOrientation.HORIZONTAL]: '═',
  [GrainOrientation.VERTICAL]: '║',
  [GrainOrientation.DIAGONAL]: '╱',
};

const DEFAULT_CREATE: CreateTexture = {
  name: '',
  groupId: undefined,
  sheen: Sheen.MATTE,
  grainOrientation: GrainOrientation.NONE,
  color: '#8B7355',
  tags: [],
};

export default function TextureManager() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTexture, setEditingTexture] = useState<Texture | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Create / Edit form state
  const [formData, setFormData] = useState<CreateTexture>({ ...DEFAULT_CREATE });
  const [tagInput, setTagInput] = useState('');

  // Group form
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');

  // ── Queries ──
  const {
    data: textures = [],
    isLoading: texturesLoading,
    isError: texturesError,
    error: texturesErr,
  } = useQuery({
    queryKey: ['textures', { groupId: selectedGroupId, search: searchTerm || undefined }],
    queryFn: () =>
      texturesService.getTextures({
        groupId: selectedGroupId || undefined,
        search: searchTerm || undefined,
      }),
  });

  const {
    data: groups = [],
    isLoading: groupsLoading,
  } = useQuery({
    queryKey: ['texture-groups'],
    queryFn: texturesService.getGroups,
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: CreateTexture) => texturesService.createTexture(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['textures'] });
      queryClient.invalidateQueries({ queryKey: ['texture-groups'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTexture> }) =>
      texturesService.updateTexture(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['textures'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => texturesService.deleteTexture(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['textures'] });
      queryClient.invalidateQueries({ queryKey: ['texture-groups'] });
      setDeleteConfirmId(null);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => texturesService.uploadTexture(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['textures'] });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      texturesService.createGroup(name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['texture-groups'] });
      setShowGroupModal(false);
      setGroupName('');
      setGroupDesc('');
    },
  });

  // ── Handlers ──
  const closeModal = () => {
    setShowCreateModal(false);
    setEditingTexture(null);
    setFormData({ ...DEFAULT_CREATE });
    setTagInput('');
  };

  const openCreate = () => {
    setFormData({ ...DEFAULT_CREATE, groupId: selectedGroupId || undefined });
    setEditingTexture(null);
    setShowCreateModal(true);
  };

  const openEdit = (texture: Texture) => {
    setEditingTexture(texture);
    setFormData({
      name: texture.name,
      groupId: texture.groupId,
      sheen: texture.sheen,
      grainOrientation: texture.grainOrientation,
      color: texture.color || '#8B7355',
      tags: texture.tags,
    });
    setShowCreateModal(true);
  };

  const handleSave = () => {
    if (editingTexture) {
      updateMutation.mutate({ id: editingTexture.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    if (selectedGroupId) fd.append('groupId', selectedGroupId);
    uploadMutation.mutate(fd);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags?.includes(tag)) {
      setFormData((prev) => ({ ...prev, tags: [...(prev.tags || []), tag] }));
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setFormData((prev) => ({ ...prev, tags: (prev.tags || []).filter((t) => t !== tag) }));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleFieldChange = (field: keyof CreateTexture, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ── Loading ──
  if (texturesLoading && groupsLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading textures…</p>
        </div>
      </div>
    );
  }

  if (texturesError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-6 max-w-md text-center">
          <p className="text-red-400 font-medium mb-2">Failed to load textures</p>
          <p className="text-red-300 text-sm">{(texturesErr as Error)?.message || 'Unknown error'}</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['textures'] })}
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
      {/* ── Group Sidebar ── */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Groups</h2>
            <button
              onClick={() => setShowGroupModal(true)}
              className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded transition-colors"
              aria-label="Create group"
            >
              + Group
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <button
            onClick={() => setSelectedGroupId(null)}
            className={`w-full text-left p-3 border-b border-gray-700 hover:bg-gray-700 transition-colors text-sm ${
              selectedGroupId === null ? 'bg-gray-700 border-l-2 border-l-cyan-400' : ''
            }`}
          >
            All Textures
          </button>
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
              className={`w-full text-left p-3 border-b border-gray-700 hover:bg-gray-700 transition-colors ${
                selectedGroupId === group.id ? 'bg-gray-700 border-l-2 border-l-cyan-400' : ''
              }`}
            >
              <div className="text-sm font-medium truncate">{group.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">{group.textureCount} textures</div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Main Area ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-700 flex items-center gap-3">
          <input
            type="text"
            placeholder="Search textures…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 max-w-sm px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
            data-testid="file-input"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors disabled:opacity-50"
          >
            {uploadMutation.isPending ? 'Uploading…' : 'Upload Texture'}
          </button>
          <button
            onClick={openCreate}
            className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded transition-colors"
          >
            + New Texture
          </button>
        </div>

        {/* Upload error */}
        {uploadMutation.isError && (
          <div className="mx-4 mt-2 p-2 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
            Upload failed: {(uploadMutation.error as Error)?.message || 'Unknown error'}
          </div>
        )}

        {/* Texture Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {textures.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <p className="text-lg mb-2">No textures found</p>
                <p className="text-sm">Create a new texture or upload an image to get started.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {textures.map((texture) => (
                <div
                  key={texture.id}
                  className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-cyan-500 transition-colors group"
                >
                  {/* Thumbnail / Color Swatch */}
                  <div
                    className="h-32 relative"
                    style={{
                      backgroundColor: texture.color || '#555',
                      backgroundImage: texture.thumbnailUrl
                        ? `url(${texture.thumbnailUrl})`
                        : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {/* Grain Icon */}
                    <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                      {GRAIN_ICONS[texture.grainOrientation]}
                    </span>
                    {/* Sheen Badge */}
                    <span className="absolute top-2 right-2 bg-black/60 text-cyan-300 text-xs px-1.5 py-0.5 rounded">
                      {SHEEN_LABELS[texture.sheen]}
                    </span>
                  </div>

                  <div className="p-3">
                    <h3 className="text-sm font-medium truncate">{texture.name}</h3>
                    {(texture.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(texture.tags ?? []).slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 bg-gray-700 text-gray-300 text-xs rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {texture.tags.length > 3 && (
                          <span className="text-xs text-gray-500">+{texture.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => openEdit(texture)}
                        className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(texture.id)}
                        className="px-2 py-1 bg-red-900/50 hover:bg-red-800 text-red-400 text-xs rounded transition-colors"
                        aria-label={`Delete ${texture.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Delete confirmation overlay */}
                  {deleteConfirmId === texture.id && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg">
                      <div className="text-center p-4">
                        <p className="text-sm text-gray-300 mb-3">Delete {texture.name}?</p>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => deleteMutation.mutate(texture.id)}
                            disabled={deleteMutation.isPending}
                            className="px-3 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded"
                          >
                            {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Create/Edit Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-4">
              {editingTexture ? 'Edit Texture' : 'New Texture'}
            </h2>

            {(createMutation.isError || updateMutation.isError) && (
              <div className="mb-3 p-2 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
                {(createMutation.error as Error)?.message ||
                  (updateMutation.error as Error)?.message ||
                  'An error occurred'}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                  placeholder="Texture name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Group</label>
                  <select
                    value={formData.groupId || ''}
                    onChange={(e) => handleFieldChange('groupId', e.target.value || undefined)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">No Group</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.color || '#8B7355'}
                      onChange={(e) => handleFieldChange('color', e.target.value)}
                      className="w-10 h-10 rounded border border-gray-600 cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={formData.color || ''}
                      onChange={(e) => handleFieldChange('color', e.target.value)}
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                      placeholder="#8B7355"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Sheen</label>
                  <select
                    value={formData.sheen}
                    onChange={(e) => handleFieldChange('sheen', e.target.value as Sheen)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    {SHEEN_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {SHEEN_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Grain Orientation</label>
                  <select
                    value={formData.grainOrientation}
                    onChange={(e) =>
                      handleFieldChange('grainOrientation', e.target.value as GrainOrientation)
                    }
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                  >
                    {GRAIN_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {GRAIN_LABELS[g]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tags</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    placeholder="Add tag and press Enter"
                  />
                  <button
                    onClick={handleAddTag}
                    type="button"
                    className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors"
                  >
                    Add
                  </button>
                </div>
                {formData.tags && formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(formData.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="text-gray-500 hover:text-red-400"
                          aria-label={`Remove tag ${tag}`}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving…'
                  : editingTexture
                  ? 'Update Texture'
                  : 'Create Texture'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Group Modal ── */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-4">New Group</h2>

            {createGroupMutation.isError && (
              <div className="mb-3 p-2 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
                {(createGroupMutation.error as Error)?.message || 'Failed to create group'}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Group Name *</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                  placeholder="Group name"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <input
                  type="text"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                  placeholder="Optional description"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowGroupModal(false);
                  setGroupName('');
                  setGroupDesc('');
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  createGroupMutation.mutate({ name: groupName, description: groupDesc || undefined })
                }
                disabled={!groupName || createGroupMutation.isPending}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
              >
                {createGroupMutation.isPending ? 'Creating…' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
