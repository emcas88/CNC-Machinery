import { DocumentStackIcon } from '@heroicons/react/24/outline'
import { useAppStore } from '@/store'

const PRINT_PRESETS = [
  { id: 'labels', name: 'Part Labels', description: 'All labels for current job', count: 0 },
  { id: 'cutlist', name: 'Cut List', description: 'Full cut list sorted by sheet', count: 0 },
  { id: 'bom', name: 'Bill of Materials', description: 'Material and hardware BOM', count: 0 },
  { id: 'job-sheet', name: 'Job Sheet', description: 'Summary sheet for the shopfloor', count: 1 },
  { id: 'nest', name: 'Nesting Sheets', description: 'One page per optimized sheet', count: 0 },
]

export function MultiPrintEditor() {
  const { currentJob } = useAppStore()

  return (
    <div className="flex flex-col h-full fade-in">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <DocumentStackIcon className="w-5 h-5 text-cyan-500" />
        <h1 className="text-sm font-semibold text-gray-200">Multi-Print Editor</h1>
        <div className="flex-1" />
        <button className="btn-primary text-xs" disabled={!currentJob}>Print All</button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {!currentJob && (
          <div className="mb-4 px-3 py-2 bg-yellow-900/30 border border-yellow-700/50 rounded text-xs text-yellow-400">
            No job selected
          </div>
        )}
        <div className="space-y-2 max-w-lg">
          {PRINT_PRESETS.map((p) => (
            <div key={p.id} className="panel p-4 flex items-center gap-4">
              <DocumentStackIcon className="w-8 h-8 text-gray-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-200">{p.name}</p>
                <p className="text-xs text-gray-500">{p.description}</p>
              </div>
              <span className="text-xs text-gray-600 mono">{p.count} pages</span>
              <button className="btn-secondary text-xs" disabled={!currentJob}>Print</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
