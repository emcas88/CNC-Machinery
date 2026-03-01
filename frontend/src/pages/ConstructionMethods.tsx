import { BuildingLibraryIcon } from '@heroicons/react/24/outline'

/**
 * Construction Methods
 * Define cabinet construction: joining method, back panel style, system hole spacing, overlaps.
 */
export function ConstructionMethods() {
  return (
    <div className="flex flex-col h-full fade-in">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <BuildingLibraryIcon className="w-5 h-5 text-cyan-500" />
        <h1 className="text-sm font-semibold text-gray-200">Construction Methods</h1>
      </div>
      <div className="flex-1 overflow-hidden">
      <div className="flex h-full gap-4 p-4">
        <aside className="w-52 panel p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Methods</p>
            <button className="btn-ghost p-1 text-xs">+</button>
          </div>
          {['Frameless Standard','Face Frame 1/2 Overlay','Inset Face Frame','Dovetail Drawer Box','Pocket Screw'].map(m=>(
            <button key={m} className="w-full text-left px-2 py-2 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors border-b border-gray-800">{m}</button>
          ))}
        </aside>
        <div className="flex-1 panel p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-200">Frameless Standard</h3>
          <div className="grid grid-cols-2 gap-3">
            {[['Joining Method','Cam Lock'],['Back Panel','Dado'],['Bottom Panel','Dado'],['Case Thickness','18mm'],['Back Thickness','9mm'],['System Hole Spacing','32mm'],['Overlap','0mm'],['Inset Depth','0mm']].map(([l,v])=>(
              <div key={l}>
                <label className="text-xs text-gray-500">{l}</label>
                <input className="input-field w-full mt-0.5 text-xs" defaultValue={v} />
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400 mt-2">
            <input type="checkbox" defaultChecked /> Blum System Holes (32mm pitch)
          </label>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary text-xs">Save Method</button>
            <button className="btn-secondary text-xs">Apply to Products</button>
            <button className="btn-secondary text-xs">Set as Default</button>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
