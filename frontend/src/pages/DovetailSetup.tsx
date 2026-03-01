import { BeakerIcon } from '@heroicons/react/24/outline'

export function DovetailSetup() {
  return (
    <div className="flex flex-col h-full fade-in">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <BeakerIcon className="w-5 h-5 text-cyan-500" />
        <h1 className="text-sm font-semibold text-gray-200">Dovetail Setup</h1>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-xl space-y-6">
          <div className="panel p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">Bit Settings</h3>
            <div className="grid grid-cols-2 gap-3">
              {[['Bit Diameter (mm)','12.7'],['Cutting Depth (mm)','12'],['Flute Angle (°)','14'],['Pitch (mm)','9.5']].map(([l,v])=>(
                <div key={l}>
                  <label className="text-xs text-gray-500">{l}</label>
                  <input className="input-field w-full mt-0.5 text-xs" defaultValue={v} />
                </div>
              ))}
            </div>
          </div>
          <div className="panel p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">Drawer Box Dimensions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[['Box Height (mm)','82'],['Side Thickness (mm)','12'],['Bottom Groove (mm)','6'],['Bottom Setback (mm)','5']].map(([l,v])=>(
                <div key={l}>
                  <label className="text-xs text-gray-500">{l}</label>
                  <input className="input-field w-full mt-0.5 text-xs" defaultValue={v} />
                </div>
              ))}
            </div>
          </div>
          <div className="panel p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">Machine Offsets</h3>
            <div className="grid grid-cols-2 gap-3">
              {[['X Offset (mm)','0.0'],['Y Offset (mm)','0.0'],['Z Clearance (mm)','5'],['Feed Rate (mm/min)','1200']].map(([l,v])=>(
                <div key={l}>
                  <label className="text-xs text-gray-500">{l}</label>
                  <input className="input-field w-full mt-0.5 text-xs" defaultValue={v} />
                </div>
              ))}
            </div>
          </div>
          <button className="btn-primary text-xs">Save Dovetail Config</button>
        </div>
      </div>
    </div>
  )
}
