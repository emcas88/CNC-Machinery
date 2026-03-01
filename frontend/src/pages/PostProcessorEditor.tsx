import { CommandLineIcon } from '@heroicons/react/24/outline'

const POST_PROCESSORS = [
  'Generic FANUC',
  'Biesse Rover',
  'Homag WoodWOP',
  'SCM Pratix',
  'AXYZ CNC',
  'ShopBot',
]

export function PostProcessorEditor() {
  return (
    <div className="flex flex-col h-full fade-in">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <CommandLineIcon className="w-5 h-5 text-cyan-500" />
        <h1 className="text-sm font-semibold text-gray-200">Post Processor Editor</h1>
      </div>
      <div className="flex flex-1 overflow-hidden gap-4 p-4">
        <aside className="w-44 panel p-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Processors</p>
          {POST_PROCESSORS.map(pp => (
            <button key={pp} className="w-full text-left px-2 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded border-b border-gray-800 transition-colors">{pp}</button>
          ))}
          <button className="w-full mt-2 btn-ghost text-xs">+ New PP</button>
        </aside>
        <div className="flex-1 panel p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-200">Generic FANUC</h3>
          <div className="grid grid-cols-2 gap-3">
            {[['Header Template','%'],['Tool Change','M6 T{tool}'],['Spindle On','M3 S{rpm}'],['Feed','F{feed}'],['Footer','M30 %'],['Extension','.nc']].map(([l,v])=>(
              <div key={l}>
                <label className="text-xs text-gray-500">{l}</label>
                <input className="input-field w-full mt-0.5 text-xs font-mono" defaultValue={v} />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary text-xs">Save Processor</button>
            <button className="btn-secondary text-xs">Test Output</button>
            <button className="btn-secondary text-xs">Export</button>
          </div>
        </div>
      </div>
    </div>
  )
}
