// ─────────────────────────────────────────────
//  ToolBar – editor tool selector
// ─────────────────────────────────────────────

import React from 'react';
import { EditorTool } from '../types';

interface ToolBarProps {
  activeTool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
}

interface ToolDef {
  id: EditorTool;
  label: string;
  shortcut: string;
  icon: string;
}

const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select', shortcut: 'S', icon: '↖' },
  { id: 'drawWall', label: 'Draw Wall', shortcut: 'W', icon: '▭' },
  { id: 'placeCabinet', label: 'Place Cabinet', shortcut: 'C', icon: '⬜' },
  { id: 'addOpening', label: 'Add Opening', shortcut: 'O', icon: '⊡' },
  { id: 'measure', label: 'Measure', shortcut: 'M', icon: '↔' },
  { id: 'pan', label: 'Pan', shortcut: 'H', icon: '✋' },
];

const ToolBar: React.FC<ToolBarProps> = ({ activeTool, onToolChange }) => {
  return (
    <div
      data-testid="toolbar"
      role="toolbar"
      aria-label="Editor tools"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        background: '#fff',
        border: '1px solid #d1d5db',
        borderRadius: 8,
        padding: 4,
      }}
    >
      {TOOLS.map(tool => (
        <button
          key={tool.id}
          data-testid={`tool-${tool.id}`}
          onClick={() => onToolChange(tool.id)}
          title={`${tool.label} (${tool.shortcut})`}
          aria-pressed={activeTool === tool.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            padding: '6px 8px',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            background: activeTool === tool.id ? '#eff6ff' : 'none',
            color: activeTool === tool.id ? '#2563eb' : '#4b5563',
            outline: activeTool === tool.id ? '2px solid #93c5fd' : 'none',
            transition: 'background 120ms, color 120ms',
          }}
          aria-label={tool.label}
        >
          <span aria-hidden="true">{tool.icon}</span>
          <span style={{ fontSize: 9, fontFamily: 'system-ui', letterSpacing: 0 }}>
            {tool.shortcut}
          </span>
        </button>
      ))}
    </div>
  );
};

export default ToolBar;
