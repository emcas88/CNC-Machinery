import { useRef, useState, useEffect } from 'react'
import { CubeIcon, SwatchIcon, ArrowsPointingOutIcon, EyeIcon } from '@heroicons/react/24/outline'

type Tool = 'select' | 'wall' | 'cabinet' | 'measure'
type ViewMode = '2d' | '3d'

interface RoomObject {
  id: string
  type: 'wall' | 'cabinet' | 'window' | 'door'
  x: number
  y: number
  width: number
  height: number
  label: string
  color: string
}

export function RoomDesigner() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [activeTool, setActiveTool] = useState<Tool>('select')
  const [viewMode, setViewMode] = useState<ViewMode>('2d')
  const [selectedObject, setSelectedObject] = useState<string | null>(null)

  const roomObjects: RoomObject[] = [
    { id: 'w1', type: 'wall', x: 50, y: 50, width: 600, height: 12, label: 'North Wall', color: '#6b7280' },
    { id: 'w2', type: 'wall', x: 50, y: 50, width: 12, height: 400, label: 'West Wall', color: '#6b7280' },
    { id: 'w3', type: 'wall', x: 638, y: 50, width: 12, height: 400, label: 'East Wall', color: '#6b7280' },
    { id: 'w4', type: 'wall', x: 50, y: 438, width: 600, height: 12, label: 'South Wall', color: '#6b7280' },
    { id: 'c1', type: 'cabinet', x: 80, y: 70, width: 120, height: 60, label: 'Upper L1', color: '#4f46e5' },
    { id: 'c2', type: 'cabinet', x: 210, y: 70, width: 120, height: 60, label: 'Upper L2', color: '#4f46e5' },
    { id: 'c3', type: 'cabinet', x: 340, y: 70, width: 120, height: 60, label: 'Upper L3', color: '#4f46e5' },
    { id: 'c4', type: 'cabinet', x: 80, y: 360, width: 180, height: 70, label: 'Base B1', color: '#7c3aed' },
    { id: 'c5', type: 'cabinet', x: 270, y: 360, width: 180, height: 70, label: 'Base B2', color: '#7c3aed' },
    { id: 'd1', type: 'door', x: 500, y: 438, width: 80, height: 12, label: 'Door', color: '#d97706' },
    { id: 'wn1', type: 'window', x: 200, y: 50, width: 120, height: 12, label: 'Window', color: '#0ea5e9' },
  ]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Grid
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 0.5
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke()
    }

    // Objects
    roomObjects.forEach(obj => {
      const isSelected = obj.id === selectedObject
      ctx.fillStyle = obj.color + (obj.type === 'wall' ? 'ff' : '99')
      ctx.fillRect(obj.x, obj.y, obj.width, obj.height)
      if (isSelected) {
        ctx.strokeStyle = '#f59e0b'
        ctx.lineWidth = 2
        ctx.strokeRect(obj.x - 1, obj.y - 1, obj.width + 2, obj.height + 2)
      }
      // Label
      if (obj.type !== 'wall') {
        ctx.fillStyle = '#fff'
        ctx.font = '9px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(obj.label, obj.x + obj.width / 2, obj.y + obj.height / 2 + 3)
      }
    })
  }, [selectedObject])

  const tools: { id: Tool; label: string; icon: React.ReactNode }[] = [
    { id: 'select', label: 'Select', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg> },
    { id: 'wall', label: 'Wall', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> },
    { id: 'cabinet', label: 'Cabinet', icon: <CubeIcon className="w-4 h-4" /> },
    { id: 'measure', label: 'Measure', icon: <ArrowsPointingOutIcon className="w-4 h-4" /> },
  ]

  return (
    <div className="flex h-full bg-gray-900">
      {/* Left Toolbar */}
      <div className="w-16 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-4 gap-2">
        {tools.map(tool => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            title={tool.label}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              activeTool === tool.id
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {tool.icon}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setViewMode(v => v === '2d' ? '3d' : '2d')}
          title="Toggle 2D/3D"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
        >
          {viewMode === '2d' ? <EyeIcon className="w-4 h-4" /> : <SwatchIcon className="w-4 h-4" />}
        </button>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute top-3 left-3 bg-gray-800/80 backdrop-blur rounded-lg px-3 py-1.5 text-xs text-gray-300 border border-gray-700">
          View: {viewMode.toUpperCase()} &nbsp;|&nbsp; Tool: {activeTool}
        </div>
        {viewMode === '2d' ? (
          <canvas
            ref={canvasRef}
            width={700}
            height={500}
            className="w-full h-full object-contain cursor-crosshair"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const scaleX = 700 / rect.width
              const scaleY = 500 / rect.height
              const mx = (e.clientX - rect.left) * scaleX
              const my = (e.clientY - rect.top) * scaleY
              const hit = roomObjects.find(o => mx >= o.x && mx <= o.x + o.width && my >= o.y && my <= o.y + o.height)
              setSelectedObject(hit?.id ?? null)
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <CubeIcon className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">3D View</p>
              <p className="text-sm">Three.js integration coming soon</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Properties Panel */}
      <div className="w-56 bg-gray-800 border-l border-gray-700 p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Properties</h3>
        {selectedObject ? (
          <div className="space-y-3">
            {(() => {
              const obj = roomObjects.find(o => o.id === selectedObject)!
              return (
                <>
                  <div>
                    <label className="text-xs text-gray-500">Label</label>
                    <p className="text-sm text-white">{obj.label}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Type</label>
                    <p className="text-sm text-white capitalize">{obj.type}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">W</label>
                      <p className="text-sm text-white">{obj.width}px</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">H</label>
                      <p className="text-sm text-white">{obj.height}px</p>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Click an object to select</p>
        )}
      </div>
    </div>
  )
}
