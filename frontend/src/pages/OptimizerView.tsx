import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { optimizerService } from '@/services/optimizer'
import { useAppStore, useOptimizerStore } from '@/store'
import { SheetViewer } from '@/components/optimizer/SheetViewer'
import { SquaresPlusIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export function OptimizerView() {
  const { currentJob } = useAppStore()
  const { sheets, setSheets, selectedSheetIndex, setSelectedSheetIndex } = useOptimizerStore()
  const [grain, setGrain] = useState(true)
  const [kerf, setKerf] = useState(3.2)
  const [edgeBanding, setEdgeBanding] = useState(0.5)
  const [algorithm, setAlgorithm] = useState<'guillotine' | 'maxrects'>('guillotine')

  const optimize = useMutation({
    mutationFn: () =>
      optimizerService.optimize(currentJob!.id, { grain, kerf, edgeBanding, algorithm }),
    onSuccess: (data) => setSheets(data.sheets),
  })

  const activeSheet = sheets[selectedSheetIndex]
  const totalYield = sheets.length > 0
    ? sheets.reduce((s, sh) => s + sh.yieldPercent, 0) / sheets.length
    : 0

  return (
    <div className="flex h-full fade-in">
      {/* Left: Controls */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Optimizer</h2>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Algorithm</label>
          <select
            className="select-field w-full text-xs"
            value={algorithm}
            onChange={e => setAlgorithm(e.target.value as any)}
          >
            <option value="guillotine">Guillotine</option>
            <option value="maxrects">MaxRects</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Blade Kerf (mm)</label>
          <input
            type="number"
            step="0.1"
            className="input-field w-full text-xs"
            value={kerf}
            onChange={e => setKerf(+e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Edge Banding (mm)</label>
          <input
            type="number"
            step="0.1"
            className="input-field w-full text-xs"
            value={edgeBanding}
            onChange={e => setEdgeBanding(+e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={grain}
            onChange={e => setGrain(e.target.checked)}
          />
          Respect Grain Direction
        </label>

        <button
          className="btn-primary text-xs flex items-center justify-center gap-1.5"
          onClick={() => optimize.mutate()}
          disabled={!currentJob || optimize.isPending}
        >
          <SquaresPlusIcon className="w-4 h-4" />
          {optimize.isPending ? 'Optimizing…' : 'Run Optimizer'}
        </button>

        {optimize.isError && (
          <p className="text-xs text-red-400">{(optimize.error as Error).message}</p>
        )}

        {sheets.length > 0 && (
          <div className="panel p-3 space-y-2 mt-auto text-xs">
            <p className="font-semibold text-gray-300">Results</p>
            <div className="flex justify-between">
              <span className="text-gray-500">Sheets</span>
              <span className="mono">{sheets.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Avg Yield</span>
              <span className="mono text-green-400">{totalYield.toFixed(1)}%</span>
            </div>
          </div>
        )}
      </aside>

      {/* Center: Sheet tabs + viewer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sheet tabs */}
        <div className="flex gap-1 px-4 py-2 bg-gray-900 border-b border-gray-800 overflow-x-auto">
          {sheets.length === 0 ? (
            <span className="text-xs text-gray-600 py-1">No sheets yet — run optimizer</span>
          ) : (
            sheets.map((sheet, i) => (
              <button
                key={sheet.id}
                className={clsx(
                  'px-3 py-1 rounded text-xs transition-colors shrink-0',
                  selectedSheetIndex === i
                    ? 'bg-cyan-900/40 text-cyan-300 border border-cyan-700'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                )}
                onClick={() => setSelectedSheetIndex(i)}
              >
                Sheet {i + 1} · {sheet.yieldPercent.toFixed(0)}%
              </button>
            ))
          )}
        </div>

        {/* Viewer */}
        <div className="flex-1 flex items-center justify-center overflow-auto bg-gray-950 p-4">
          {activeSheet ? (
            <SheetViewer sheet={activeSheet} />
          ) : (
            <div className="text-center text-gray-700">
              <SquaresPlusIcon className="w-16 h-16 mx-auto mb-3" />
              <p className="text-sm">Run the optimizer to see nesting results</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Sheet stats */}
      {activeSheet && (
        <aside className="w-44 bg-gray-900 border-l border-gray-800 p-3 space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sheet Info</h3>
          {[
            ['Material', activeSheet.materialName],
            ['Size', `${activeSheet.width}×${activeSheet.height}`],
            ['Thickness', `${activeSheet.thickness}mm`],
            ['Parts', String(activeSheet.parts.length)],
            ['Yield', `${activeSheet.yieldPercent.toFixed(1)}%`],
            ['Waste', `${(100 - activeSheet.yieldPercent).toFixed(1)}%`],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-gray-600">{label}</p>
              <p className="text-xs font-medium text-gray-300 mono">{value}</p>
            </div>
          ))}
          <div className="divider" />
          <button className="btn-secondary w-full text-xs">
            <Cog6ToothIcon className="w-3.5 h-3.5 inline mr-1" />
            Export G-Code
          </button>
        </aside>
      )}
    </div>
  )
}
