import { useRef } from 'react'
import { Mesh } from 'three'
import type { CabinetUnit } from '@/types'

interface CabinetMeshProps {
  cabinet: CabinetUnit
  selected?: boolean
  onClick?: () => void
}

export function CabinetMesh({ cabinet, selected = false, onClick }: CabinetMeshProps) {
  const meshRef = useRef<Mesh>(null)

  const { width, height, depth } = cabinet.dimensions
  // Convert mm to scene units (1 unit = 100mm)
  const w = width / 100
  const h = height / 100
  const d = depth / 100

  const x = (cabinet.position?.x ?? 0) / 100
  const y = h / 2 // sit on floor
  const z = (cabinet.position?.z ?? 0) / 100

  return (
    <mesh
      ref={meshRef}
      position={[x, y, z]}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial
        color={selected ? '#0e7490' : '#334155'}
        emissive={selected ? '#0e7490' : '#000000'}
        emissiveIntensity={selected ? 0.2 : 0}
        roughness={0.7}
        metalness={0.1}
      />
    </mesh>
  )
}
