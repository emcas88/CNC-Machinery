import { CogIcon } from '@heroicons/react/24/outline'

export function MachineSetup() {
  return (
    <div className="flex flex-col h-full fade-in">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <CogIcon className="w-5 h-5 text-cyan-500" />
        <h1 className="text-sm font-semibold text-gray-200">Machine Setup</h1>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-xl space-y-6">
          <div className="panel p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">CNC Router</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Table Width (mm)', '1220'],
                ['Table Height (mm)', '2440'],
                ['Spindle RPM Max', '24000'],
                ['Feed Rate Max (mm/min)', '10000'],
                ['Plunge Rate Max (mm/min)', '3000'],
                ['Tool Change Time (s)', '12'],
              ].map(([l,v]) => (
                <div key={l}>
                  <label className="text-xs text-gray-500">{l}</label>
                  <input className="input-field w-full mt-0.5 text-xs" defaultValue={v} />
                </div>
              ))}
            </div>
          </div>
          <div className="panel p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-200">Safety</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Z Safe Height (mm)', '15'],
                ['Z Rapid Height (mm)', '5'],
                ['Clamp Zone X (mm)', '50'],
                ['Clamp Zone Y (mm)', '50'],
              ].map(([l,v]) => (
                <div key={l}>
                  <label className="text-xs text-gray-500">{l}</label>
                  <input className="input-field w-full mt-0.5 text-xs" defaultValue={v} />
                </div>
              ))}
            </div>
          </div>
          <button className="btn-primary text-xs">Save Machine Config</button>
        </div>
      </div>
    </div>
  )
}
