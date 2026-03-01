import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { renderingService } from '@/services/rendering'
import { useAppStore } from '@/store'
import { CloudArrowUpIcon, PlayIcon } from '@heroicons/react/24/outline'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatDate } from '@/utils/format'

const MOCK_RENDERS = [
  { id: '1', name: 'Kitchen — Perspective', status: 'completed', resolution: '1920x1080', createdAt: '2026-02-28' },
  { id: '2', name: 'Kitchen — Front Elevation', status: 'completed', resolution: '2560x1440', createdAt: '2026-02-28' },
  { id: '3', name: 'Master Bath — Perspective', status: 'rendering', resolution: '3840x2160', createdAt: '2026-03-01' },
  { id: '4', name: 'Walk-in Robe — Overview', status: 'queued', resolution: '1920x1080', createdAt: '2026-03-01' },
]

export function CloudRenderView() {
  const { currentJob } = useAppStore()
  const [selectedView, setSelectedView] = useState('')
  const [resolution, setResolution] = useState('1920x1080')

  return (
    <div className="flex h-full fade-in">
      {/* Left: Render queue */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-900">
          <CloudArrowUpIcon className="w-5 h-5 text-cyan-500" />
          <h1 className="text-sm font-semibold text-gray-200">Cloud Renders</h1>
          <div className="flex-1" />
          <button className="btn-primary text-xs flex items-center gap-1.5">
            <PlayIcon className="w-4 h-4" />
            Start Render
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-2">
            {MOCK_RENDERS.map((render) => (
              <div key={render.id} className="panel p-3 flex items-center gap-4">
                <div
                  className="w-20 h-14 rounded bg-gradient-to-br from-gray-700 to-gray-900 shrink-0 flex items-center justify-center text-gray-600 text-xs"
                >
                  {render.status === 'completed' ? '🖼' : render.status === 'rendering' ? (
                    <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  ) : '⏳'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-100">{render.name}</p>
                  <p className="text-xs text-gray-500">{render.resolution} · {formatDate(render.createdAt)}</p>
                </div>
                <StatusBadge status={render.status} />
                {render.status === 'completed' && (
                  <button className="btn-secondary text-xs">Download</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Settings */}
      <aside className="w-56 bg-gray-900 border-l border-gray-800 p-4 space-y-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Render Settings</h3>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Saved View</label>
          <select className="select-field w-full text-xs" value={selectedView} onChange={(e) => setSelectedView(e.target.value)}>
            <option value="">Select view...</option>
            <option>Perspective</option>
            <option>Front Elevation</option>
            <option>Side Elevation</option>
            <option>Top View</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Resolution</label>
          <select className="select-field w-full text-xs" value={resolution} onChange={(e) => setResolution(e.target.value)}>
            <option value="1920x1080">1920×1080 (HD)</option>
            <option value="2560x1440">2560×1440 (2K)</option>
            <option value="3840x2160">3840×2160 (4K)</option>
          </select>
        </div>
        {[
          { label: 'Ambient Occlusion', key: 'ao' },
          { label: 'Shadows', key: 'shadows' },
          { label: 'Reflections', key: 'reflections' },
        ].map((opt) => (
          <label key={opt.key} className="flex items-center justify-between text-xs text-gray-400">
            <span>{opt.label}</span>
            <input type="checkbox" defaultChecked />
          </label>
        ))}
        <div className="divider" />
        <button className="btn-primary w-full text-xs">Queue Render</button>
        <button className="btn-secondary w-full text-xs">Batch Render All Views</button>
      </aside>
    </div>
  )
}
