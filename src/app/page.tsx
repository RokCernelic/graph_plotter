'use client';

import React, { useState, useCallback } from 'react';
import { GraphConfig, Series, SERIES_COLORS, DEFAULT_GRAPH_CONFIG } from '@/types';
import DataTable from '@/components/DataTable';
import Controls from '@/components/Controls';
import GraphPreview from '@/components/GraphPreview';
import SaveLoad from '@/components/SaveLoad';
import { generateGraphSVG, svgToPng, downloadPng } from '@/utils/svgGenerator';
import { autoFitAxes } from '@/utils/graphCalculations';

export default function Home() {
  const [config, setConfig] = useState<GraphConfig>(DEFAULT_GRAPH_CONFIG);
  const [activeSeries, setActiveSeries] = useState<string>(DEFAULT_GRAPH_CONFIG.series[0].id);

  // ── Series management ────────────────────────────────────────────────────

  const handleAddSeries = useCallback(() => {
    setConfig(prev => {
      const newId = crypto.randomUUID();
      const color = SERIES_COLORS[prev.series.length % SERIES_COLORS.length];
      const newSeries: Series = { id: newId, name: `Serija ${prev.series.length + 1}`, color, smooth: false, data_points: [] };
      setActiveSeries(newId);
      return { ...prev, series: [...prev.series, newSeries] };
    });
  }, []);

  const handleRemoveSeries = useCallback((id: string) => {
    setConfig(prev => {
      if (prev.series.length <= 1) return prev;
      const newSeries = prev.series.filter(s => s.id !== id);
      setActiveSeries(newSeries[0].id);
      return { ...prev, series: newSeries, ...autoFitAxes(newSeries) };
    });
  }, []);

  const handleUpdateSeriesColor = useCallback((id: string, color: string) => {
    setConfig(prev => ({ ...prev, series: prev.series.map(s => s.id === id ? { ...s, color } : s) }));
  }, []);

  const handleUpdateSeriesName = useCallback((id: string, name: string) => {
    setConfig(prev => ({ ...prev, series: prev.series.map(s => s.id === id ? { ...s, name } : s) }));
  }, []);

  const handleUpdateSeriesSmooth = useCallback((id: string, smooth: boolean) => {
    setConfig(prev => ({ ...prev, series: prev.series.map(s => s.id === id ? { ...s, smooth } : s) }));
  }, []);

  // ── Point management ─────────────────────────────────────────────────────

  const handleAddPoint = useCallback((seriesId: string) => {
    setConfig(prev => {
      const newSeries = prev.series.map(s =>
        s.id === seriesId ? { ...s, data_points: [...s.data_points, { id: crypto.randomUUID(), x: 0, y: 0 }] } : s
      );
      return { ...prev, series: newSeries, ...autoFitAxes(newSeries) };
    });
  }, []);

  const handleAddPoints = useCallback((seriesId: string, pts: Array<{ x: number; y: number }>) => {
    setConfig(prev => ({
      ...prev,
      series: prev.series.map(s => {
        if (s.id !== seriesId) return s;
        const next = [...s.data_points];
        for (const p of pts) {
          if (!next.some(q => q.x === p.x && q.y === p.y)) next.push({ id: crypto.randomUUID(), x: p.x, y: p.y });
        }
        return { ...s, data_points: next };
      }),
    }));
  }, []);

  const handleRemovePoint = useCallback((seriesId: string, pointId: string) => {
    setConfig(prev => {
      const newSeries = prev.series.map(s =>
        s.id === seriesId ? { ...s, data_points: s.data_points.filter(p => p.id !== pointId) } : s
      );
      return { ...prev, series: newSeries, ...autoFitAxes(newSeries) };
    });
  }, []);

  const handleUpdatePoint = useCallback((seriesId: string, id: string, x: number, y: number) => {
    setConfig(prev => {
      const newSeries = prev.series.map(s =>
        s.id === seriesId ? { ...s, data_points: s.data_points.map(p => p.id === id ? { ...p, x, y } : p) } : s
      );
      return { ...prev, series: newSeries, ...autoFitAxes(newSeries) };
    });
  }, []);

  // ── Config / export ──────────────────────────────────────────────────────

  const handleUpdateConfig = useCallback((updates: Partial<GraphConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const handleLoadGraph = useCallback((loaded: GraphConfig) => {
    // Migrate old saved graphs that stored data_points at the top level
    type OldConfig = GraphConfig & { data_points?: Array<{ id: string; x: number; y: number }> };
    const old = loaded as OldConfig;
    let migrated = loaded;
    if (!loaded.series && old.data_points) {
      migrated = {
        ...loaded,
        series: [{
          id: '1', name: 'Serija 1', color: SERIES_COLORS[0], smooth: false,
          data_points: old.data_points,
        }],
      };
    }
    setConfig(migrated);
    setActiveSeries(migrated.series?.[0]?.id ?? '1');
  }, []);

  const handleExportPng = useCallback(async () => {
    try {
      const blob = await svgToPng(generateGraphSVG(config, true));
      downloadPng(blob, config.name ? `${config.name}.png` : `graf_${new Date().toISOString().split('T')[0]}.png`);
    } catch {
      alert('Napaka pri izvažanju. Prosim poskusite ponovno.');
    }
  }, [config]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--surface)' }}>

      {/* Top header */}
      <header className="no-print" style={{
        background: 'var(--canvas)',
        borderBottom: '1px solid var(--hairline)',
        padding: '0 24px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <polyline points="1,12 4,7 7,9 10,4 13,6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>Grafikograf</span>
          <span style={{ color: 'var(--hairline)', margin: '0 4px' }}>|</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Fizika — razredi 8 in 9</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary no-print" onClick={() => window.print()}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6,9 6,2 18,2 18,9" /><path d="M6,18H4a2,2,0,0,1-2-2V11a2,2,0,0,1,2-2H20a2,2,0,0,1,2,2v5a2,2,0,0,1-2,2H18" /><rect x="6" y="14" width="12" height="8" />
            </svg>
            Natisni
          </button>
          <button className="btn btn-primary no-print" onClick={handleExportPng}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7,10 12,15 17,10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Preuzmi PNG
          </button>
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <aside className="sidebar no-print" style={{
          width: 280,
          flexShrink: 0,
          background: 'var(--canvas)',
          borderRight: '1px solid var(--hairline)',
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}>
          <Controls config={config} onUpdateConfig={handleUpdateConfig} />
          <hr className="divider" />
          <DataTable
            series={config.series}
            activeSeries={activeSeries}
            onSelectSeries={setActiveSeries}
            onAddSeries={handleAddSeries}
            onRemoveSeries={handleRemoveSeries}
            onUpdateSeriesColor={handleUpdateSeriesColor}
            onUpdateSeriesName={handleUpdateSeriesName}
            onUpdateSeriesSmooth={handleUpdateSeriesSmooth}
            onAddPoint={handleAddPoint}
            onRemovePoint={handleRemovePoint}
            onUpdatePoint={handleUpdatePoint}
          />
          <hr className="divider" />
          <SaveLoad config={config} onLoadGraph={handleLoadGraph} />
        </aside>

        {/* Main graph area */}
        <main style={{ flex: 1, overflow: 'auto', padding: 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
          <GraphPreview config={config} onUpdateConfig={handleUpdateConfig} activeSeries={activeSeries} onAddPoints={handleAddPoints} />
        </main>
      </div>
    </div>
  );
}
