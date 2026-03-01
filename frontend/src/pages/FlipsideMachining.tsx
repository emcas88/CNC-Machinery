import { useState } from 'react'
import { Square3Stack3DIcon } from '@heroicons/react/24/outline'
import { useOptimizerStore } from '@/store'

export function FlipsideMachining() {
  const { sheets } = useOptimizerStore()
  const [selectedSheet, setSelectedSheet] = useState(0)
  const sheet = sheets[selectedSheet]

  return (
    <div className="flex flex-col h-full fade-in">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <Square3Stack3DIcon className="w-5 h-5 text-cyan-500" />
        <h1 className="text-sm font-semibold text-gray-200">Flipside Machining</h1>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Sheet selector */}
        <aside className="w-36 bg-gray-900 border-r border-gray-800 p-2 overflow-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 py-1">Sheets</p>
          {sheets.length === 0 ? (
            <p className="text-xs text-gray-600 px-2">No sheets</p>
          ) : (
            sheets.map((s, i) => (
              <button
                key={s.id}
                className={`w-full text-left px-2 py-2 rounded text-xs mb-1 transition-colors ${
                  selectedSheet === i ? 'bg-cyan-900/30 text-cyan-300' : 'text-gray-400 hover:bg-gray-800'
                }`}
                onClick={() => setSelectedSheet(i)}
              >
                Sheet {i + 1}<br />
                <span className="text-gray-600">{s.parts.length} parts</span>
              </button>
            ))
          )}
        </aside>

        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center bg-gray-950">
          {sheet ? (
            <div className="text-center space-y-4">
              <div className="panel p-6 space-y-2">
                <p className="text-sm font-semibold text-gray-200">Sheet {selectedSheet + 1} — Flipside</p>
                <p className="text-xs text-gray-500">{sheet.materialName} · {sheet.thickness}mm</p>
                <p className="text-xs text-gray-500">{sheet.parts.length} parts · {sheet.yieldPercent.toFixed(1)}% yield</p>
              </div>
              <div className="flex gap-2 justify-center">
                <button className="btn-primary text-xs">Generate Flipside G-Code</button>
                <button className="btn-secondary text-xs">Preview Flipside</button>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-600">
              <Square3Stack3DIcon className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm">No sheets available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
