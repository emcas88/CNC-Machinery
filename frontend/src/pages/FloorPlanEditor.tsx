import { HomeModernIcon } from '@heroicons/react/24/outline'

export function FloorPlanEditor() {
  return (
    <div className="flex flex-col h-full fade-in">
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <HomeModernIcon className="w-5 h-5 text-cyan-500" />
        <h1 className="text-sm font-semibold text-gray-200">Floor Plan Editor</h1>
      </div>
      <div className="flex-1 flex items-center justify-center bg-gray-950 canvas-container">
        <div className="text-center text-gray-600">
          <HomeModernIcon className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Floor Plan Editor</p>
          <p className="text-xs mt-1">2D room layout coming soon</p>
        </div>
      </div>
    </div>
  )
}
