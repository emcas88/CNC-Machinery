/**
 * ThreeDViewer — Main Component
 * Feature 18: ThreeDViewer/Component Unification
 *
 * Unified 3D viewer for CNC cabinet/part geometry.
 * Uses @react-three/fiber + @react-three/drei.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';

import type {
  ThreeDViewerProps,
  ViewMode,
  CameraPresetName,
  SelectionState,
  ScreenshotOptions,
  ScreenshotResult,
  DimensionAnnotationData,
  SceneData,
  ExplodedState,
} from './types';

import { CabinetMesh }         from './components/CabinetMesh';
import { DimensionAnnotation, generateBBoxAnnotations } from './components/DimensionAnnotation';
import { ViewControls }         from './components/ViewControls';
import { ExplodedView }         from './components/ExplodedView';
import { useExplodedView }      from './hooks';
import { DEFAULT_PRESETS }      from './hooks';

// ---------------------------------------------------------------------------
// Inner scene — rendered inside <Canvas>
// ---------------------------------------------------------------------------

interface InnerSceneProps {
  scene: SceneData;
  viewMode: ViewMode;
  selection: SelectionState;
  onPartSelect: (id: string | null) => void;
  showDimensions: boolean;
  explodedState: ExplodedState;
  onCameraReady: (cam: THREE.Camera) => void;
  currentPreset: CameraPresetName;
  screenshotRequest: number;
  onScreenshotDone: (result: ScreenshotResult) => void;
}

const InnerScene: React.FC<InnerSceneProps> = ({
  scene,
  viewMode,
  selection,
  onPartSelect,
  showDimensions,
  explodedState,
  onCameraReady,
  currentPreset,
  screenshotRequest,
  onScreenshotDone,
}) => {
  const { camera, gl, scene: threeScene } = useThree();
  const orbitRef = useRef<any>(null);

  // Notify parent about camera so it can drive presets
  useEffect(() => {
    onCameraReady(camera);
  }, [camera, onCameraReady]);

  // Apply camera preset when it changes
  useEffect(() => {
    const preset = DEFAULT_PRESETS.find((p) => p.name === currentPreset);
    if (!preset) return;
    camera.position.set(preset.position.x, preset.position.y, preset.position.z);
    if (orbitRef.current) {
      orbitRef.current.target.set(
        preset.target.x,
        preset.target.y,
        preset.target.z,
      );
      orbitRef.current.update();
    } else {
      camera.lookAt(new THREE.Vector3(preset.target.x, preset.target.y, preset.target.z));
    }
    if (camera instanceof THREE.PerspectiveCamera && preset.fov) {
      camera.fov = preset.fov;
      camera.updateProjectionMatrix();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPreset]);

  // Handle screenshot request
  useEffect(() => {
    if (screenshotRequest === 0) return;
    // Render one frame then capture
    gl.render(threeScene, camera);
    const dataUrl = gl.domElement.toDataURL('image/png');
    onScreenshotDone({
      dataUrl,
      width:     gl.domElement.width,
      height:    gl.domElement.height,
      timestamp: new Date().toISOString(),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenshotRequest]);

  const wireframe = viewMode === 'wireframe';
  const xray      = viewMode === 'xray';

  // Compute bounding box for dimension annotations
  const boundingBox = useMemo(() => {
    if (scene.boundingBox) {
      return {
        min: new THREE.Vector3(
          scene.boundingBox.min.x,
          scene.boundingBox.min.y,
          scene.boundingBox.min.z,
        ),
        max: new THREE.Vector3(
          scene.boundingBox.max.x,
          scene.boundingBox.max.y,
          scene.boundingBox.max.z,
        ),
      };
    }
    // Compute from parts
    const box = new THREE.Box3();
    for (const part of scene.parts) {
      const halfW = part.dimensions.width  / 2;
      const halfH = part.dimensions.height / 2;
      const halfD = part.dimensions.depth  / 2;
      const p     = part.transform.position;
      box.expandByPoint(new THREE.Vector3(p.x - halfW, p.y - halfH, p.z - halfD));
      box.expandByPoint(new THREE.Vector3(p.x + halfW, p.y + halfH, p.z + halfD));
    }
    return box.isEmpty() ? null : { min: box.min, max: box.max };
  }, [scene]);

  const annotations: DimensionAnnotationData[] = useMemo(() => {
    if (!showDimensions || !boundingBox) return [];
    return generateBBoxAnnotations(
      boundingBox.min,
      boundingBox.max,
      scene.metadata?.units ?? 'mm',
    );
  }, [showDimensions, boundingBox, scene.metadata?.units]);

  // Handle background click to deselect
  const handleMiss = useCallback(() => {
    onPartSelect(null);
  }, [onPartSelect]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[500, 800, 600]}
        intensity={0.9}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-400, 200, -400]} intensity={0.3} />
      <pointLight position={[0, 600, 0]} intensity={0.2} />

      {/* Environment for realistic mode */}
      {viewMode === 'realistic' && (
        <Environment preset="studio" background={false} />
      )}

      {/* Grid helper */}
      <gridHelper args={[2000, 20, '#333344', '#222233']} position={[0, -1, 0]} />

      {/* Cabinet */}
      <group onPointerMissed={handleMiss}>
        <CabinetMesh
          parts={scene.parts}
          selectedPartIds={selection.selectedPartIds}
          hoveredPartId={selection.hoveredPartId}
          wireframe={wireframe}
          explodedState={explodedState}
          onPartClick={onPartSelect}
          onPartHover={(id) => {
            // Hover is managed in parent
          }}
          showOperations={!wireframe}
        />
      </group>

      {/* X-ray — translucent overlay */}
      {xray && (
        <group>
          {scene.parts.map((part) => {
            const pos = part.transform.position;
            const rot = part.transform.rotation;
            return (
              <mesh
                key={`xray-${part.id}`}
                position={[pos.x, pos.y, pos.z]}
                rotation={[rot.x, rot.y, rot.z]}
              >
                <boxGeometry
                  args={[
                    part.dimensions.width,
                    part.dimensions.height,
                    part.dimensions.depth,
                  ]}
                />
                <meshStandardMaterial
                  color="#88aaff"
                  transparent
                  opacity={0.12}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
            );
          })}
        </group>
      )}

      {/* Dimension annotations */}
      {annotations.map((ann) => (
        <DimensionAnnotation
          key={ann.id}
          annotation={ann}
          color="#ffee44"
          visible={showDimensions}
        />
      ))}

      {/* Orbit controls */}
      <OrbitControls
        ref={orbitRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={50}
        maxDistance={5000}
        makeDefault
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Outer wrapper — sets up Canvas, state, and toolbar
// ---------------------------------------------------------------------------

const ThreeDViewer: React.FC<ThreeDViewerProps> = ({
  scene,
  viewMode: initialViewMode = 'solid',
  initialPreset = 'iso',
  showDimensions: initialShowDimensions = false,
  startExploded = false,
  onPartSelect,
  onScreenshot,
  backgroundColor = '#1a1a2e',
  showControls = true,
  width = '100%',
  height = 600,
  className,
}) => {
  const [viewMode, setViewMode]             = useState<ViewMode>(initialViewMode);
  const [currentPreset, setCurrentPreset]   = useState<CameraPresetName>(initialPreset);
  const [showDimensions, setShowDimensions] = useState(initialShowDimensions);
  const [screenshotRequest, setScreenshotRequest] = useState(0);
  const [selection, setSelection]           = useState<SelectionState>({
    selectedPartIds: [],
    hoveredPartId:   null,
  });

  const {
    explodedState,
    toggle: toggleExplode,
  } = useExplodedView(scene.parts);

  // Initialise exploded view if requested
  const hasInitExploded = useRef(false);
  useEffect(() => {
    if (startExploded && !hasInitExploded.current) {
      hasInitExploded.current = true;
      toggleExplode();
    }
  }, [startExploded, toggleExplode]);

  const handlePartSelect = useCallback(
    (id: string | null) => {
      setSelection((prev) => {
        const selected = id === null
          ? []
          : prev.selectedPartIds.includes(id)
            ? prev.selectedPartIds.filter((i) => i !== id)
            : [id];
        return { ...prev, selectedPartIds: selected };
      });
      onPartSelect?.(id);
    },
    [onPartSelect],
  );

  const cameraRef = useRef<THREE.Camera | null>(null);
  const handleCameraReady = useCallback((cam: THREE.Camera) => {
    cameraRef.current = cam;
  }, []);

  const handleScreenshotDone = useCallback(
    (result: ScreenshotResult) => {
      onScreenshot?.(result);
    },
    [onScreenshot],
  );

  const triggerScreenshot = useCallback(() => {
    setScreenshotRequest((n) => n + 1);
  }, []);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width:    typeof width  === 'number' ? `${width}px`  : width,
    height:   typeof height === 'number' ? `${height}px` : height,
    overflow: 'hidden',
    borderRadius: '8px',
    background: backgroundColor,
  };

  const exploded = explodedState.phase === 'exploded' || explodedState.phase === 'exploding';

  return (
    <div
      style={containerStyle}
      className={className}
      data-testid="three-d-viewer"
      aria-label="3D Cabinet Viewer"
    >
      <Canvas
        shadows
        camera={{
          fov:      45,
          near:     1,
          far:      20000,
          position: [700, 700, 700],
        }}
        gl={{
          preserveDrawingBuffer: true,   // Required for screenshots
          antialias:             true,
          toneMapping:           THREE.ACESFilmicToneMapping,
          toneMappingExposure:   1.1,
        }}
        data-testid="three-d-canvas"
      >
        <color attach="background" args={[backgroundColor]} />

        <InnerScene
          scene={scene}
          viewMode={viewMode}
          selection={selection}
          onPartSelect={handlePartSelect}
          showDimensions={showDimensions}
          explodedState={explodedState}
          onCameraReady={handleCameraReady}
          currentPreset={currentPreset}
          screenshotRequest={screenshotRequest}
          onScreenshotDone={handleScreenshotDone}
        />
      </Canvas>

      {/* Exploded view controller (logic only) */}
      <ExplodedView
        parts={scene.parts}
        explodedState={explodedState}
      />

      {/* Controls toolbar */}
      {showControls && (
        <ViewControls
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onPresetSelect={setCurrentPreset}
          onScreenshot={triggerScreenshot}
          onExplodeToggle={toggleExplode}
          exploded={exploded}
          showDimensions={showDimensions}
          onDimensionsToggle={() => setShowDimensions((s) => !s)}
        />
      )}

      {/* Selected part info badge */}
      {selection.selectedPartIds.length > 0 && (
        <div
          data-testid="selection-badge"
          style={{
            position:   'absolute',
            top:        '12px',
            right:      '12px',
            background: 'rgba(20,20,30,0.82)',
            backdropFilter: 'blur(8px)',
            borderRadius:   '8px',
            padding:    '8px 12px',
            color:      '#88ccff',
            fontSize:   '12px',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 500,
            boxShadow:  '0 2px 12px rgba(0,0,0,0.3)',
            maxWidth:   '200px',
          }}
        >
          {selection.selectedPartIds.map((id) => {
            const part = scene.parts.find((p) => p.id === id);
            return part ? (
              <div key={id} style={{ lineHeight: 1.5 }}>
                <strong>{part.name}</strong>
                <br />
                <span style={{ color: '#aaa', fontSize: '11px' }}>
                  {part.dimensions.width} × {part.dimensions.height} × {part.dimensions.depth} mm
                </span>
              </div>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
};

export default ThreeDViewer;
export { ThreeDViewer };
