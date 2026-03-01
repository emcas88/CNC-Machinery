import { CubeIcon, LightBulbIcon, CameraIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline'

export function ThreeDViewer() {
  const viewControls = [
    { label: 'Front', shortcut: 'F' },
    { label: 'Back', shortcut: 'B' },
    { label: 'Left', shortcut: 'L' },
    { label: 'Right', shortcut: 'R' },
    { label: 'Top', shortcut: 'T' },
    { label: 'Iso', shortcut: 'I' },
  ]

  return (
    <div className="flex h-full bg-gray-900">
      {/* 3D Viewport */}
      <div className="flex-1 relative bg-gray-950">
        {/* Placeholder viewport */}
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <CubeIcon className="w-24 h-24 text-indigo-500/30 mx-auto mb-4" />
            <p className="text-gray-400 text-lg font-medium">3D Viewport</p>
            <p className="text-gray-600 text-sm mt-1">Three.js / WebGL renderer</p>
          </div>
        </div>

        {/* Top bar */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <div className="flex gap-1">
            {viewControls.map(v => (
              <button
                key={v.label}
                className="px-2 py-1 bg-gray-800/80 backdrop-blur text-xs text-gray-300 rounded border border-gray-700 hover:bg-gray-700 transition-colors"
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="p-1.5 bg-gray-800/80 backdrop-blur rounded border border-gray-700 text-gray-400 hover:text-white transition-colors">
              <LightBulbIcon className="w-4 h-4" />
            </button>
            <button className="p-1.5 bg-gray-800/80 backdrop-blur rounded border border-gray-700 text-gray-400 hover:text-white transition-colors">
              <CameraIcon className="w-4 h-4" />
            </button>
            <button className="p-1.5 bg-gray-800/80 backdrop-blur rounded border border-gray-700 text-gray-400 hover:text-white transition-colors">
              <ArrowsRightLeftIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom info bar */}
        <div className="absolute bottom-3 left-3 bg-gray-800/80 backdrop-blur rounded-lg px-3 py-1.5 text-xs text-gray-400 border border-gray-700">
          Orbit: Left drag &nbsp;|&nbsp; Pan: Right drag &nbsp;|&nbsp; Zoom: Scroll
        </div>
      </div>

      {/* Right panel */}
      <div className="w-56 bg-gray-800 border-l border-gray-700 p-4 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Scene Objects</h3>
          <div className="space-y-1">
            {['Upper Cabinet L1', 'Upper Cabinet L2', 'Base Cabinet B1', 'Island IC1'].map(name => (
              <div key={name} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-700 cursor-pointer">
                <CubeIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs text-gray-300">{name}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Render Settings</h3>
          <div className="space-y-2">
            {['Wireframe', 'Shadows', 'Show Dimensions'].map(opt => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked={opt === 'Shadows'} className="rounded border-gray-600" />
                <span className="text-xs text-gray-300">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
