import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

interface CameraControllerProps {
  target?: [number, number, number]
  autoRotate?: boolean
}

export function CameraController({ target = [0, 0, 0], autoRotate = false }: CameraControllerProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const { camera } = useThree()

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(...target)
      controlsRef.current.update()
    }
  }, [target])

  return (
    <OrbitControls
      ref={controlsRef}
      camera={camera}
      enableDamping
      dampingFactor={0.05}
      autoRotate={autoRotate}
      autoRotateSpeed={0.5}
      minPolarAngle={0}
      maxPolarAngle={Math.PI / 2}
    />
  )
}
