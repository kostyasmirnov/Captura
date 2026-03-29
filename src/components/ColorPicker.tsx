import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

const PRESET_COLORS = [
  '#ff3b30', '#ff9500', '#ffcc00', '#34c759',
  '#007aff', '#5856d6', '#af52de', '#ff2d55',
  '#000000', '#1c1c1e', '#636366', '#aeaeb2',
  '#ffffff', '#e5e5ea', '#f2f2f7', '#ff6b6b',
];

export default function ColorPicker() {
  const {
    strokeColor, fillColor, strokeWidth, opacity,
    setStrokeColor, setFillColor, setStrokeWidth, setOpacity,
    recentColors,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'stroke' | 'fill'>('stroke');

  const currentColor = activeTab === 'stroke' ? strokeColor : fillColor;
  const setCurrentColor = activeTab === 'stroke' ? setStrokeColor : setFillColor;

  return (
    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 4 }}>
        {(['stroke', 'fill'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '4px 0',
              background: activeTab === tab ? '#4d90fe' : '#2a2a2a',
              border: 'none',
              borderRadius: 4,
              color: activeTab === tab ? '#fff' : '#999',
              cursor: 'pointer',
              fontSize: 11,
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Current color + custom input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 4,
            background: currentColor === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, white 25%, white 75%, #ccc 75%)' : currentColor,
            backgroundSize: '10px 10px',
            backgroundPosition: '0 0, 5px 5px',
            border: '2px solid #555',
            flexShrink: 0,
          }}
        />
        <input
          type="color"
          value={currentColor === 'transparent' ? '#ffffff' : currentColor}
          onChange={(e) => setCurrentColor(e.target.value)}
          style={{ flex: 1, height: 28, cursor: 'pointer', border: 'none', borderRadius: 4, background: 'none' }}
        />
        <button
          onClick={() => setCurrentColor('transparent')}
          style={{
            padding: '3px 6px',
            background: '#333',
            border: '1px solid #555',
            borderRadius: 4,
            color: '#aaa',
            cursor: 'pointer',
            fontSize: 10,
            flexShrink: 0,
          }}
          title="Transparent"
        >
          None
        </button>
      </div>

      {/* Preset colors */}
      <div>
        <div style={{ fontSize: 10, color: '#666', marginBottom: 5 }}>PRESETS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3 }}>
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setCurrentColor(color)}
              title={color}
              style={{
                width: '100%',
                aspectRatio: '1',
                borderRadius: 3,
                background: color,
                border: currentColor === color ? '2px solid #fff' : '1px solid #333',
                cursor: 'pointer',
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      {/* Recent colors */}
      {recentColors.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 5 }}>RECENT</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3 }}>
            {recentColors.map((color, i) => (
              <button
                key={`${color}-${i}`}
                onClick={() => setCurrentColor(color)}
                title={color}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: 3,
                  background: color,
                  border: currentColor === color ? '2px solid #fff' : '1px solid #333',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Stroke width */}
      <div>
        <div style={{ fontSize: 10, color: '#666', marginBottom: 5 }}>
          STROKE: {strokeWidth}px
        </div>
        <input
          type="range"
          min={1}
          max={20}
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {/* Opacity */}
      <div>
        <div style={{ fontSize: 10, color: '#666', marginBottom: 5 }}>
          OPACITY: {Math.round(opacity * 100)}%
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(opacity * 100)}
          onChange={(e) => setOpacity(parseInt(e.target.value) / 100)}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
