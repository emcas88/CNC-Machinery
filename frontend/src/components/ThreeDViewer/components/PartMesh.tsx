/**
 * PartMesh Component
 * Renders a single cabinet part with its machining operations visible.
 * Bores → cylinders, dados/rabbets → box cutouts (CSG approximation via
 * subtractive meshes rendered slightly inside the part).
 * Feature 18: ThreeDViewer/Component Unification
 */

import React, { useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import type { PartMeshProps, OperationGeometry } from '../types';
import { WoodMaterial } from './WoodMaterial';

// ---------------------------------------------------------------------------
// Sub-component: BoreOperation — renders a bore as a dark cylinder
// ---------------------------------------------------------------------------

interface BoreProps {
  op: OperationGeometry;
  partDimensions: { width: number; height: number; depth: number };
}

const BoreOperation: React.FC<BoreProps> = ({ op, partDimensions }) => {
  const radius    = (op.radius ?? (op.diameter ?? 10) / 2);
  const depth     = op.depth ?? 20;
  const segments  = 24;

  // Position: op.position is relative to part origin (centre of part at 0,0,0)
  // Cylinders open along Y axis, translate to surface
  const halfH = partDimensions.height / 2;
  const yPos  = halfH - depth / 2;

  return (
    <group
      position={[op.position.x, yPos, op.position.z]}
    >
      <mesh>
        <cylinderGeometry args={[radius, radius, depth, segments]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Sub-component: DadoOperation — renders a dado groove
// ---------------------------------------------------------------------------

interface DadoProps {
  op: OperationGeometry;
  partDimensions: { width: number; height: number; depth: number };
}

const DadoOperation: React.FC<DadoProps> = ({ op, partDimensions }) => {
  const width    = op.width ?? 18;
  const cutDepth = op.cutDepth ?? 10;
  const length   = op.length ?? partDimensions.depth;

  // Dado runs along Z axis by default; position from op
  const halfH = partDimensions.height / 2;
  const yPos  = halfH - cutDepth / 2;

  const rotation = op.rotation
    ? new THREE.Euler(op.rotation.x, op.rotation.y, op.rotation.z)
    : new THREE.Euler(0, 0, 0);

  return (
    <group position={[op.position.x, yPos, op.position.z]} rotation={rotation}>
      <mesh>
        <boxGeometry args={[width, cutDepth, length]} />
        <meshStandardMaterial color="#222222" roughness={0.95} metalness={0} />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Sub-component: RabbetOperation
// ---------------------------------------------------------------------------

interface RabbetProps {
  op: OperationGeometry;
  partDimensions: { width: number; height: number; depth: number };
}

const RabbetOperation: React.FC<RabbetProps> = ({ op, partDimensions }) => {
  const width    = op.width ?? 10;
  const cutDepth = op.cutDepth ?? 10;
  const length   = op.length ?? partDimensions.depth;

  const halfH = partDimensions.height / 2;
  const halfW = partDimensions.width / 2;
  // Rabbet is at the edge
  const xPos  = -halfW + width / 2;
  const yPos  = halfH - cutDepth / 2;

  return (
    <group position={[xPos + op.position.x, yPos, op.position.z]}>
      <mesh>
        <boxGeometry args={[width, cutDepth, length]} />
        <meshStandardMaterial color="#222222" roughness={0.95} metalness={0} />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Sub-component: PocketOperation
// ---------------------------------------------------------------------------

interface PocketProps {
  op: OperationGeometry;
  partDimensions: { width: number; height: number; depth: number };
}

const PocketOperation: React.FC<PocketProps> = ({ op, partDimensions }) => {
  const w        = op.width ?? 40;
  const len      = op.length ?? 40;
  const cutDepth = op.cutDepth ?? op.depth ?? 10;

  const halfH = partDimensions.height / 2;
  const yPos  = halfH - cutDepth / 2;

  return (
    <group position={[op.position.x, yPos, op.position.z]}>
      <mesh>
        <boxGeometry args={[w, cutDepth + 0.5, len]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Edge highlight (selection outline)
// ---------------------------------------------------------------------------

interface EdgeHighlightProps {
  dimensions: { width: number; height: number; depth: number };
  color?: string;
}

const EdgeHighlight: React.FC<EdgeHighlightProps> = ({
  dimensions: { width, height, depth },
  color = '#3399ff',
}) => {
  const geo = useMemo(() => new THREE.EdgesGeometry(
    new THREE.BoxGeometry(width + 1, height + 1, depth + 1),
  ), [width, height, depth]);

  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color: new THREE.Color(color), linewidth: 2 }),
    [color],
  );

  return <lineSegments geometry={geo} material={mat} renderOrder={10} />;
};

// ---------------------------------------------------------------------------
// PartMesh
// ---------------------------------------------------------------------------

export const PartMesh: React.FC<PartMeshProps> = ({
  part,
  selected = false,
  hovered = false,
  wireframe = false,
  position,
  showOperations = true,
  onClick,
  onHover,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const { width, height, depth } = part.dimensions;
  const pos = position ?? part.transform.position;
  const rot = part.transform.rotation;

  const handleClick = useCallback(
    (e: any) => {
      e.stopPropagation();
      onClick?.(part.id);
    },
    [onClick, part.id],
  );

  const handlePointerOver = useCallback(
    (e: any) => {
      e.stopPropagation();
      onHover?.(part.id);
    },
    [onHover, part.id],
  );

  const handlePointerOut = useCallback(
    (e: any) => {
      e.stopPropagation();
      onHover?.(null);
    },
    [onHover],
  );

  return (
    <group
      position={[pos.x, pos.y, pos.z]}
      rotation={[rot.x, rot.y, rot.z]}
      data-testid={`part-mesh-${part.id}`}
    >
      {/* Main body */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        castShadow
        receiveShadow
        name={part.id}
      >
        <boxGeometry args={[width, height, depth]} />
        <WoodMaterial
          species={part.species}
          material={part.material}
          color={part.color}
          wireframe={wireframe}
          selected={selected}
          hovered={hovered}
        />
      </mesh>

      {/* Selection edge highlight */}
      {selected && !wireframe && (
        <EdgeHighlight dimensions={part.dimensions} color="#3399ff" />
      )}

      {/* Hovered edge highlight */}
      {hovered && !selected && !wireframe && (
        <EdgeHighlight dimensions={part.dimensions} color="#88bbff" />
      )}

      {/* Machining operations */}
      {showOperations &&
        part.operations.map((op) => {
          switch (op.type) {
            case 'bore':
            case 'counterbore':
            case 'countersink':
              return (
                <BoreOperation key={op.id} op={op} partDimensions={part.dimensions} />
              );
            case 'dado':
            case 'slot':
              return (
                <DadoOperation key={op.id} op={op} partDimensions={part.dimensions} />
              );
            case 'rabbet':
              return (
                <RabbetOperation key={op.id} op={op} partDimensions={part.dimensions} />
              );
            case 'pocket':
              return (
                <PocketOperation key={op.id} op={op} partDimensions={part.dimensions} />
              );
            default:
              return null;
          }
        })}
    </group>
  );
};

export default PartMesh;
