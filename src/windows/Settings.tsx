import React, { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppSettings } from '../types';

const DEFAULT_SETTINGS: AppSettings = {
  save_folder: '',
  format: 'png',
  jpg_quality: 90,
  file_template: 'screenshot_{datetime}',
  hotkey_area: 'CmdOrCtrl+Shift+1',
  hotkey_fullscreen: 'CmdOrCtrl+Shift+2',
  hotkey_repeat: 'CmdOrCtrl+Shift+3',
  after_capture: 'editor',
  autostart: false,
  show_in_dock: false,
  capture_delay: 0,
  history_limit: 50,
};

interface HotkeyRecorderProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

function HotkeyRecorder({ value, onChange, label }: HotkeyRecorderProps) {
  const [recording, setRecording] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startRecording = () => {
    setRecording(true);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    if (e.metaKey) parts.push('CmdOrCtrl');
    else if (e.ctrlKey) parts.push('CmdOrCtrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    const key = e.key;
    if (!['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
      if (key === 'Escape') {
        setRecording(false);
        return;
      }
      parts.push(key.length === 1 ? key.toUpperCase() : key);
      onChange(parts.join('+'));
      setRecording(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, color: '#999' }}>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          ref={inputRef}
          value={recording ? 'Press keys...' : value}
          readOnly
          onKeyDown={onKeyDown}
          onBlur={() => setRecording(false)}
          style={{
            background: recording ? '#1a3a6a' : '#2a2a2a',
            border: `1px solid ${recording ? '#4d90fe' : '#444'}`,
            borderRadius: 5,
            color: recording ? '#4d90fe' : '#fff',
            padding: '5px 10px',
            fontSize: 13,
            cursor: 'pointer',
            outline: 'none',
            width: 180,
          }}
        />
        <button
          onClick={startRecording}
          style={{
            padding: '5px 12px',
            background: recording ? '#444' : '#333',
            border: '1px solid #555',
            borderRadius: 5,
            color: '#ccc',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {recording ? 'Cancel' : 'Record'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#aaa',
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 12,
          paddingBottom: 6,
          borderBottom: '1px solid #333',
        }}
      >
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <label style={{ fontSize: 13, color: '#ccc', flexShrink: 0, marginRight: 16 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#2a2a2a',
  border: '1px solid #444',
  borderRadius: 5,
  color: '#fff',
  padding: '5px 10px',
  fontSize: 13,
  outline: 'none',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    invoke<AppSettings>('get_settings')
      .then(setSettings)
      .catch(console.error);
  }, []);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    await invoke('update_settings', { settings }).catch(console.error);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#1a1a1a',
        color: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          background: '#111',
          borderBottom: '1px solid #333',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Settings</h1>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <Section title="Saving">
          <Field label="Save folder">
            <input
              type="text"
              value={settings.save_folder}
              onChange={(e) => update('save_folder', e.target.value)}
              style={{ ...inputStyle, width: 260 }}
              placeholder="~/Pictures/Lightshot"
            />
          </Field>
          <Field label="Format">
            <select
              value={settings.format}
              onChange={(e) => update('format', e.target.value)}
              style={selectStyle}
            >
              <option value="png">PNG</option>
              <option value="jpg">JPEG</option>
              <option value="webp">WebP</option>
            </select>
          </Field>
          {settings.format === 'jpg' && (
            <Field label={`JPEG quality: ${settings.jpg_quality}`}>
              <input
                type="range"
                min={10}
                max={100}
                value={settings.jpg_quality}
                onChange={(e) => update('jpg_quality', parseInt(e.target.value))}
                style={{ width: 180 }}
              />
            </Field>
          )}
          <Field label="Filename template">
            <input
              type="text"
              value={settings.file_template}
              onChange={(e) => update('file_template', e.target.value)}
              style={{ ...inputStyle, width: 260 }}
            />
          </Field>
        </Section>

        <Section title="After Capture">
          <Field label="Action">
            <select
              value={settings.after_capture}
              onChange={(e) => update('after_capture', e.target.value)}
              style={selectStyle}
            >
              <option value="editor">Open in editor</option>
              <option value="save">Auto-save</option>
              <option value="copy">Copy to clipboard</option>
            </select>
          </Field>
          <Field label={`Capture delay: ${settings.capture_delay}s`}>
            <input
              type="range"
              min={0}
              max={5}
              value={settings.capture_delay}
              onChange={(e) => update('capture_delay', parseInt(e.target.value))}
              style={{ width: 180 }}
            />
          </Field>
        </Section>

        <Section title="Shortcuts">
          <HotkeyRecorder
            label="Capture Area"
            value={settings.hotkey_area}
            onChange={(v) => update('hotkey_area', v)}
          />
          <HotkeyRecorder
            label="Capture Fullscreen"
            value={settings.hotkey_fullscreen}
            onChange={(v) => update('hotkey_fullscreen', v)}
          />
          <HotkeyRecorder
            label="Repeat Last Capture"
            value={settings.hotkey_repeat}
            onChange={(v) => update('hotkey_repeat', v)}
          />
        </Section>

        <Section title="History">
          <Field label={`Keep last ${settings.history_limit} items`}>
            <input
              type="range"
              min={10}
              max={200}
              step={10}
              value={settings.history_limit}
              onChange={(e) => update('history_limit', parseInt(e.target.value))}
              style={{ width: 180 }}
            />
          </Field>
        </Section>

        <Section title="App">
          <Field label="Show in Dock">
            <input
              type="checkbox"
              checked={settings.show_in_dock}
              onChange={(e) => update('show_in_dock', e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
          </Field>
          <Field label="Launch at login">
            <input
              type="checkbox"
              checked={settings.autostart}
              onChange={(e) => update('autostart', e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
          </Field>
        </Section>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px 16px',
          background: '#111',
          borderTop: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
        }}
      >
        {saved && (
          <span style={{ fontSize: 13, color: '#34c759', marginRight: 8 }}>
            Settings saved!
          </span>
        )}
        <button
          onClick={handleSave}
          style={{
            padding: '7px 20px',
            background: '#4d90fe',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
