import { useRef, useState, useCallback, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, Html, Edges } from '@react-three/drei'
import * as THREE from 'three'
import { CubeIcon, LightBulbIcon, CameraIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline'
import { ProductType, CabinetStyle } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CabinetDef {
  id: string
  name: string
  type: ProductType
  style: CabinetStyle
  width: number
  height: number
  depth: number
  positionX: number
  positionY: number
  positionZ: number
  color: string
}

// ---------------------------------------------------------------------------
// Demo data (mm → Three.js units in metres)
// ---------------------------------------------------------------------------

const MM = 0.001

const demoCabinets: CabinetDef[] = [
  {
    id: '1', name: 'Base Cabinet B1', type: ProductType.BASE, style: CabinetStyle.FRAMELESS,
    width: 600, height: 720, depth: 580,
    positionX: 0, positionY: 0, positionZ: 0,
    color: '#b08050',
  },
  {
    id: '2', name: 'Base Cabinet B2', type: ProductType.BASE, style: CabinetStyle.FRAMELESS,
    width: 600, height: 720, depth: 580,
    positionX: 620, positionY: 0, positionZ: 0,
    color: '#a07040',
  },
  {
    id: '3', name: 'Upper Cabinet L1', type: ProductType.UPPER, style: CabinetStyle.FRAMELESS,
    width: 600, height: 720, depth: 320,
    positionX: 0, positionY: 900, positionZ: 130,
    color: '#d4d4d4',
  },
  {
    id: '4', name: 'Upper Cabinet L2', type: ProductType.UPPER, style: CabinetStyle.FRAMELESS,
    width: 600, height: 720, depth: 320,
    positionX: 620, positionY: 900, positionZ: 130,
    color: '#d4d4d4',
  },
  {
    id: '5', name: 'Tall Pantry T1', type: ProductType.TALL, style: CabinetStyle.FRAMELESS,
    width: 600, height: 2100, depth: 580,
    positionX: 1240, positionY: 0, positionZ: 0,
    color: '#c09060',
  },
]

// ---------------------------------------------------------------------------
// Cabinet mesh
// ---------------------------------------------------------------------------

const PANEL_THICKNESS = 18 * MM

function CabinetBox({
  cabinet,
  selected,
  onSelect,
  wireframe,
  showDimensions,
}: {
  cabinet: CabinetDef
  selected: boolean
  onSelect: () => void
  wireframe: boolean
  showDimensions: boolean
}) {
  const w = cabinet.width * MM
  const h = cabinet.height * MM
  const d = cabinet.depth * MM
  const px = cabinet.positionX * MM
  const py = cabinet.positionY * MM + h / 2
  const pz = cabinet.positionZ * MM

  const panels = useMemo(() => {
    const t = PANEL_THICKNESS
    const result: { pos: [number, number, number]; size: [number, number, number]; color: string }[] = []
    const body = cabinet.color
    const inner = '#f5e6d0'

    // Left side
    result.push({ pos: [-w / 2 + t / 2, 0, 0], size: [t, h, d], color: body })
    // Right side
    result.push({ pos: [w / 2 - t / 2, 0, 0], size: [t, h, d], color: body })
    // Bottom
    result.push({ pos: [0, -h / 2 + t / 2, 0], size: [w - 2 * t, t, d], color: inner })
    // Top
    result.push({ pos: [0, h / 2 - t / 2, 0], size: [w - 2 * t, t, d], color: body })
    // Back panel (thin)
    const backT = 6 * MM
    result.push({ pos: [0, 0, -d / 2 + backT / 2], size: [w - 2 * t, h - 2 * t, backT], color: inner })
    // Shelf (middle)
    if (h > 0.5) {
      result.push({ pos: [0, 0, t / 2], size: [w - 2 * t, t, d - t], color: inner })
    }

    return result
  }, [w, h, d, cabinet.color])

  return (
    <group position={[px + w / 2, py, pz + d / 2]} onClick={(e) => { e.stopPropagation(); onSelect() }}>
      {panels.map((panel, i) => (
        <mesh key={i} position={panel.pos} castShadow receiveShadow>
          <boxGeometry args={panel.size} />
          <meshStandardMaterial
            color={selected ? '#06b6d4' : panel.color}
            wireframe={wireframe}
            transparent={wireframe}
            opacity={wireframe ? 0.6 : 1}
          />
          {selected && !wireframe && <Edges color="#06b6d4" threshold={15} />}
        </mesh>
      ))}

      {showDimensions && (
        <Html position={[0, h / 2 + 0.05, 0]} center distanceFactor={3}>
          <div className="bg-gray-900/90 text-cyan-300 text-[10px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap border border-gray-700">
            {cabinet.width}×{cabinet.height}×{cabinet.depth}
          </div>
        </Html>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Camera controller – driven by view preset
// ---------------------------------------------------------------------------

type ViewPreset = 'front' | 'back' | 'left' | 'right' | 'top' | 'iso'

const VIEW_POSITIONS: Record<ViewPreset, [number, number, number]> = {
  front: [1, 0.8, 4],
  back:  [1, 0.8, -4],
  left:  [-4, 0.8, 0],
  right: [4, 0.8, 0],
  top:   [1, 5, 0.01],
  iso:   [3, 2.5, 3],
}

function CameraRig({ preset }: { preset: ViewPreset }) {
  const { camera } = useThree()
  const target = useMemo(() => new THREE.Vector3(1, 0.8, 0), [])

  useMemo(() => {
    const [x, y, z] = VIEW_POSITIONS[preset]
    camera.position.set(x, y, z)
    camera.lookAt(target)
  }, [preset, camera, target])

  return <OrbitControls target={target} enableDamping dampingFactor={0.1} />
}

// ---------------------------------------------------------------------------
// Floor + back wall
// ---------------------------------------------------------------------------

function Room() {
  return (
    <>
      <Grid
        args={[10, 10]}
        position={[0, 0, 0]}
        cellSize={0.1}
        cellThickness={0.5}
        cellColor="#1e293b"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#334155"
        fadeDistance={8}
        fadeStrength={1.5}
        infiniteGrid
      />
      {/* Back wall hint */}
      <mesh position={[1, 1.2, -0.01]} receiveShadow>
        <planeGeometry args={[4, 2.4]} />
        <meshStandardMaterial color="#1e1e2e" transparent opacity={0.3} />
      </mesh>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ThreeDViewer() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewPreset, setViewPreset] = useState<ViewPreset>('iso')
  const [wireframe, setWireframe] = useState(false)
  const [shadows, setShadows] = useState(true)
  const [showDimensions, setShowDimensions] = useState(false)

  const viewControls: { label: string; shortcut: string; preset: ViewPreset }[] = [
    { label: 'Front', shortcut: 'F', preset: 'front' },
    { label: 'Back', shortcut: 'B', preset: 'back' },
    { label: 'Left', shortcut: 'L', preset: 'left' },
    { label: 'Right', shortcut: 'R', preset: 'right' },
    { label: 'Top', shortcut: 'T', preset: 'top' },
    { label: 'Iso', shortcut: 'I', preset: 'iso' },
  ]

  const selectedCabinet = demoCabinets.find((c) => c.id === selectedId)

  return (
    <div className="flex h-full bg-gray-900">
      {/* 3D Viewport */}
      <div className="flex-1 relative bg-gray-950">
        <Canvas
          shadows={shadows}
          camera={{ position: [3, 2.5, 3], fov: 45, near: 0.01, far: 100 }}
          onPointerMissed={() => setSelectedId(null)}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
        >
          <color attach="background" args={['#0c0e14']} />
          <fog attach="fog" args={['#0c0e14', 6, 14]} />

          <CameraRig preset={viewPreset} />

          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[4, 6, 3]}
            intensity={1.4}
            castShadow={shadows}
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-far={20}
            shadow-camera-left={-5}
            shadow-camera-right={5}
            shadow-camera-top={5}
            shadow-camera-bottom={-5}
          />
          <directionalLight position={[-3, 2, -2]} intensity={0.3} />
          <Environment preset="warehouse" background={false} environmentIntensity={0.15} />

          <Room />

          {demoCabinets.map((cab) => (
            <CabinetBox
              key={cab.id}
              cabinet={cab}
              selected={cab.id === selectedId}
              onSelect={() => setSelectedId(cab.id)}
              wireframe={wireframe}
              showDimensions={showDimensions}
            />
          ))}
        </Canvas>

        {/* View preset buttons */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="flex gap-1 pointer-events-auto">
            {viewControls.map((v) => (
              <button
                key={v.label}
                onClick={() => setViewPreset(v.preset)}
                className={`px-2 py-1 bg-gray-800/80 backdrop-blur text-xs rounded border transition-colors ${
                  viewPreset === v.preset
                    ? 'text-cyan-300 border-cyan-600'
                    : 'text-gray-300 border-gray-700 hover:bg-gray-700'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom info bar */}
        <div className="absolute bottom-3 left-3 bg-gray-800/80 backdrop-blur rounded-lg px-3 py-1.5 text-xs text-gray-400 border border-gray-700">
          Orbit: Left drag &nbsp;|&nbsp; Pan: Right drag &nbsp;|&nbsp; Zoom: Scroll
          {selectedCabinet && (
            <span className="ml-3 text-cyan-400">
              Selected: {selectedCabinet.name} ({selectedCabinet.width}×{selectedCabinet.height}×{selectedCabinet.depth}mm)
            </span>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="w-56 bg-gray-800 border-l border-gray-700 p-4 space-y-4 overflow-y-auto">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Scene Objects</h3>
          <div className="space-y-0.5">
            {demoCabinets.map((cab) => (
              <button
                key={cab.id}
                onClick={() => setSelectedId(cab.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                  cab.id === selectedId
                    ? 'bg-cyan-900/40 text-cyan-300'
                    : 'hover:bg-gray-700 text-gray-300'
                }`}
              >
                <CubeIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs truncate">{cab.name}</span>
              </button>
            ))}
          </div>
        </div>

        {selectedCabinet && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Properties</h3>
            <div className="space-y-1.5 text-xs">
              {[
                ['Type', selectedCabinet.type],
                ['Style', selectedCabinet.style],
                ['Width', `${selectedCabinet.width} mm`],
                ['Height', `${selectedCabinet.height} mm`],
                ['Depth', `${selectedCabinet.depth} mm`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500">{label}</span>
                  <span className="text-gray-200 font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Render Settings</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={wireframe}
                onChange={(e) => setWireframe(e.target.checked)}
                className="rounded border-gray-600"
              />
              <span className="text-xs text-gray-300">Wireframe</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={shadows}
                onChange={(e) => setShadows(e.target.checked)}
                className="rounded border-gray-600"
              />
              <span className="text-xs text-gray-300">Shadows</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showDimensions}
                onChange={(e) => setShowDimensions(e.target.checked)}
                className="rounded border-gray-600"
              />
              <span className="text-xs text-gray-300">Show Dimensions</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
