/**
 * DimensionAnnotation Component
 * Renders 3D measurement lines with labels using @react-three/fiber.
 * Feature 18: ThreeDViewer/Component Unification
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { extend } from '@react-three/fiber';
import type { DimensionAnnotationProps, DimensionAnnotationData } from '../types';

// ---------------------------------------------------------------------------
// Helper: build a line geometry for a dimension
// ---------------------------------------------------------------------------

function buildDimensionLinePoints(
  annotation: DimensionAnnotationData,
): { mainPoints: THREE.Vector3[]; tickStart: THREE.Vector3[]; tickEnd: THREE.Vector3[] } {
  const { start, end, axis, offset = 40 } = annotation;

  // Offset direction — perpendicular to the axis being dimensioned
  const offsetVec = new THREE.Vector3(
    axis === 'x' ? 0 : offset,
    axis === 'y' ? 0 : offset,
    axis === 'z' ? 0 : offset,
  );
  if (axis === 'y') offsetVec.set(offset, 0, 0);
  if (axis === 'z') offsetVec.set(0, offset, 0);

  const s = new THREE.Vector3(start.x, start.y, start.z);
  const e = new THREE.Vector3(end.x, end.y, end.z);
  const sOff = s.clone().add(offsetVec);
  const eOff = e.clone().add(offsetVec);

  // Tick length
  const tickLen = 12;
  const tickDir = offsetVec.clone().normalize().multiplyScalar(tickLen);

  return {
    mainPoints: [sOff, eOff],
    tickStart: [s, sOff.clone().add(tickDir)],
    tickEnd:   [e, eOff.clone().add(tickDir)],
  };
}

// ---------------------------------------------------------------------------
// Text sprite for annotation label
// ---------------------------------------------------------------------------

function makeTextSprite(text: string, color = '#ffffff', fontSize = 48): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background pill
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.roundRect?.(4, 8, canvas.width - 8, canvas.height - 16, 8);
  ctx.fill();

  // Text
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(80, 20, 1);
  return sprite;
}

// ---------------------------------------------------------------------------
// DimensionLine — a single dimension with ticks and label
// ---------------------------------------------------------------------------

interface DimensionLineProps {
  annotation: DimensionAnnotationData;
  color?: string;
  lineWidth?: number;
  fontSize?: number;
}

const DimensionLine: React.FC<DimensionLineProps> = ({
  annotation,
  color = '#ffee44',
  lineWidth = 1,
  fontSize = 48,
}) => {
  const { mainPoints, tickStart, tickEnd } = useMemo(
    () => buildDimensionLinePoints(annotation),
    [annotation],
  );

  const mainGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(mainPoints);
    return geo;
  }, [mainPoints]);

  const tickStartGeo = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(tickStart),
    [tickStart],
  );

  const tickEndGeo = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(tickEnd),
    [tickEnd],
  );

  const lineMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        linewidth: lineWidth,
        depthTest: false,
      }),
    [color, lineWidth],
  );

  // Midpoint for label
  const midpoint = useMemo(
    () =>
      new THREE.Vector3(
        (mainPoints[0].x + mainPoints[1].x) / 2,
        (mainPoints[0].y + mainPoints[1].y) / 2 + 15,
        (mainPoints[0].z + mainPoints[1].z) / 2,
      ),
    [mainPoints],
  );

  const sprite = useMemo(
    () => makeTextSprite(annotation.label, color, fontSize),
    [annotation.label, color, fontSize],
  );

  return (
    <group renderOrder={999}>
      <line geometry={mainGeo} material={lineMat} />
      <line geometry={tickStartGeo} material={lineMat} />
      <line geometry={tickEndGeo} material={lineMat} />
      <primitive
        object={sprite}
        position={[midpoint.x, midpoint.y, midpoint.z]}
      />
    </group>
  );
};

// ---------------------------------------------------------------------------
// DimensionAnnotation component
// ---------------------------------------------------------------------------

export const DimensionAnnotation: React.FC<DimensionAnnotationProps> = ({
  annotation,
  color = '#ffee44',
  lineWidth = 1,
  fontSize = 48,
  visible = true,
}) => {
  if (!visible) return null;

  return (
    <DimensionLine
      annotation={annotation}
      color={color}
      lineWidth={lineWidth}
      fontSize={fontSize}
    />
  );
};

// ---------------------------------------------------------------------------
// Helper: auto-generate dimension annotations for a bounding box
// ---------------------------------------------------------------------------

export function generateBBoxAnnotations(
  min: THREE.Vector3,
  max: THREE.Vector3,
  units: 'mm' | 'inch' = 'mm',
): DimensionAnnotationData[] {
  const fmt = (n: number) =>
    units === 'mm' ? `${Math.round(n)}mm` : `${(n / 25.4).toFixed(2)}"`;

  return [
    {
      id: 'dim-width',
      axis: 'x',
      start: { x: min.x, y: min.y, z: min.z },
      end:   { x: max.x, y: min.y, z: min.z },
      label: fmt(max.x - min.x),
      offset: -40,
    },
    {
      id: 'dim-height',
      axis: 'y',
      start: { x: min.x, y: min.y, z: min.z },
      end:   { x: min.x, y: max.y, z: min.z },
      label: fmt(max.y - min.y),
      offset: -40,
    },
    {
      id: 'dim-depth',
      axis: 'z',
      start: { x: min.x, y: min.y, z: min.z },
      end:   { x: min.x, y: min.y, z: max.z },
      label: fmt(max.z - min.z),
      offset: -40,
    },
  ];
}

export default DimensionAnnotation;
