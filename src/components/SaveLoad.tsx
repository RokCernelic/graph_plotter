'use client';

import React, { useEffect, useState } from 'react';
import { GraphConfig } from '@/types';
import { getSavedGraphs, saveGraph, deleteGraph, getGraphNames } from '@/utils/storage';

interface SaveLoadProps {
  config: GraphConfig;
  onLoadGraph: (config: GraphConfig) => void;
}

export default function SaveLoad({ config, onLoadGraph }: SaveLoadProps) {
  const [name, setName] = useState('');
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { setSavedNames(getGraphNames()); }, []);

  const handleSave = () => {
    if (!name.trim()) return;
    saveGraph(name, config);
    setSavedNames(getGraphNames());
    setSelected(name);
    setName('');
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleLoad = () => {
    if (!selected) return;
    const graphs = getSavedGraphs();
    if (graphs[selected]) onLoadGraph(graphs[selected]);
  };

  const handleDelete = () => {
    if (!selected) return;
    deleteGraph(selected);
    setSavedNames(getGraphNames());
    setSelected('');
  };

  return (
    <div>
      <p className="section-label">Shrani graf</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ime grafa..."
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          style={{ flex: 1 }}
        />
        <button
          className="btn btn-primary"
          style={{ padding: '7px 12px', flexShrink: 0 }}
          onClick={handleSave}
          disabled={!name.trim()}
          title="Shrani"
        >
          {saved ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20,6 9,17 4,12" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" />
            </svg>
          )}
        </button>
      </div>

      {savedNames.length > 0 ? (
        <>
          <p className="section-label">Naloži shranjeno</p>
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={selected} onChange={e => setSelected(e.target.value)} style={{ flex: 1 }}>
              <option value="">— Izberite —</option>
              {savedNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button
              className="btn btn-secondary"
              style={{ padding: '7px 10px', flexShrink: 0 }}
              onClick={handleLoad}
              disabled={!selected}
              title="Naloži"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <button
              className="btn btn-ghost"
              style={{ padding: '7px 10px', flexShrink: 0 }}
              onClick={handleDelete}
              disabled={!selected}
              title="Briši"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3,6 5,6 21,6" /><path d="M19,6l-1,14H6L5,6" /><path d="M10,11v6M14,11v6" /><path d="M9,6V4h6v2" />
              </svg>
            </button>
          </div>
        </>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>Ni shranjenih grafov</p>
      )}
    </div>
  );
}
