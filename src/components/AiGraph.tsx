'use client';

import { useState } from 'react';
import { GraphConfig } from '@/types';

interface AiGraphProps {
  onApply: (graph: Partial<GraphConfig>) => void;
}

export default function AiGraph({ onApply }: AiGraphProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/generate-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Napaka.');
      onApply(data.graph);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Napaka.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="section-label">AI graf</p>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate(); }}
        placeholder="npr. Graf poti v odvisnosti od časa za kolesarja, ki vozi 5 m/s 10 sekund"
        rows={4}
        style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontSize: 12, marginBottom: 8 }}
      />
      <button
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={generate}
        disabled={loading || !prompt.trim()}
      >
        {loading ? 'Ustvarjam…' : 'Ustvari graf'}
      </button>
      {error && <p style={{ fontSize: 11, color: '#b91c1c', marginTop: 6 }}>{error}</p>}
      <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
        Zamenja trenutne podatke in osi. Ctrl/⌘ + Enter za pošiljanje.
      </p>
    </div>
  );
}
