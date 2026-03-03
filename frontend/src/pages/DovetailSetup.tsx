import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { machinesService } from '@/services/machines';
import type { Machine } from '@/types';

// ── Dovetail Config Types ──
export interface DovetailConfig {
  bitAngle: 7 | 9 | 11 | 14;
  bitDiameter: number;
  socketDepth: number;
  pinSize: number;
  tailSize: number;
  halfPinSize: number;
  halfPinEnabled: boolean;
  drawerWidth: number;
  drawerHeight: number;
  drawerDepth: number;
  materialThickness: number;
  xOffset: number;
  yOffset: number;
  zClearance: number;
  feedRate: number;
  plungeRate: number;
}

const DEFAULT_CONFIG: DovetailConfig = {
  bitAngle: 14,
  bitDiameter: 12.7,
  socketDepth: 12,
  pinSize: 10,
  tailSize: 25,
  halfPinSize: 6,
  halfPinEnabled: true,
  drawerWidth: 400,
  drawerHeight: 120,
  drawerDepth: 450,
  materialThickness: 12.7,
  xOffset: 0,
  yOffset: 0,
  zClearance: 5,
  feedRate: 3000,
  plungeRate: 1500,
};

const BIT_ANGLES: DovetailConfig['bitAngle'][] = [7, 9, 11, 14];

function parseDovetailConfig(notes?: string): DovetailConfig | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === 'object' && parsed.__dovetailConfig) {
      return parsed.__dovetailConfig as DovetailConfig;
    }
  } catch {
    // Notes is not JSON or doesn't contain dovetail config
  }
  return null;
}

function serializeDovetailConfig(config: DovetailConfig, existingNotes?: string): string {
  let base: Record<string, unknown> = {};
  if (existingNotes) {
    try {
      base = JSON.parse(existingNotes);
    } catch {
      base = { _originalNotes: existingNotes };
    }
  }
  return JSON.stringify({ ...base, __dovetailConfig: config });
}

// ── SVG Dovetail Preview ──
function DovetailPreview({ config }: { config: DovetailConfig }) {
  const { tailSize, pinSize, halfPinSize, halfPinEnabled, bitAngle, drawerWidth } = config;

  const svgWidth = 320;
  const svgHeight = 120;
  const margin = 20;
  const usableWidth = svgWidth - margin * 2;

  // Calculate joint proportions
  const angleRad = (bitAngle * Math.PI) / 180;
  const slopeX = Math.tan(angleRad) * 20; // visual slope

  const totalJointWidth = halfPinEnabled
    ? halfPinSize * 2 + tailSize + pinSize
    : tailSize + pinSize;
  const numJoints = Math.max(1, Math.floor(drawerWidth / (totalJointWidth || 1)));
  const jointWidth = usableWidth / Math.min(numJoints, 6);
  const pinW = (pinSize / totalJointWidth) * jointWidth;
  const tailW = (tailSize / totalJointWidth) * jointWidth;
  const halfPinW = halfPinEnabled ? (halfPinSize / totalJointWidth) * jointWidth : 0;

  const joints = Math.min(numJoints, 6);
  const yTop = 20;
  const yMid = 60;
  const yBot = 100;

  const pathParts: string[] = [];
  let x = margin;

  for (let i = 0; i < joints; i++) {
    if (halfPinEnabled && i === 0) {
      // Half pin
      pathParts.push(`M ${x} ${yTop} L ${x} ${yMid} L ${x + halfPinW} ${yMid} L ${x + halfPinW + slopeX} ${yTop}`);
      x += halfPinW;
    }
    // Tail (trapezoid)
    pathParts.push(
      `M ${x - slopeX} ${yTop} L ${x} ${yMid} L ${x + tailW} ${yMid} L ${x + tailW + slopeX} ${yTop}`,
    );
    // Fill for tail
    x += tailW;
    // Pin
    if (i < joints - 1 || !halfPinEnabled) {
      pathParts.push(`M ${x} ${yMid} L ${x} ${yTop} L ${x + pinW} ${yTop} L ${x + pinW} ${yMid}`);
      x += pinW;
    }
    if (halfPinEnabled && i === joints - 1) {
      pathParts.push(`M ${x - slopeX} ${yTop} L ${x} ${yMid} L ${x + halfPinW} ${yMid} L ${x + halfPinW} ${yTop}`);
      x += halfPinW;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full max-w-sm"
      aria-label="Dovetail joint preview"
      role="img"
    >
      {/* Background */}
      <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="transparent" />

      {/* Board outlines */}
      <rect x={margin} y={yTop} width={usableWidth} height={yMid - yTop} fill="#1e293b" stroke="#475569" strokeWidth={1} />
      <rect x={margin} y={yMid} width={usableWidth} height={yBot - yMid} fill="#0f172a" stroke="#475569" strokeWidth={1} />

      {/* Dovetail profile lines */}
      {pathParts.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#22d3ee" strokeWidth={1.5} />
      ))}

      {/* Labels */}
      <text x={svgWidth / 2} y={14} textAnchor="middle" fill="#94a3b8" fontSize={10}>
        {bitAngle}° — {joints} joints
      </text>
    </svg>
  );
}

export default function DovetailSetup() {
  const queryClient = useQueryClient();

  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [config, setConfig] = useState<DovetailConfig>({ ...DEFAULT_CONFIG });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // ── Queries ──
  const {
    data: machines = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['machines'],
    queryFn: machinesService.getMachines,
  });

  // ── Load config from machine notes ──
  useEffect(() => {
    if (selectedMachineId) {
      const machine = machines.find((m) => m.id === selectedMachineId);
      if (machine) {
        const saved = parseDovetailConfig(machine.notes);
        if (saved) {
          setConfig(saved);
        } else {
          setConfig({ ...DEFAULT_CONFIG });
        }
        setHasUnsavedChanges(false);
      }
    }
  }, [selectedMachineId, machines]);

  // Auto-select first machine
  useEffect(() => {
    if (machines.length > 0 && !selectedMachineId) {
      setSelectedMachineId(machines[0].id);
    }
  }, [machines, selectedMachineId]);

  // ── Mutation ──
  const saveMutation = useMutation({
    mutationFn: ({ id, config: cfg }: { id: string; config: DovetailConfig }) => {
      const machine = machines.find((m) => m.id === id);
      const notes = serializeDovetailConfig(cfg, machine?.notes);
      return machinesService.updateMachine(id, { notes } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      setHasUnsavedChanges(false);
    },
  });

  // ── Handlers ──
  const handleConfigChange = (field: keyof DovetailConfig, value: number | boolean) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleNumericChange = (field: keyof DovetailConfig, raw: string) => {
    const val = parseFloat(raw);
    if (!isNaN(val)) {
      handleConfigChange(field, val);
    }
  };

  const handleSave = () => {
    if (selectedMachineId) {
      saveMutation.mutate({ id: selectedMachineId, config });
    }
  };

  const handleReset = () => {
    setConfig({ ...DEFAULT_CONFIG });
    setHasUnsavedChanges(true);
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading machines…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-6 max-w-md text-center">
          <p className="text-red-400 font-medium mb-2">Failed to load machines</p>
          <p className="text-red-300 text-sm">{(error as Error)?.message || 'Unknown error'}</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['machines'] })}
            className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (machines.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center text-gray-500">
          <p className="text-lg mb-2">No machines configured</p>
          <p className="text-sm">Add a machine in Machine Settings to configure dovetail parameters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Dovetail Setup</h1>
            <p className="text-gray-400 text-sm mt-1">
              Configure dovetail joint parameters for CNC machining
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
            >
              Reset to Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending || !hasUnsavedChanges}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save Dovetail Config'}
            </button>
          </div>
        </div>

        {/* Machine Selector */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-1">Machine</label>
          <select
            value={selectedMachineId || ''}
            onChange={(e) => setSelectedMachineId(e.target.value)}
            className="w-full max-w-sm px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
          >
            {machines.map((m: Machine) => (
              <option key={m.id} value={m.id}>
                {m.name || m.id}
              </option>
            ))}
          </select>
        </div>

        {/* Save error */}
        {saveMutation.isError && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
            Failed to save: {(saveMutation.error as Error)?.message || 'Unknown error'}
          </div>
        )}

        {/* Unsaved indicator */}
        {hasUnsavedChanges && (
          <div className="mb-4 p-2 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-400 text-sm">
            You have unsaved changes
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Bit Settings */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Bit Settings</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Bit Angle</label>
                  <div className="flex gap-2">
                    {BIT_ANGLES.map((angle) => (
                      <button
                        key={angle}
                        onClick={() => handleConfigChange('bitAngle', angle)}
                        className={`flex-1 py-2 text-sm rounded transition-colors ${
                          config.bitAngle === angle
                            ? 'bg-cyan-600 text-white'
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                        }`}
                      >
                        {angle}°
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Bit Diameter (mm)</label>
                  <input
                    type="number"
                    value={config.bitDiameter}
                    onChange={(e) => handleNumericChange('bitDiameter', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    min={0}
                    step={0.1}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Socket Depth (mm)</label>
                  <input
                    type="number"
                    value={config.socketDepth}
                    onChange={(e) => handleNumericChange('socketDepth', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    min={0}
                    step={0.5}
                  />
                </div>
              </div>
            </div>

            {/* Joint Dimensions */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Joint Dimensions</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Pin Size (mm)</label>
                  <input
                    type="number"
                    value={config.pinSize}
                    onChange={(e) => handleNumericChange('pinSize', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    min={0}
                    step={0.5}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tail Size (mm)</label>
                  <input
                    type="number"
                    value={config.tailSize}
                    onChange={(e) => handleNumericChange('tailSize', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    min={0}
                    step={0.5}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.halfPinEnabled}
                      onChange={(e) => handleConfigChange('halfPinEnabled', e.target.checked)}
                      className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-500"
                    />
                    Half Pins
                  </label>
                </div>
                {config.halfPinEnabled && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400">Size (mm)</label>
                    <input
                      type="number"
                      value={config.halfPinSize}
                      onChange={(e) => handleNumericChange('halfPinSize', e.target.value)}
                      className="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                      min={0}
                      step={0.5}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Box Dimensions */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Drawer Box Dimensions</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Width (mm)</label>
                  <input
                    type="number"
                    value={config.drawerWidth}
                    onChange={(e) => handleNumericChange('drawerWidth', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    min={0}
                    step={1}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Height (mm)</label>
                  <input
                    type="number"
                    value={config.drawerHeight}
                    onChange={(e) => handleNumericChange('drawerHeight', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    min={0}
                    step={1}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Depth (mm)</label>
                  <input
                    type="number"
                    value={config.drawerDepth}
                    onChange={(e) => handleNumericChange('drawerDepth', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    min={0}
                    step={1}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Material Thickness (mm)</label>
                  <input
                    type="number"
                    value={config.materialThickness}
                    onChange={(e) => handleNumericChange('materialThickness', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    min={0}
                    step={0.1}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* SVG Preview */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Joint Preview</h3>
              <div className="flex justify-center">
                <DovetailPreview config={config} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div>
                  <div className="text-xs text-gray-500">Pins</div>
                  <div className="text-sm text-cyan-400">{config.pinSize}mm</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Tails</div>
                  <div className="text-sm text-cyan-400">{config.tailSize}mm</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Angle</div>
                  <div className="text-sm text-cyan-400">{config.bitAngle}°</div>
                </div>
              </div>
            </div>

            {/* Machine Offsets */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Machine Offsets</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">X Offset (mm)</label>
                  <input
                    type="number"
                    value={config.xOffset}
                    onChange={(e) => handleNumericChange('xOffset', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    step={0.1}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Y Offset (mm)</label>
                  <input
                    type="number"
                    value={config.yOffset}
                    onChange={(e) => handleNumericChange('yOffset', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    step={0.1}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Z Clearance (mm)</label>
                  <input
                    type="number"
                    value={config.zClearance}
                    onChange={(e) => handleNumericChange('zClearance', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    min={0}
                    step={0.5}
                  />
                </div>
              </div>
            </div>

            {/* Feed Rates */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Feed Rates</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Feed Rate (mm/min)</label>
                  <input
                    type="number"
                    value={config.feedRate}
                    onChange={(e) => handleNumericChange('feedRate', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    min={0}
                    step={100}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Plunge Rate (mm/min)</label>
                  <input
                    type="number"
                    value={config.plungeRate}
                    onChange={(e) => handleNumericChange('plungeRate', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                    min={0}
                    step={100}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
