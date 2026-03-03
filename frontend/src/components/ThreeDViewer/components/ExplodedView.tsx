/**
 * ExplodedView Component
 * Animation controller wrapper that drives part positions during
 * explode/collapse transitions.
 * Feature 18: ThreeDViewer/Component Unification
 */

import React, { useEffect, useRef, useCallback } from 'react';
import type { ExplodedViewProps } from '../types';

/**
 * ExplodedView is a logic-only controller component.
 * It watches explodedState.phase and fires callbacks on animation completion.
 * The visual positioning is handled by CabinetMesh via partPositions.
 */
export const ExplodedView: React.FC<ExplodedViewProps> = ({
  parts,
  explodedState,
  onExplodeComplete,
  onCollapseComplete,
}) => {
  const prevPhase = useRef(explodedState.phase);

  useEffect(() => {
    const prev = prevPhase.current;
    const curr = explodedState.phase;

    if (prev === 'exploding' && curr === 'exploded') {
      onExplodeComplete?.();
    }
    if (prev === 'collapsing' && curr === 'collapsed') {
      onCollapseComplete?.();
    }

    prevPhase.current = curr;
  }, [explodedState.phase, onExplodeComplete, onCollapseComplete]);

  // This component renders nothing — it only manages side-effects
  return null;
};

export default ExplodedView;
