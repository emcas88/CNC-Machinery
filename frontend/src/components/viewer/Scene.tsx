import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, ContactShadows } from '@react-three/drei'
import { CabinetMesh } from './CabinetMesh'
import { RoomMesh } from './RoomMesh'
import { CameraController } from './CameraController'
import type { Room, CabinetUnit } from '@/types'

interface SceneProps {
  room: Room
  cabinets: CabinetUnit[]
  selectedCabinetId?: string | null
  onCabinetClick?: (id: string) => void
}

export function Scene({ room, cabinets, selectedCabinetId, onCabinetClick }: SceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [5, 4, 5], fov: 50 }}
      className="w-full h-full"
    >
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <Suspense fallback={null}>
        <Environment preset="city" />
        <RoomMesh room={room} />
        {cabinets.map((cabinet) => (
          <CabinetMesh
            key={cabinet.id}
            cabinet={cabinet}
            selected={cabinet.id === selectedCabinetId}
            onClick={() => onCabinetClick?.(cabinet.id)}
          />
        ))}
        <ContactShadows
          position={[0, 0.001, 0]}
          opacity={0.4}
          scale={20}
          blur={1.5}
          far={10}
        />
      </Suspense>
      <CameraController />
    </Canvas>
  )
}
