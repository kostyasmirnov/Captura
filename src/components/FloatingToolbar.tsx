import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AnnotationTool } from '../types';

const COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#5856d6', '#000000', '#ffffff'];

const TOOLS: { id: AnnotationTool; icon: React.ReactElement; title: string }[] = [
  {
    id: 'arrow', title: 'Arrow (A)',
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="13" x2="12" y2="4" /><polyline points="6,4 12,4 12,10" /></svg>,
  },
  {
    id: 'rectangle', title: 'Rectangle (R)',
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><rect x="2" y="3" width="12" height="10" rx="1" /></svg>,
  },
  {
    id: 'ellipse', title: 'Ellipse (E)',
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><ellipse cx="8" cy="8" rx="6" ry="5" /></svg>,
  },
  {
    id: 'freehand', title: 'Pen (P)',
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2l3 3-8 8H3v-3l8-8z" /></svg>,
  },
  {
    id: 'marker', title: 'Marker (M)',
    icon: <svg width="15" height="15" viewBox="0 0 16 16"><rect x="2" y="5" width="12" height="6" rx="3" fill="currentColor" opacity="0.65" /></svg>,
  },
  {
    id: 'text', title: 'Text (T)',
    icon: <svg width="15" height="15" viewBox="0 0 16 16"><text x="2" y="13" fontSize="13" fontWeight="bold" fill="currentColor" fontFamily="-apple-system,sans-serif">T</text></svg>,
  },
  {
    id: 'blur', title: 'Blur (B)',
    icon: <svg width="15" height="15" viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.7" /><rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.3" /><rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.3" /><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.7" /></svg>,
  },
];

interface Props {
  onCopy: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onClose?: () => void;
}

export default function FloatingToolbar({ onCopy, onSave, onSaveAs, onClose }: Props) {
  const {
    currentTool, setTool,
    strokeColor, setStrokeColor,
    strokeWidth, setStrokeWidth,
    undo, redo,
    annotations, historyIndex, history,
  } = useAppStore();

  const [showColors, setShowColors] = useState(false);
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const btnBase: React.CSSProperties = {
    height: 30, minWidth: 30,
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 5,
    color: 'rgba(255,255,255,0.8)',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, padding: '0 3px',
  };
  const btnActive: React.CSSProperties = {
    ...btnBase,
    background: 'rgba(77,144,254,0.22)',
    border: '1px solid rgba(77,144,254,0.5)',
    color: '#5a9fff',
  };
  const btnDisabled: React.CSSProperties = {
    ...btnBase, opacity: 0.3, cursor: 'default',
  };
  const sepStyle: React.CSSProperties = {
    width: 1, height: 20,
    background: 'rgba(255,255,255,0.13)',
    margin: '0 3px', flexShrink: 0,
  };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center',
        background: 'rgba(20,20,22,0.96)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8, height: 40,
        padding: '0 6px', gap: 2,
        boxShadow: '0 8px 32px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.4)',
        userSelect: 'none',
        position: 'relative',
      }}
      onClick={() => showColors && setShowColors(false)}
    >
      {/* Tool buttons */}
      {TOOLS.map(t => (
        <button
          key={t.id}
          style={currentTool === t.id ? btnActive : btnBase}
          title={t.title}
          onClick={e => { e.stopPropagation(); setTool(t.id); }}
        >
          {t.icon}
        </button>
      ))}

      <div style={sepStyle} />

      {/* Color swatch */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={e => { e.stopPropagation(); setShowColors(!showColors); }}
          title="Stroke color"
          style={{
            width: 22, height: 22, borderRadius: '50%',
            background: strokeColor,
            border: '2px solid rgba(255,255,255,0.35)',
            cursor: 'pointer', flexShrink: 0,
          }}
        />
        {showColors && (
          <div
            style={{
              position: 'absolute', bottom: '100%', left: '50%',
              transform: 'translateX(-50%)', marginBottom: 10,
              background: 'rgba(20,20,22,0.97)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, padding: 8,
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
              boxShadow: '0 6px 24px rgba(0,0,0,0.55)',
              zIndex: 10,
            }}
            onClick={e => e.stopPropagation()}
          >
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => { setStrokeColor(c); setShowColors(false); }}
                style={{
                  width: 20, height: 20, borderRadius: '50%', background: c, padding: 0,
                  border: strokeColor === c ? '2px solid #fff' : '2px solid rgba(255,255,255,0.12)',
                  cursor: 'pointer',
                }}
              />
            ))}
            <label style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: 10, color: '#777' }}>Custom</span>
              <input
                type="color"
                value={strokeColor}
                onChange={e => setStrokeColor(e.target.value)}
                style={{ flex: 1, height: 20, border: 'none', borderRadius: 3, cursor: 'pointer' }}
              />
            </label>
          </div>
        )}
      </div>

      <div style={sepStyle} />

      {/* Stroke size */}
      {([2, 4, 8] as const).map((s, i) => (
        <button
          key={s}
          title={['Thin', 'Medium', 'Thick'][i]}
          onClick={e => { e.stopPropagation(); setStrokeWidth(s); }}
          style={{ ...(strokeWidth === s ? btnActive : btnBase), width: 28 }}
        >
          <div style={{ width: [10, 12, 14][i], height: s, background: 'currentColor', borderRadius: 1 }} />
        </button>
      ))}

      <div style={sepStyle} />

      {/* Undo / Redo */}
      <button
        title="Undo (⌘Z)"
        onClick={e => { e.stopPropagation(); undo(); }}
        style={canUndo ? btnBase : btnDisabled}
        disabled={!canUndo}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 7.5a5 5 0 1 1 1.5 3.5" />
          <polyline points="1,5 3.5,7.5 6,5" />
        </svg>
      </button>
      <button
        title="Redo (⌘⇧Z)"
        onClick={e => { e.stopPropagation(); redo(); }}
        style={canRedo ? btnBase : btnDisabled}
        disabled={!canRedo}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.5 7.5a5 5 0 1 0-1.5 3.5" />
          <polyline points="15,5 12.5,7.5 10,5" />
        </svg>
      </button>

      <div style={sepStyle} />

      {/* Copy */}
      <button
        onClick={e => { e.stopPropagation(); onCopy(); }}
        title="Copy to clipboard (⌘C)"
        style={{ ...btnBase, width: 'auto', padding: '0 9px', gap: 5, fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="9" height="9" rx="1" />
          <path d="M4 3V2a1 1 0 0 1 1-1h6l3 3v6a1 1 0 0 1-1 1h-1" />
        </svg>
        Copy
      </button>

      {/* Save */}
      <button
        onClick={e => { e.stopPropagation(); onSave(); }}
        title="Quick save"
        style={{ ...btnBase, width: 'auto', padding: '0 9px', gap: 5, fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1h8l4 4v8H1V1z" />
          <rect x="4" y="1" width="5" height="3.5" />
          <rect x="3" y="8" width="8" height="5" />
        </svg>
        Save
      </button>

      {/* Save As */}
      <button
        onClick={e => { e.stopPropagation(); onSaveAs(); }}
        title="Save As…"
        style={{ ...btnBase, width: 'auto', padding: '0 9px', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}
      >
        Save As…
      </button>

      {onClose && (
        <>
          <div style={sepStyle} />
          <button
            onClick={e => { e.stopPropagation(); onClose(); }}
            title="Close"
            style={{ ...btnBase, color: 'rgba(220,80,80,0.85)' }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
