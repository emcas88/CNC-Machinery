import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cutlistsService } from '@/services/cutlists'
import { useAppStore } from '@/store'
import { TagIcon } from '@heroicons/react/24/outline'

const TEMPLATES = [
  { id: 'standard', name: 'Standard Label' },
  { id: 'compact', name: 'Compact (50×25)' },
  { id: 'large', name: 'Large (100×75)' },
  { id: 'qr', name: 'QR Code Label' },
]

export function LabelDesigner() {
  const { currentJob } = useAppStore()
  const [template, setTemplate] = useState('standard')
  const [showQr, setShowQr] = useState(true)
  const [showDims, setShowDims] = useState(true)
  const [showMaterial, setShowMaterial] = useState(true)
  const [showRoom, setShowRoom] = useState(true)

  const { data: rows = [] } = useQuery({
    queryKey: ['cutlist', currentJob?.id],
    queryFn: () => cutlistsService.getCutlist(currentJob!.id),
    enabled: !!currentJob?.id,
  })

  const previewRow = rows[0]

  return (
    <div className="flex h-full fade-in">
      {/* Settings */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 p-4 space-y-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Label Settings</h2>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Template</label>
          <select
            className="select-field w-full text-xs"
            value={template}
            onChange={e => setTemplate(e.target.value)}
          >
            {TEMPLATES.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-gray-500">Show Fields</p>
          {[
            ['QR Code', showQr, setShowQr],
            ['Dimensions', showDims, setShowDims],
            ['Material', showMaterial, setShowMaterial],
            ['Room Name', showRoom, setShowRoom],
          ].map(([label, val, set]: any) => (
            <label key={label} className="flex items-center justify-between text-xs text-gray-400">
              <span>{label}</span>
              <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} />
            </label>
          ))}
        </div>

        <div className="divider" />
        <button className="btn-primary w-full text-xs">Print All Labels</button>
        <button className="btn-secondary w-full text-xs">Export PDF</button>
      </aside>

      {/* Preview */}
      <div className="flex-1 flex items-center justify-center bg-gray-950">
        {previewRow ? (
          <div className="bg-white text-black rounded-lg p-4 w-72 shadow-2xl">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-xs font-bold text-gray-900">{previewRow.partName}</p>
                {showRoom && <p className="text-xs text-gray-500">{previewRow.roomName ?? 'Room'}</p>}
              </div>
              {showQr && (
                <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                  <TagIcon className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </div>
            {showDims && (
              <p className="text-sm font-mono font-bold text-gray-900">
                {previewRow.width} × {previewRow.height} × {previewRow.thickness}mm
              </p>
            )}
            {showMaterial && (
              <p className="text-xs text-gray-600 mt-1">{previewRow.material}</p>
            )}
            <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-xs text-gray-500">
              <span>Qty: {previewRow.quantity}</span>
              <span className="font-mono">{previewRow.labelCode ?? 'A001'}</span>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-600">
            <TagIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{currentJob ? 'No parts in cut list' : 'Select a job first'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
