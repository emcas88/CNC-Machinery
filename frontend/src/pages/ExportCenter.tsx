import { ArrowDownTrayIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { useAppStore } from '@/store'

const EXPORT_FORMATS = [
  { id: 'csv', label: 'Cut List CSV', description: 'Standard cut list for CNC operators', ext: '.csv' },
  { id: 'dxf', label: 'DXF Files', description: 'CAD drawing exchange format', ext: '.dxf' },
  { id: 'svg', label: 'SVG Nest', description: 'Nesting layout as scalable vector', ext: '.svg' },
  { id: 'pdf', label: 'Job PDF', description: 'Complete job summary with BOM', ext: '.pdf' },
  { id: 'xml', label: 'Machine XML', description: 'Machine-specific XML program', ext: '.xml' },
  { id: 'json', label: 'JSON Export', description: 'Full data export for integration', ext: '.json' },
]

export function ExportCenter() {
  const { currentJob } = useAppStore()

  return (
    <div className="flex flex-col h-full fade-in">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <ArrowDownTrayIcon className="w-5 h-5 text-cyan-500" />
        <h1 className="text-sm font-semibold text-gray-200">Export Center</h1>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {!currentJob && (
          <div className="mb-4 px-3 py-2 bg-yellow-900/30 border border-yellow-700/50 rounded text-xs text-yellow-400">
            No job selected — select a job first.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {EXPORT_FORMATS.map((fmt) => (
            <div key={fmt.id} className="panel p-4 flex items-start gap-3">
              <DocumentTextIcon className="w-8 h-8 text-gray-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200">{fmt.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{fmt.description}</p>
                <p className="text-xs text-gray-600 mt-0.5 mono">{fmt.ext}</p>
              </div>
              <button
                className="btn-secondary text-xs shrink-0"
                disabled={!currentJob}
              >
                Export
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
