import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useAppStore } from '@/store/appStore';

/* ── types ── */
export interface DoorProfile {
  id: string;
  name: string;
  style: 'shaker' | 'raised_panel' | 'slab' | 'rail_stile';
  railWidth: number;
  stileWidth: number;
  panelThickness: number;
  profileDepth: number;
  innerRadius: number;
  createdAt?: string;
  updatedAt?: string;
}

const STYLE_OPTIONS: { value: DoorProfile['style']; label: string }[] = [
  { value: 'shaker', label: 'Shaker' },
  { value: 'raised_panel', label: 'Raised Panel' },
  { value: 'slab', label: 'Slab' },
  { value: 'rail_stile', label: 'Rail & Stile' },
];

const DEFAULT_PROFILE: Omit<DoorProfile, 'id'> = {
  name: 'New Profile',
  style: 'shaker',
  railWidth: 2.5,
  stileWidth: 2.5,
  panelThickness: 0.75,
  profileDepth: 0.375,
  innerRadius: 0.125,
};

/* ── inline service ── */
export const doorProfilesService = {
  getProfiles: () => api.get<DoorProfile[]>('/door-profiles').then((r) => r.data).catch(() => [] as DoorProfile[]),
  getProfile: (id: string) => api.get<DoorProfile>(`/door-profiles/${id}`).then((r) => r.data),
  createProfile: (data: Omit<DoorProfile, 'id'>) => api.post<DoorProfile>('/door-profiles', data).then((r) => r.data),
  updateProfile: (id: string, data: Partial<DoorProfile>) => api.put<DoorProfile>(`/door-profiles/${id}`, data).then((r) => r.data),
  deleteProfile: (id: string) => api.delete(`/door-profiles/${id}`).then((r) => r.data),
  applyToAllDoors: (profileId: string, jobId: string) =>
    api.post(`/door-profiles/${profileId}/apply`, { jobId }).then((r) => r.data),
};

/* ── SVG preview component ── */
function ProfileSVGPreview({ profile }: { profile: Omit<DoorProfile, 'id'> }) {
  const { style, railWidth, stileWidth, panelThickness, profileDepth, innerRadius } = profile;
  const svgW = 240;
  const svgH = 320;
  const scale = 30;
  const rw = railWidth * scale;
  const sw = stileWidth * scale;
  const pd = profileDepth * scale;
  const ir = innerRadius * scale;
  const doorW = svgW - 20;
  const doorH = svgH - 20;
  const ox = 10;
  const oy = 10;

  return (
    <svg
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="bg-gray-950 rounded border border-gray-700"
      data-testid="svg-preview"
    >
      {/* outer frame */}
      <rect x={ox} y={oy} width={doorW} height={doorH} fill="#1e293b" stroke="#38bdf8" strokeWidth={1.5} rx={2} />

      {/* stiles (left + right) */}
      <rect x={ox} y={oy} width={sw} height={doorH} fill="#334155" stroke="#94a3b8" strokeWidth={0.5} />
      <rect x={ox + doorW - sw} y={oy} width={sw} height={doorH} fill="#334155" stroke="#94a3b8" strokeWidth={0.5} />

      {/* rails (top + bottom) */}
      <rect x={ox} y={oy} width={doorW} height={rw} fill="#334155" stroke="#94a3b8" strokeWidth={0.5} />
      <rect x={ox} y={oy + doorH - rw} width={doorW} height={rw} fill="#334155" stroke="#94a3b8" strokeWidth={0.5} />

      {/* panel area */}
      {style !== 'slab' && (
        <rect
          x={ox + sw + pd}
          y={oy + rw + pd}
          width={doorW - 2 * sw - 2 * pd}
          height={doorH - 2 * rw - 2 * pd}
          fill={style === 'raised_panel' ? '#475569' : '#1e293b'}
          stroke="#06b6d4"
          strokeWidth={1}
          rx={ir}
          data-testid="panel-rect"
        />
      )}

      {/* raised panel inner bevel */}
      {style === 'raised_panel' && (
        <rect
          x={ox + sw + pd + 8}
          y={oy + rw + pd + 8}
          width={doorW - 2 * sw - 2 * pd - 16}
          height={doorH - 2 * rw - 2 * pd - 16}
          fill="#334155"
          stroke="#94a3b8"
          strokeWidth={0.5}
          rx={ir}
        />
      )}

      {/* profile depth lines */}
      {style === 'shaker' && (
        <>
          <line x1={ox + sw} y1={oy + rw} x2={ox + sw + pd} y2={oy + rw + pd} stroke="#06b6d4" strokeWidth={0.8} />
          <line x1={ox + doorW - sw} y1={oy + rw} x2={ox + doorW - sw - pd} y2={oy + rw + pd} stroke="#06b6d4" strokeWidth={0.8} />
          <line x1={ox + sw} y1={oy + doorH - rw} x2={ox + sw + pd} y2={oy + doorH - rw - pd} stroke="#06b6d4" strokeWidth={0.8} />
          <line x1={ox + doorW - sw} y1={oy + doorH - rw} x2={ox + doorW - sw - pd} y2={oy + doorH - rw - pd} stroke="#06b6d4" strokeWidth={0.8} />
        </>
      )}

      {/* dimension labels */}
      <text x={ox + doorW / 2} y={svgH - 2} textAnchor="middle" fill="#9ca3af" fontSize={9}>
        Rail: {railWidth}" | Stile: {stileWidth}"
      </text>
    </svg>
  );
}

/* ═══════════════════════════════════════════ */
export default function DoorProfileEditor() {
  const queryClient = useQueryClient();
  const currentJob = useAppStore((s) => s.currentJob);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<DoorProfile, 'id'>>(DEFAULT_PROFILE);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  /* ── queries ── */
  const {
    data: profiles = [],
    isLoading,
    error,
  } = useQuery<DoorProfile[]>({
    queryKey: ['doorProfiles'],
    queryFn: doorProfilesService.getProfiles,
    retry: false,
  });

  /* ── mutations ── */
  const createMutation = useMutation({
    mutationFn: doorProfilesService.createProfile,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['doorProfiles'] });
      setSelectedId(created.id);
      setIsCreating(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DoorProfile> }) =>
      doorProfilesService.updateProfile(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doorProfiles'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: doorProfilesService.deleteProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doorProfiles'] });
      setSelectedId(null);
      setFormData(DEFAULT_PROFILE);
      setDeleteConfirm(null);
    },
  });

  const applyAllMutation = useMutation({
    mutationFn: (profileId: string) =>
      doorProfilesService.applyToAllDoors(profileId, currentJob ?? ''),
  });

  /* ── select profile ── */
  const handleSelectProfile = (p: DoorProfile) => {
    setSelectedId(p.id);
    setIsCreating(false);
    setFormData({
      name: p.name,
      style: p.style,
      railWidth: p.railWidth,
      stileWidth: p.stileWidth,
      panelThickness: p.panelThickness,
      profileDepth: p.profileDepth,
      innerRadius: p.innerRadius,
    });
  };

  /* ── new profile ── */
  const handleNewProfile = () => {
    setIsCreating(true);
    setSelectedId(null);
    setFormData({ ...DEFAULT_PROFILE });
  };

  /* ── form field change ── */
  const updateField = <K extends keyof Omit<DoorProfile, 'id'>>(key: K, value: Omit<DoorProfile, 'id'>[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  /* ── save ── */
  const handleSave = () => {
    if (isCreating) {
      createMutation.mutate(formData);
    } else if (selectedId) {
      updateMutation.mutate({ id: selectedId, data: formData });
    }
  };

  /* ── delete ── */
  const handleDelete = () => {
    if (deleteConfirm) deleteMutation.mutate(deleteConfirm);
  };

  /* ── loading / error ── */
  if (isLoading)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white" data-testid="loading">
        <svg className="animate-spin h-8 w-8 mr-3 text-cyan-400" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Loading profiles…
      </div>
    );

  if (error)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-red-400" data-testid="error">
        Failed to load door profiles. Please try again.
      </div>
    );

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* ── sidebar: profile list ── */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-cyan-400">Door Profiles</h2>
          <button
            onClick={handleNewProfile}
            className="px-2 py-1 text-xs rounded bg-cyan-600 text-white hover:bg-cyan-500"
            data-testid="new-profile-btn"
          >
            + New
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto" data-testid="profile-list">
          {profiles.length === 0 && (
            <li className="px-4 py-3 text-gray-500 text-sm" data-testid="profiles-empty">No profiles yet</li>
          )}
          {profiles.map((p) => (
            <li
              key={p.id}
              onClick={() => handleSelectProfile(p)}
              className={`px-4 py-3 cursor-pointer border-b border-gray-700 text-sm ${
                selectedId === p.id ? 'bg-gray-700 text-cyan-300' : 'hover:bg-gray-750 text-gray-300'
              }`}
              data-testid={`profile-item-${p.id}`}
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-gray-500 capitalize">{p.style.replace('_', ' ')}</div>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── main: form + preview ── */}
      <main className="flex-1 flex">
        {/* form */}
        <div className="flex-1 p-6 overflow-y-auto">
          <h1 className="text-xl font-bold mb-6">{isCreating ? 'Create Profile' : selectedId ? 'Edit Profile' : 'Select a Profile'}</h1>

          {(isCreating || selectedId) && (
            <div className="space-y-4 max-w-lg">
              {/* name */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Profile Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  data-testid="input-name"
                />
              </div>

              {/* style */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Style</label>
                <select
                  className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  value={formData.style}
                  onChange={(e) => updateField('style', e.target.value as DoorProfile['style'])}
                  data-testid="input-style"
                >
                  {STYLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* numeric fields */}
              {([
                ['railWidth', 'Rail Width (in)'],
                ['stileWidth', 'Stile Width (in)'],
                ['panelThickness', 'Panel Thickness (in)'],
                ['profileDepth', 'Profile Depth (in)'],
                ['innerRadius', 'Inner Radius (in)'],
              ] as [keyof Omit<DoorProfile, 'id' | 'name' | 'style'>, string][]).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-sm text-gray-400 mb-1">{label}</label>
                  <input
                    type="number"
                    step="0.0625"
                    min="0"
                    className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    value={formData[key]}
                    onChange={(e) => updateField(key, parseFloat(e.target.value) || 0)}
                    data-testid={`input-${key}`}
                  />
                </div>
              ))}

              {/* action buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSave}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 rounded bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50"
                  data-testid="save-btn"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving…'
                    : isCreating
                    ? 'Create Profile'
                    : 'Save Profile'}
                </button>

                {selectedId && (
                  <>
                    <button
                      onClick={() => applyAllMutation.mutate(selectedId)}
                      disabled={applyAllMutation.isPending}
                      className="px-4 py-2 rounded bg-green-700 text-white hover:bg-green-600 disabled:opacity-50"
                      data-testid="apply-all-btn"
                    >
                      {applyAllMutation.isPending ? 'Applying…' : 'Apply to All Doors'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(selectedId)}
                      className="px-4 py-2 rounded bg-red-700 text-white hover:bg-red-600"
                      data-testid="delete-btn"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>

              {/* mutation status messages */}
              {createMutation.isSuccess && <p className="text-green-400 text-sm" data-testid="create-success">Profile created successfully.</p>}
              {updateMutation.isSuccess && <p className="text-green-400 text-sm" data-testid="update-success">Profile saved successfully.</p>}
              {applyAllMutation.isSuccess && <p className="text-green-400 text-sm" data-testid="apply-success">Profile applied to all doors.</p>}
              {createMutation.isError && <p className="text-red-400 text-sm" data-testid="create-error">Failed to create profile.</p>}
              {updateMutation.isError && <p className="text-red-400 text-sm" data-testid="update-error">Failed to save profile.</p>}
              {applyAllMutation.isError && <p className="text-red-400 text-sm" data-testid="apply-error">Failed to apply profile.</p>}
            </div>
          )}

          {!isCreating && !selectedId && profiles.length > 0 && (
            <p className="text-gray-500" data-testid="select-prompt">Select a profile from the sidebar or create a new one.</p>
          )}
        </div>

        {/* SVG preview */}
        <div className="w-80 border-l border-gray-700 p-6 flex flex-col items-center">
          <h3 className="text-sm font-semibold text-cyan-400 mb-4">Live Preview</h3>
          <ProfileSVGPreview profile={formData} />
          <div className="mt-4 text-xs text-gray-500 space-y-1 text-center">
            <p>Style: {STYLE_OPTIONS.find((o) => o.value === formData.style)?.label}</p>
            <p>Rail: {formData.railWidth}" | Stile: {formData.stileWidth}"</p>
            <p>Panel: {formData.panelThickness}" | Depth: {formData.profileDepth}"</p>
            <p>Radius: {formData.innerRadius}"</p>
          </div>
        </div>
      </main>

      {/* ── delete confirmation dialog ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" data-testid="delete-dialog">
          <div className="bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-2">Delete Profile?</h3>
            <p className="text-gray-400 text-sm mb-4">
              This action cannot be undone. The profile will be permanently removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 text-sm"
                data-testid="delete-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-sm text-white disabled:opacity-50"
                data-testid="delete-confirm"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
