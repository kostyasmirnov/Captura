import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { HistoryEntry } from '../types';

export default function History() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const loadHistory = () => {
    invoke<HistoryEntry[]>('get_history')
      .then(setEntries)
      .catch(console.error);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleOpen = async (id: string) => {
    await invoke('open_history_item', { id }).catch(console.error);
  };

  const handleDelete = async (id: string, deleteFile: boolean) => {
    await invoke('delete_history_entry', { id, deleteFile }).catch(console.error);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (selected === id) setSelected(null);
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Screenshot History</h1>
        <span style={{ color: '#888', fontSize: 13 }}>{entries.length} items</span>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {entries.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#555',
              fontSize: 14,
            }}
          >
            No screenshots yet. Press Cmd+Shift+1 to capture.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {entries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => setSelected(selected === entry.id ? null : entry.id)}
                onDoubleClick={() => handleOpen(entry.id)}
                style={{
                  background: selected === entry.id ? '#2a4a7a' : '#252525',
                  border: `2px solid ${selected === entry.id ? '#4d90fe' : '#333'}`,
                  borderRadius: 8,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                  position: 'relative',
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    width: '100%',
                    height: 120,
                    overflow: 'hidden',
                    background: '#111',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={`data:image/png;base64,${entry.thumbnail}`}
                    alt="screenshot"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </div>

                {/* Info */}
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>
                    {entry.width} × {entry.height}
                  </div>
                  <div style={{ fontSize: 11, color: '#777' }}>
                    {formatDate(entry.timestamp)}
                  </div>
                  {entry.file_path && (
                    <div
                      style={{
                        fontSize: 10,
                        color: '#555',
                        marginTop: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={entry.file_path}
                    >
                      {entry.file_path.split('/').pop()}
                    </div>
                  )}
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(entry.id, true);
                  }}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    background: 'rgba(0,0,0,0.6)',
                    border: 'none',
                    borderRadius: 4,
                    color: '#fff',
                    width: 22,
                    height: 22,
                    cursor: 'pointer',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0,
                    transition: 'opacity 0.15s',
                  }}
                  className="delete-btn"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom action bar (shown when item selected) */}
      {selected && (
        <div
          style={{
            padding: '10px 16px',
            background: '#111',
            borderTop: '1px solid #333',
            display: 'flex',
            gap: 8,
          }}
        >
          <button
            onClick={() => handleOpen(selected)}
            style={{
              padding: '6px 14px',
              background: '#4d90fe',
              border: 'none',
              borderRadius: 5,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Open in Editor
          </button>
          <button
            onClick={() => handleDelete(selected, false)}
            style={{
              padding: '6px 14px',
              background: '#444',
              border: 'none',
              borderRadius: 5,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Remove from History
          </button>
          <button
            onClick={() => handleDelete(selected, true)}
            style={{
              padding: '6px 14px',
              background: '#c0392b',
              border: 'none',
              borderRadius: 5,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Delete File
          </button>
        </div>
      )}

      <style>{`
        .delete-btn { opacity: 0; }
        div:hover > .delete-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
