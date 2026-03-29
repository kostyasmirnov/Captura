import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { AnnotationTool } from '../types';

interface ToolDef {
  id: AnnotationTool;
  label: string;
  icon: string;
  title: string;
}

const TOOLS: ToolDef[] = [
  { id: 'select', label: '↖', icon: '↖', title: 'Select' },
  { id: 'arrow', label: '↗', icon: '↗', title: 'Arrow' },
  { id: 'rectangle', label: '▭', icon: '▭', title: 'Rectangle' },
  { id: 'ellipse', label: '○', icon: '○', title: 'Ellipse' },
  { id: 'line', label: '╱', icon: '╱', title: 'Line' },
  { id: 'freehand', label: '✏', icon: '✏', title: 'Freehand' },
  { id: 'marker', label: '🖌', icon: '🖌', title: 'Marker' },
  { id: 'text', label: 'T', icon: 'T', title: 'Text' },
  { id: 'pin', label: '📍', icon: '📍', title: 'Pin' },
  { id: 'blur', label: '⬜', icon: '⬜', title: 'Blur' },
  { id: 'eraser', label: '⌫', icon: '⌫', title: 'Eraser' },
];

export default function Toolbar() {
  const { currentTool, setTool, undo, redo, clearAnnotations, annotations, historyIndex, history } = useAppStore();

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div
      style={{
        padding: '8px 4px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        borderBottom: '1px solid #333',
      }}
    >
      {TOOLS.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setTool(tool.id)}
          title={tool.title}
          style={{
            width: '100%',
            padding: '7px 8px',
            background: currentTool === tool.id ? '#4d90fe' : 'transparent',
            border: 'none',
            borderRadius: 5,
            color: currentTool === tool.id ? '#fff' : '#ccc',
            cursor: 'pointer',
            fontSize: 16,
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'background 0.1s',
          }}
        >
          <span style={{ width: 22, textAlign: 'center', fontSize: 16 }}>{tool.icon}</span>
          <span style={{ fontSize: 12 }}>{tool.title}</span>
        </button>
      ))}

      <div style={{ marginTop: 4, borderTop: '1px solid #333', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (⌘Z)"
          style={{
            width: '100%',
            padding: '6px 8px',
            background: 'transparent',
            border: 'none',
            borderRadius: 5,
            color: canUndo ? '#ccc' : '#555',
            cursor: canUndo ? 'pointer' : 'default',
            fontSize: 12,
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ width: 22, textAlign: 'center', fontSize: 14 }}>↩</span>
          <span>Undo</span>
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (⌘⇧Z)"
          style={{
            width: '100%',
            padding: '6px 8px',
            background: 'transparent',
            border: 'none',
            borderRadius: 5,
            color: canRedo ? '#ccc' : '#555',
            cursor: canRedo ? 'pointer' : 'default',
            fontSize: 12,
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ width: 22, textAlign: 'center', fontSize: 14 }}>↪</span>
          <span>Redo</span>
        </button>
        <button
          onClick={clearAnnotations}
          disabled={annotations.length === 0}
          title="Clear All"
          style={{
            width: '100%',
            padding: '6px 8px',
            background: 'transparent',
            border: 'none',
            borderRadius: 5,
            color: annotations.length > 0 ? '#e74c3c' : '#555',
            cursor: annotations.length > 0 ? 'pointer' : 'default',
            fontSize: 12,
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ width: 22, textAlign: 'center', fontSize: 14 }}>🗑</span>
          <span>Clear</span>
        </button>
      </div>
    </div>
  );
}
