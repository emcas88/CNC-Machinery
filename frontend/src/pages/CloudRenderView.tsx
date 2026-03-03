import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { renderingService } from '@/services/rendering';
import { useAppStore } from '@/store/appStore';
import type { RenderJob, RenderSettings } from '@/types';

/* ── resolution options ── */
const RESOLUTION_OPTIONS: { value: RenderSettings['resolution']; label: string }[] = [
  { value: '1920x1080', label: '1080p (1920×1080)' },
  { value: '2560x1440', label: '1440p (2560×1440)' },
  { value: '3840x2160', label: '4K (3840×2160)' },
];

const QUALITY_OPTIONS: { value: RenderSettings['quality']; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'High' },
];

const DEFAULT_SETTINGS: RenderSettings = {
  resolution: '1920x1080',
  quality: 'standard',
  samples: 128,
  ambientOcclusion: true,
  shadows: true,
  reflections: false,
};

/* ═══════════════════════════════════════════ */
export default function CloudRenderView() {
  const queryClient = useQueryClient();
  const currentJob = useAppStore((s) => s.currentJob);

  const [settings, setSettings] = useState<RenderSettings>({ ...DEFAULT_SETTINGS });
  const [viewId, setViewId] = useState('default');
  const [batchViewIds, setBatchViewIds] = useState('front,back,left,right');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const jobId = currentJob ?? '';

  /* ── queries ── */
  const {
    data: renders = [],
    isLoading,
    error,
  } = useQuery<RenderJob[]>({
    queryKey: ['renders', jobId],
    queryFn: () => renderingService.getRenders(jobId),
    enabled: !!jobId,
    refetchInterval: (query) => {
      // poll every 3s if any render is in progress
      const data = query.state.data as RenderJob[] | undefined;
      const hasActive = data?.some((r) => r.status === 'queued' || r.status === 'rendering');
      return hasActive ? 3000 : false;
    },
  });

  /* ── mutations ── */
  const submitMutation = useMutation({
    mutationFn: () => renderingService.submitRender(jobId, viewId, settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['renders', jobId] }),
  });

  const batchMutation = useMutation({
    mutationFn: () => {
      const viewIds = batchViewIds.split(',').map((v) => v.trim()).filter(Boolean);
      return renderingService.batchRender(jobId, viewIds, settings);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['renders', jobId] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (renderId: string) => renderingService.cancelRender(renderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['renders', jobId] }),
  });

  /* ── download handler ── */
  const handleDownload = async (renderId: string) => {
    setDownloadingId(renderId);
    try {
      const result = await renderingService.getResult(renderId);
      const a = document.createElement('a');
      a.href = result.downloadUrl;
      a.download = `render-${renderId}.png`;
      a.click();
    } catch {
      // silent fail
    } finally {
      setDownloadingId(null);
    }
  };

  /* ── derived ── */
  const activeRenders = useMemo(
    () => renders.filter((r) => r.status === 'queued' || r.status === 'rendering'),
    [renders],
  );
  const completedRenders = useMemo(
    () => renders.filter((r) => r.status === 'completed'),
    [renders],
  );
  const failedRenders = useMemo(
    () => renders.filter((r) => r.status === 'failed'),
    [renders],
  );

  /* ── setting updater ── */
  const updateSetting = <K extends keyof RenderSettings>(key: K, value: RenderSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  /* ── status badge ── */
  const StatusBadge = ({ status }: { status: RenderJob['status'] }) => {
    const colors: Record<RenderJob['status'], string> = {
      queued: 'bg-yellow-700 text-yellow-200',
      rendering: 'bg-blue-700 text-blue-200',
      completed: 'bg-green-700 text-green-200',
      failed: 'bg-red-700 text-red-200',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded ${colors[status]}`} data-testid={`badge-${status}`}>
        {status}
      </span>
    );
  };

  /* ── loading / error ── */
  if (!jobId)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-400" data-testid="no-job">
        No job selected. Please select a job to manage renders.
      </div>
    );

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white" data-testid="loading">
        <svg className="animate-spin h-8 w-8 mr-3 text-cyan-400" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Loading renders…
      </div>
    );

  if (error)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-red-400" data-testid="error">
        Failed to load render queue. Please try again.
      </div>
    );

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* ── left: settings panel ── */}
      <aside className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col overflow-y-auto">
        <h2 className="px-4 py-3 text-sm font-semibold text-cyan-400 border-b border-gray-700">Render Settings</h2>

        <div className="p-4 space-y-4">
          {/* view id */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">View</label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              value={viewId}
              onChange={(e) => setViewId(e.target.value)}
              data-testid="input-viewId"
            />
          </div>

          {/* resolution */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Resolution</label>
            <select
              className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              value={settings.resolution}
              onChange={(e) => updateSetting('resolution', e.target.value as RenderSettings['resolution'])}
              data-testid="input-resolution"
            >
              {RESOLUTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* quality */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Quality</label>
            <select
              className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              value={settings.quality}
              onChange={(e) => updateSetting('quality', e.target.value as RenderSettings['quality'])}
              data-testid="input-quality"
            >
              {QUALITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* samples */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Samples</label>
            <input
              type="number"
              min="32"
              max="4096"
              step="32"
              className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
              value={settings.samples}
              onChange={(e) => updateSetting('samples', parseInt(e.target.value, 10) || 128)}
              data-testid="input-samples"
            />
          </div>

          {/* toggles */}
          <div className="space-y-2">
            {([
              ['ambientOcclusion', 'Ambient Occlusion'],
              ['shadows', 'Shadows'],
              ['reflections', 'Reflections'],
            ] as [keyof RenderSettings, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings[key] as boolean}
                  onChange={(e) => updateSetting(key, e.target.checked as any)}
                  className="rounded bg-gray-600 border-gray-500"
                  data-testid={`toggle-${key}`}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* action buttons */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="w-full px-4 py-2 rounded bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 text-sm"
            data-testid="start-render-btn"
          >
            {submitMutation.isPending ? 'Submitting…' : 'Start Render'}
          </button>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Batch Views (comma-separated)</label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              value={batchViewIds}
              onChange={(e) => setBatchViewIds(e.target.value)}
              data-testid="input-batchViews"
            />
            <button
              onClick={() => batchMutation.mutate()}
              disabled={batchMutation.isPending}
              className="w-full px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 text-sm"
              data-testid="batch-render-btn"
            >
              {batchMutation.isPending ? 'Submitting…' : 'Batch Render'}
            </button>
          </div>

          {submitMutation.isError && <p className="text-red-400 text-xs" data-testid="submit-error">Failed to start render.</p>}
          {batchMutation.isError && <p className="text-red-400 text-xs" data-testid="batch-error">Batch render failed.</p>}
          {submitMutation.isSuccess && <p className="text-green-400 text-xs" data-testid="submit-success">Render queued.</p>}
          {batchMutation.isSuccess && <p className="text-green-400 text-xs" data-testid="batch-success">Batch renders queued.</p>}
        </div>
      </aside>

      {/* ── main ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* header */}
        <div className="px-6 py-4 bg-gray-800 border-b border-gray-700">
          <h1 className="text-lg font-bold">Cloud Render Queue</h1>
          <p className="text-xs text-gray-400 mt-1">
            {activeRenders.length} active · {completedRenders.length} completed · {failedRenders.length} failed
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* active renders */}
          {activeRenders.length > 0 && (
            <section className="mb-8">
              <h3 className="text-sm font-semibold text-cyan-400 mb-3">Active Renders</h3>
              <div className="space-y-3" data-testid="active-renders">
                {activeRenders.map((r) => (
                  <div key={r.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700" data-testid={`render-${r.id}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{r.viewId ?? 'Default View'}</span>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        <button
                          onClick={() => cancelMutation.mutate(r.id)}
                          disabled={cancelMutation.isPending}
                          className="px-2 py-1 text-xs rounded bg-red-700 text-white hover:bg-red-600 disabled:opacity-50"
                          data-testid={`cancel-${r.id}`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-cyan-500 h-2 rounded-full transition-all"
                        style={{ width: `${r.progress}%` }}
                        data-testid={`progress-${r.id}`}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{r.progress}% complete</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* completed renders / gallery */}
          <section className="mb-8">
            <h3 className="text-sm font-semibold text-cyan-400 mb-3">Render Gallery</h3>
            {completedRenders.length === 0 ? (
              <div className="text-gray-500 text-sm" data-testid="no-completed">
                No completed renders yet.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4" data-testid="render-gallery">
                {completedRenders.map((r) => (
                  <div key={r.id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden" data-testid={`completed-${r.id}`}>
                    {r.resultUrl ? (
                      <img
                        src={r.resultUrl}
                        alt={`Render ${r.viewId ?? r.id}`}
                        className="w-full h-40 object-cover"
                        data-testid={`thumb-${r.id}`}
                      />
                    ) : (
                      <div className="w-full h-40 bg-gray-900 flex items-center justify-center text-gray-500 text-sm">
                        No preview
                      </div>
                    )}
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{r.viewId ?? 'Default'}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {r.settings.resolution} · {r.settings.quality}
                      </p>
                      <p className="text-xs text-gray-500">
                        {r.completedAt ? new Date(r.completedAt).toLocaleString() : ''}
                      </p>
                      <button
                        onClick={() => handleDownload(r.id)}
                        disabled={downloadingId === r.id}
                        className="mt-2 w-full px-3 py-1.5 rounded bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 text-xs"
                        data-testid={`download-${r.id}`}
                      >
                        {downloadingId === r.id ? 'Downloading…' : 'Download'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* failed renders */}
          {failedRenders.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-red-400 mb-3">Failed Renders</h3>
              <div className="space-y-2" data-testid="failed-renders">
                {failedRenders.map((r) => (
                  <div key={r.id} className="bg-gray-800 rounded-lg p-3 border border-red-800/50 flex items-center justify-between" data-testid={`failed-${r.id}`}>
                    <div>
                      <span className="text-sm">{r.viewId ?? 'Default'}</span>
                      <p className="text-xs text-gray-500">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* empty state */}
          {renders.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500" data-testid="empty-queue">
              <p className="text-lg mb-2">No renders yet</p>
              <p className="text-sm">Configure settings and start a render.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
