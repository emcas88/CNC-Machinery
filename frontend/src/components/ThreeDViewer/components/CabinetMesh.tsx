/**
 * CabinetMesh Component
 * Renders a full cabinet from a list of PartGeometry objects.
 * Delegates each part to PartMesh.
 * Feature 18: ThreeDViewer/Component Unification
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { CabinetMeshProps, PartGeometry, Vector3D, ExplodedState } from '../types';
import { PartMesh } from './PartMesh';

// ---------------------------------------------------------------------------
// Helper: get effective world position for a part (potentially exploded)
// ---------------------------------------------------------------------------

function getEffectivePosition(
  part: PartGeometry,
  explodedState?: ExplodedState,
): Vector3D {
  if (
    explodedState &&
    explodedState.progress > 0 &&
    explodedState.partPositions[part.id]
  ) {
    return explodedState.partPositions[part.id];
  }
  return part.transform.position;
}

// ---------------------------------------------------------------------------
// CabinetMesh
// ---------------------------------------------------------------------------

export const CabinetMesh: React.FC<CabinetMeshProps> = ({
  parts,
  selectedPartIds = [],
  hoveredPartId = null,
  wireframe = false,
  explodedState,
  onPartClick,
  onPartHover,
  showOperations = true,
}) => {
  const selectedSet = useMemo(() => new Set(selectedPartIds), [selectedPartIds]);

  if (!parts || parts.length === 0) {
    return null;
  }

  return (
    <group name="cabinet" data-testid="cabinet-mesh">
      {parts.map((part) => {
        const effectivePosition = getEffectivePosition(part, explodedState);

        return (
          <PartMesh
            key={part.id}
            part={part}
            selected={selectedSet.has(part.id)}
            hovered={hoveredPartId === part.id}
            wireframe={wireframe}
            position={effectivePosition}
            showOperations={showOperations}
            onClick={onPartClick}
            onHover={onPartHover}
          />
        );
      })}
    </group>
  );
};

export default CabinetMesh;
