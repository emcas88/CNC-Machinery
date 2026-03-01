import type { Room } from '@/types'

interface RoomMeshProps {
  room: Room
}

export function RoomMesh({ room }: RoomMeshProps) {
  const w = room.width / 100
  const h = room.height / 100
  const d = room.depth / 100

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, h / 2, -d / 2]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#0f172a" roughness={1} side={2} />
      </mesh>

      {/* Left wall */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-w / 2, h / 2, 0]} receiveShadow>
        <planeGeometry args={[d, h]} />
        <meshStandardMaterial color="#0f172a" roughness={1} side={2} />
      </mesh>

      {/* Right wall */}
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[w / 2, h / 2, 0]} receiveShadow>
        <planeGeometry args={[d, h]} />
        <meshStandardMaterial color="#0f172a" roughness={1} side={2} />
      </mesh>

      {/* Grid helper for floor */}
      <gridHelper args={[Math.max(w, d), Math.max(w, d) * 2, '#1e3a5f', '#1e3a5f']} position={[0, 0.001, 0]} />
    </group>
  )
}
