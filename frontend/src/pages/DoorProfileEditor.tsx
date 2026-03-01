import { useState } from 'react'
import { RectangleGroupIcon } from '@heroicons/react/24/outline'

const PROFILES = [
  { id: 'shaker', name: 'Shaker', railWidth: 70, stileWidth: 70, reveal: 3 },
  { id: 'flat', name: 'Flat Panel', railWidth: 0, stileWidth: 0, reveal: 0 },
  { id: 'raised', name: 'Raised Panel', railWidth: 80, stileWidth: 80, reveal: 6 },
  { id: 'slab', name: 'Full Slab', railWidth: 0, stileWidth: 0, reveal: 0 },
]

export function DoorProfileEditor() {
  const [selected, setSelected] = useState('shaker')
  const profile = PROFILES.find(p => p.id === selected)!
  const [form, setForm] = useState(profile)

  const handleSelect = (id: string) => {
    const p = PROFILES.find(p => p.id === id)!
    setSelected(id)
    setForm(p)
  }

  return (
    <div className="flex flex-col h-full fade-in">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <RectangleGroupIcon className="w-5 h-5 text-cyan-500" />
        <h1 className="text-sm font-semibold text-gray-200">Door Profile Editor</h1>
      </div>
      <div className="flex flex-1 overflow-hidden gap-4 p-4">
        {/* Profile list */}
        <aside className="w-44 panel p-3 space-y-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Profiles</p>
          {PROFILES.map(p => (
            <button
              key={p.id}
              className={`w-full text-left px-2 py-2 rounded text-xs transition-colors ${
                selected === p.id ? 'bg-cyan-900/40 text-cyan-300' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
              onClick={() => handleSelect(p.id)}
            >
              {p.name}
            </button>
          ))}
          <button className="w-full mt-2 btn-ghost text-xs">+ New Profile</button>
        </aside>

        {/* Editor */}
        <div className="flex-1 flex gap-4">
          {/* Fields */}
          <div className="flex-1 panel p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-200">{form.name}</h3>
            {([
              ['Rail Width (mm)', 'railWidth'],
              ['Stile Width (mm)', 'stileWidth'],
              ['Panel Reveal (mm)', 'reveal'],
            ] as [string, keyof typeof form][]).map(([label, key]) => (
              <div key={key}>
                <label className="text-xs text-gray-500">{label}</label>
                <input
                  type="number"
                  className="input-field w-full mt-0.5"
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: +e.target.value }))}
                />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button className="btn-primary text-xs">Save Profile</button>
              <button className="btn-secondary text-xs">Apply to All Doors</button>
            </div>
          </div>

          {/* Preview */}
          <div className="w-56 panel p-4 flex flex-col items-center justify-center gap-2">
            <p className="text-xs text-gray-500 mb-1">Preview</p>
            <svg width="120" height="160" className="border border-gray-700 rounded">
              <rect x="0" y="0" width="120" height="160" fill="#1a1d27" />
              {form.railWidth > 0 && (
                <>
                  <rect x="0" y="0" width="120" height={form.railWidth * 0.6} fill="#374151" />
                  <rect x="0" y={160 - form.railWidth * 0.6} width="120" height={form.railWidth * 0.6} fill="#374151" />
                  <rect x="0" y="0" width={form.stileWidth * 0.6} height="160" fill="#374151" />
                  <rect x={120 - form.stileWidth * 0.6} y="0" width={form.stileWidth * 0.6} height="160" fill="#374151" />
                </>
              )}
              <rect
                x={form.stileWidth * 0.6 + form.reveal}
                y={form.railWidth * 0.6 + form.reveal}
                width={120 - (form.stileWidth * 0.6 + form.reveal) * 2}
                height={160 - (form.railWidth * 0.6 + form.reveal) * 2}
                fill="#4b5563"
              />
            </svg>
            <span className="text-xs text-gray-500 mono">{form.name}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
