import { useOptimizerStore } from '@/store'
import { SheetViewer } from '@/components/optimizer/SheetViewer'
import { PrinterIcon, ExclamationTriangleIcon, Square3Stack3DIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export function CNCOperatorView() {
  const { sheets, selectedSheetIndex, setSelectedSheetIndex } = useOptimizerStore()
  const activeSheet = sheets[selectedSheetIndex]

  return (
    <div className="flex flex-col h-full bg-gray-950 fade-in">
      <div className="px-4 py-3 bg-gray-900 border-b border-gray-800">
        <h1 className="text-xl font-bold text-gray-100">CNC Operator</h1>
        <p className="text-sm text-gray-500">Sheet cutting interface</p>
      </div>

      {/* Sheet selector */}
      <div className="flex gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800 overflow-x-auto">
        {sheets.length === 0 ? (
          <span className="text-sm text-gray-600">No sheets — run optimizer first</span>
        ) : (
          sheets.map((sheet, i) => (
            <button
              key={sheet.id}
              className={clsx(
                'flex flex-col items-center px-4 py-2 rounded-lg border transition-colors shrink-0',
                selectedSheetIndex === i
                  ? 'border-cyan-500 bg-cyan-900/30 text-cyan-300'
                  : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500'
              )}
              onClick={() => setSelectedSheetIndex(i)}
            >
              <span className="font-bold text-lg">{i + 1}</span>
              <span className="text-xs">{sheet.yieldPercent.toFixed(0)}% yield</span>
              <span className="text-xs text-gray-600">{sheet.parts.length} parts</span>
            </button>
          ))
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden gap-4 p-4">
        {/* Sheet viewer */}
        <div className="flex-1 flex items-center justify-center overflow-auto bg-gray-900 rounded-xl border border-gray-800">
          {activeSheet ? (
            <SheetViewer sheet={activeSheet} scale={0.1} />
          ) : (
            <div className="text-center text-gray-600">
              <Square3Stack3DIcon className="w-12 h-12 mx-auto mb-2" />
              <p>No sheet selected</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="w-56 flex flex-col gap-3">
          <button className="btn-primary py-4 text-base flex items-center justify-center gap-2">
            <PrinterIcon className="w-6 h-6" />
            Print Labels
          </button>
          <button className="btn-secondary py-4 text-base flex items-center justify-center gap-2">
            <Square3Stack3DIcon className="w-6 h-6" />
            Next Sheet
          </button>
          <button className="py-4 text-base bg-yellow-800 hover:bg-yellow-700 text-yellow-100 rounded-lg flex items-center justify-center gap-2 transition-colors">
            <ExclamationTriangleIcon className="w-6 h-6" />
            Remake Part
          </button>
          {activeSheet && (
            <div className="panel p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Parts</span>
                <span className="mono text-gray-200">{activeSheet.parts.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Material</span>
                <span className="text-gray-200">{activeSheet.materialName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Thickness</span>
                <span className="mono text-gray-200">{activeSheet.thickness}mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Yield</span>
                <span className="mono text-green-400">{activeSheet.yieldPercent.toFixed(1)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
