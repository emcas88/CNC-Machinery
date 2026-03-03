/**
 * WoodMaterial Component
 * Procedural wood grain shader using Three.js ShaderMaterial.
 * Feature 18: ThreeDViewer/Component Unification
 */

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { WoodMaterialProps, WoodSpecies } from '../types';

// ---------------------------------------------------------------------------
// Wood species colour tables
// ---------------------------------------------------------------------------

interface WoodColours {
  base: string;
  grain: string;
  highlight: string;
}

const SPECIES_COLOURS: Record<WoodSpecies, WoodColours> = {
  oak:      { base: '#C68642', grain: '#A0652A', highlight: '#D4956A' },
  maple:    { base: '#E8C89B', grain: '#C4965C', highlight: '#F0D9B8' },
  walnut:   { base: '#5C3A1E', grain: '#3B2010', highlight: '#7A5230' },
  cherry:   { base: '#9B3A20', grain: '#722B14', highlight: '#C06040' },
  pine:     { base: '#D4A96A', grain: '#B8874A', highlight: '#E8C48C' },
  birch:    { base: '#E0D4B0', grain: '#C8B880', highlight: '#F0E8CC' },
  mahogany: { base: '#6B2D1A', grain: '#4A1F10', highlight: '#8B4030' },
};

const PLYWOOD_COLOURS: WoodColours = {
  base: '#C8A870',
  grain: '#A07840',
  highlight: '#D8BC90',
};

const MDF_COLOUR = '#C8B8A0';

// ---------------------------------------------------------------------------
// GLSL shaders
// ---------------------------------------------------------------------------

const WOOD_VERTEX_SHADER = /* glsl */ `
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const WOOD_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3  uBaseColor;
  uniform vec3  uGrainColor;
  uniform vec3  uHighlightColor;
  uniform float uGrainScale;
  uniform float uGrainStrength;
  uniform float uRingFrequency;
  uniform float uNoise;
  uniform bool  uWireframe;
  uniform bool  uSelected;
  uniform bool  uHovered;
  uniform float uOpacity;
  uniform vec3  uLightDir;

  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  // --- Simplex-ish noise ---
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187,
                        0.366025403784439,
                       -0.577350269189626,
                        0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                     + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                              dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    if (uWireframe) {
      gl_FragColor = vec4(0.8, 0.8, 0.8, uOpacity);
      return;
    }

    // --- Wood ring pattern ---
    float n1  = snoise(vPosition.xz * uGrainScale * 0.05);
    float n2  = snoise(vPosition.xz * uGrainScale * 0.12 + vec2(1.7, 3.1));
    float dist = length(vPosition.xz) + n1 * 8.0 + n2 * 4.0;
    float ring = sin(dist * uRingFrequency) * 0.5 + 0.5;

    // --- Grain streaks along y ---
    float grain = snoise(vec2(vPosition.x * uGrainScale * 0.3,
                              vPosition.y * uGrainScale * 0.02));
    grain = grain * 0.5 + 0.5;

    // --- Mix colours ---
    vec3 col = mix(uBaseColor, uGrainColor, ring * uGrainStrength);
    col = mix(col, uHighlightColor, grain * 0.25);

    // --- Diffuse lighting ---
    float diff = max(dot(normalize(vNormal), normalize(uLightDir)), 0.0);
    float ambient = 0.45;
    float light = ambient + (1.0 - ambient) * diff;
    col *= light;

    // --- Selection / hover tint ---
    if (uSelected) {
      col = mix(col, vec3(0.2, 0.6, 1.0), 0.35);
    } else if (uHovered) {
      col = mix(col, vec3(0.9, 0.9, 1.0), 0.2);
    }

    gl_FragColor = vec4(col, uOpacity);
  }
`;

// ---------------------------------------------------------------------------
// Helper: hex to THREE.Color
// ---------------------------------------------------------------------------

function hex(h: string): THREE.Color {
  return new THREE.Color(h);
}

// ---------------------------------------------------------------------------
// WoodMaterial component
// ---------------------------------------------------------------------------

export const WoodMaterial: React.FC<WoodMaterialProps> = ({
  species = 'oak',
  material = 'solid_wood',
  color,
  wireframe = false,
  selected = false,
  hovered = false,
  opacity = 1,
}) => {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(() => {
    let colours: WoodColours;

    if (material === 'mdf') {
      colours = { base: MDF_COLOUR, grain: MDF_COLOUR, highlight: '#D8CCBC' };
    } else if (material === 'plywood') {
      colours = PLYWOOD_COLOURS;
    } else {
      colours = SPECIES_COLOURS[species] ?? SPECIES_COLOURS.oak;
    }

    if (color) {
      colours = { base: color, grain: color, highlight: color };
    }

    return {
      uBaseColor:      { value: hex(colours.base) },
      uGrainColor:     { value: hex(colours.grain) },
      uHighlightColor: { value: hex(colours.highlight) },
      uGrainScale:     { value: 1.0 },
      uGrainStrength:  { value: material === 'mdf' ? 0.05 : 0.55 },
      uRingFrequency:  { value: material === 'mdf' ? 0.1  : 0.6  },
      uNoise:          { value: 0.4 },
      uWireframe:      { value: wireframe },
      uSelected:       { value: selected },
      uHovered:        { value: hovered },
      uOpacity:        { value: opacity },
      uLightDir:       { value: new THREE.Vector3(1, 2, 1.5) },
    };
  }, [species, material, color, wireframe, selected, hovered, opacity]);

  // Reactively update boolean uniforms without recreating material
  React.useEffect(() => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.uWireframe.value = wireframe;
      shaderRef.current.uniforms.uSelected.value  = selected;
      shaderRef.current.uniforms.uHovered.value   = hovered;
      shaderRef.current.uniforms.uOpacity.value   = opacity;
    }
  }, [wireframe, selected, hovered, opacity]);

  return (
    <shaderMaterial
      ref={shaderRef}
      vertexShader={WOOD_VERTEX_SHADER}
      fragmentShader={WOOD_FRAGMENT_SHADER}
      uniforms={uniforms}
      transparent={opacity < 1}
      side={THREE.DoubleSide}
    />
  );
};

export default WoodMaterial;
