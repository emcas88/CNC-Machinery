/**
 * ThreeDViewer Hooks
 * Feature 18: ThreeDViewer/Component Unification
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type {
  CameraPreset,
  CameraPresetName,
  ExplodedState,
  ExplodePhase,
  PartGeometry,
  ScreenshotOptions,
  ScreenshotResult,
  UseExplodedViewReturn,
  UseThreeSceneReturn,
  UseViewPresetsReturn,
  Vector3D,
} from './types';

// ---------------------------------------------------------------------------
// Default camera presets
// ---------------------------------------------------------------------------

const DEFAULT_PRESETS: CameraPreset[] = [
  {
    name: 'front',
    label: 'Front',
    position: { x: 0, y: 0, z: 1000 },
    target: { x: 0, y: 0, z: 0 },
    fov: 45,
  },
  {
    name: 'back',
    label: 'Back',
    position: { x: 0, y: 0, z: -1000 },
    target: { x: 0, y: 0, z: 0 },
    fov: 45,
  },
  {
    name: 'left',
    label: 'Left',
    position: { x: -1000, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    fov: 45,
  },
  {
    name: 'right',
    label: 'Right',
    position: { x: 1000, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    fov: 45,
  },
  {
    name: 'top',
    label: 'Top',
    position: { x: 0, y: 1000, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    fov: 45,
    orthographic: true,
  },
  {
    name: 'bottom',
    label: 'Bottom',
    position: { x: 0, y: -1000, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    fov: 45,
    orthographic: true,
  },
  {
    name: 'iso',
    label: 'Isometric',
    position: { x: 700, y: 700, z: 700 },
    target: { x: 0, y: 0, z: 0 },
    fov: 35,
  },
  {
    name: 'iso_back',
    label: 'Iso Back',
    position: { x: -700, y: 700, z: -700 },
    target: { x: 0, y: 0, z: 0 },
    fov: 35,
  },
];

// ---------------------------------------------------------------------------
// useThreeScene
// ---------------------------------------------------------------------------

/**
 * Manages scene setup, camera, renderer refs, and screenshot capability.
 * Must be used inside a <Canvas> from @react-three/fiber.
 */
export function useThreeScene(): UseThreeSceneReturn {
  const { camera, gl, scene } = useThree();

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Keep refs in sync with R3F context
  useEffect(() => {
    sceneRef.current = scene as THREE.Scene;
    cameraRef.current = camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
    rendererRef.current = gl as THREE.WebGLRenderer;
  }, [scene, camera, gl]);

  const takeScreenshot = useCallback(
    (opts: ScreenshotOptions = {}): ScreenshotResult | null => {
      const renderer = rendererRef.current;
      const cam = cameraRef.current;
      const sc = sceneRef.current;
      if (!renderer || !cam || !sc) return null;

      const {
        width = renderer.domElement.width,
        height = renderer.domElement.height,
        format = 'image/png',
        quality = 0.95,
      } = opts;

      // Render to a temporary render target at the desired resolution
      const savedSize = new THREE.Vector2();
      renderer.getSize(savedSize);

      renderer.setSize(width, height, false);
      renderer.render(sc, cam);
      const dataUrl = renderer.domElement.toDataURL(format, quality);

      // Restore original size
      renderer.setSize(savedSize.x, savedSize.y, false);

      return {
        dataUrl,
        width,
        height,
        timestamp: new Date().toISOString(),
      };
    },
    [],
  );

  return { sceneRef, cameraRef, rendererRef, takeScreenshot };
}

// ---------------------------------------------------------------------------
// useExplodedView
// ---------------------------------------------------------------------------

const EXPLODE_DURATION_MS = 800;
const COLLAPSE_DURATION_MS = 600;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function lerpVec3(a: Vector3D, b: Vector3D, t: number): Vector3D {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

/**
 * Handles explode/collapse animation for a set of parts.
 * Returns current exploded state and control functions.
 */
export function useExplodedView(parts: PartGeometry[]): UseExplodedViewReturn {
  const [magnitude, setMagnitude] = useState(1.5);
  const [phase, setPhase] = useState<ExplodePhase>('collapsed');
  const [progress, setProgress] = useState(0);
  const animationStartRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Compute base (collapsed) positions from part transforms
  const basePositions = useCallback((): Record<string, Vector3D> => {
    const result: Record<string, Vector3D> = {};
    for (const part of parts) {
      result[part.id] = { ...part.transform.position };
    }
    return result;
  }, [parts]);

  // Compute target (exploded) positions
  const explodedPositions = useCallback(
    (mag: number): Record<string, Vector3D> => {
      const result: Record<string, Vector3D> = {};
      for (const part of parts) {
        const axis = part.explodeAxis ?? { x: 0, y: 1, z: 0 };
        const dist = (part.explodeDistance ?? 200) * mag;
        result[part.id] = {
          x: part.transform.position.x + axis.x * dist,
          y: part.transform.position.y + axis.y * dist,
          z: part.transform.position.z + axis.z * dist,
        };
      }
      return result;
    },
    [parts],
  );

  const computePartPositions = useCallback(
    (prog: number): Record<string, Vector3D> => {
      const base = basePositions();
      const exploded = explodedPositions(magnitude);
      const result: Record<string, Vector3D> = {};
      for (const part of parts) {
        result[part.id] = lerpVec3(base[part.id], exploded[part.id], prog);
      }
      return result;
    },
    [basePositions, explodedPositions, magnitude, parts],
  );

  const [explodedState, setExplodedState] = useState<ExplodedState>(() => ({
    phase: 'collapsed',
    progress: 0,
    magnitude,
    partPositions: basePositions(),
  }));

  // Cancel any running animation
  const cancelAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    animationStartRef.current = null;
  }, []);

  const animate = useCallback(
    (
      fromProgress: number,
      toProgress: number,
      duration: number,
      endPhase: ExplodePhase,
      onComplete?: () => void,
    ) => {
      cancelAnimation();
      animationStartRef.current = performance.now();

      const step = (now: number) => {
        const elapsed = now - (animationStartRef.current ?? now);
        const t = Math.min(elapsed / duration, 1);
        const easedT = easeInOut(t);
        const currentProgress = lerp(fromProgress, toProgress, easedT);

        setProgress(currentProgress);
        setPhase(t < 1 ? (toProgress > 0 ? 'exploding' : 'collapsing') : endPhase);

        const partPositions = computePartPositions(currentProgress);
        setExplodedState({
          phase: t < 1 ? (toProgress > 0 ? 'exploding' : 'collapsing') : endPhase,
          progress: currentProgress,
          magnitude,
          partPositions,
        });

        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
          onComplete?.();
        }
      };

      rafRef.current = requestAnimationFrame(step);
    },
    [cancelAnimation, computePartPositions, magnitude],
  );

  const triggerExplode = useCallback(() => {
    const currentProgress = progress;
    animate(currentProgress, 1, EXPLODE_DURATION_MS * (1 - currentProgress), 'exploded');
  }, [animate, progress]);

  const triggerCollapse = useCallback(() => {
    const currentProgress = progress;
    animate(currentProgress, 0, COLLAPSE_DURATION_MS * currentProgress, 'collapsed');
  }, [animate, progress]);

  const toggle = useCallback(() => {
    if (phase === 'collapsed' || phase === 'collapsing') {
      triggerExplode();
    } else {
      triggerCollapse();
    }
  }, [phase, triggerExplode, triggerCollapse]);

  const handleSetMagnitude = useCallback(
    (newMag: number) => {
      setMagnitude(newMag);
      // Re-compute positions at current progress with new magnitude
      const mag = newMag;
      const base = basePositions();
      const exploded = explodedPositions(mag);
      const partPositions: Record<string, Vector3D> = {};
      for (const part of parts) {
        partPositions[part.id] = lerpVec3(base[part.id], exploded[part.id], progress);
      }
      setExplodedState((prev) => ({ ...prev, magnitude: mag, partPositions }));
    },
    [basePositions, explodedPositions, parts, progress],
  );

  // Cleanup on unmount
  useEffect(() => () => cancelAnimation(), [cancelAnimation]);

  const isAnimating = phase === 'exploding' || phase === 'collapsing';

  return {
    explodedState,
    triggerExplode,
    triggerCollapse,
    toggle,
    setMagnitude: handleSetMagnitude,
    isAnimating,
  };
}

// ---------------------------------------------------------------------------
// useViewPresets
// ---------------------------------------------------------------------------

/**
 * Provides camera preset positions and applies them to the R3F camera.
 * Must be used inside a <Canvas> from @react-three/fiber.
 */
export function useViewPresets(
  presets: CameraPreset[] = DEFAULT_PRESETS,
): UseViewPresetsReturn {
  const [currentPreset, setCurrentPreset] = useState<CameraPresetName>('iso');

  // Always call useThree (Rules of Hooks) — our mock handles the test environment.
  const state = useThree();
  const camera = state?.camera as THREE.Camera | undefined;
  const controls = (state as any)?.controls;

  const getPreset = useCallback(
    (name: CameraPresetName) => presets.find((p) => p.name === name),
    [presets],
  );

  const applyPreset = useCallback(
    (name: CameraPresetName) => {
      const preset = getPreset(name);
      if (!preset) return;
      setCurrentPreset(name);

      if (camera) {
        camera.position.set(preset.position.x, preset.position.y, preset.position.z);
        camera.lookAt(new THREE.Vector3(preset.target.x, preset.target.y, preset.target.z));

        if (camera instanceof THREE.PerspectiveCamera && preset.fov) {
          camera.fov = preset.fov;
          camera.updateProjectionMatrix();
        }
        if (controls && typeof controls.target?.set === 'function') {
          controls.target.set(preset.target.x, preset.target.y, preset.target.z);
          controls.update?.();
        }
      }
    },
    [camera, controls, getPreset],
  );

  return {
    presets,
    currentPreset,
    applyPreset,
    getPreset,
  };
}

// ---------------------------------------------------------------------------
// Re-export DEFAULT_PRESETS for use in tests and components
// ---------------------------------------------------------------------------
export { DEFAULT_PRESETS };
