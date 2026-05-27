'use client';

import React from 'react';
import { Series, SERIES_COLORS } from '@/types';

interface DataTableProps {
  series: Series[];
  activeSeries: string;
  onSelectSeries: (id: string) => void;
  onAddSeries: () => void;
  onRemoveSeries: (id: string) => void;
  onUpdateSeriesColor: (id: string, color: string) => void;
  onUpdateSeriesName: (id: string, name: string) => void;
  onUpdateSeriesSmooth: (id: string, smooth: boolean) => void;
  onAddPoint: (seriesId: string) => void;
  onRemovePoint: (seriesId: string, pointId: string) => void;
  onUpdatePoint: (seriesId: string, id: string, x: number, y: number) => void;
}

const CurveIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M 1 10 C 3 10 4 3 6.5 3 C 9 3 10 10 12 10" />
  </svg>
);

const LineIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <line x1="1" y1="10" x2="12" y2="3" />
  </svg>
);

export default function DataTable({
  series, activeSeries, onSelectSeries, onAddSeries, onRemoveSeries,
  onUpdateSeriesColor, onUpdateSeriesName, onUpdateSeriesSmooth,
  onAddPoint, onRemovePoint, onUpdatePoint,
}: DataTableProps) {
  const activeS = series.find(s => s.id === activeSeries) ?? series[0];
  const dataPoints = activeS?.data_points ?? [];

  const handleChange = (id: string, field: 'x' | 'y', value: string) => {
    const n = parseFloat(value);
    if (!isNaN(n)) {
      const p = dataPoints.find(p => p.id === id);
      if (p) onUpdatePoint(activeS.id, id, field === 'x' ? n : p.x, field === 'y' ? n : p.y);
    }
  };

  const totalPoints = series.reduce((n, s) => n + s.data_points.length, 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p className="section-label" style={{ marginBottom: 0 }}>Podatki</p>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{totalPoints} točk</span>
      </div>

      {/* Series tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
        {series.map(s => (
          <button
            key={s.id}
            onClick={() => onSelectSeries(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '3px 7px',
              borderRadius: 'var(--r-sm)',
              border: `1.5px solid ${s.id === activeSeries ? s.color : 'var(--hairline)'}`,
              background: s.id === activeSeries ? 'white' : 'transparent',
              cursor: 'pointer', fontSize: 11,
              color: s.id === activeSeries ? s.color : 'var(--muted)',
              fontWeight: s.id === activeSeries ? 600 : 400,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            {series.length > 1 && (
              <span
                onClick={e => { e.stopPropagation(); onRemoveSeries(s.id); }}
                style={{ marginLeft: 1, color: 'var(--muted)', lineHeight: 1, fontSize: 13, cursor: 'pointer' }}
                title="Odstrani serijo"
              >×</span>
            )}
          </button>
        ))}
        {series.length < 5 && (
          <button
            onClick={onAddSeries}
            style={{
              padding: '3px 8px', borderRadius: 'var(--r-sm)',
              border: '1.5px dashed var(--hairline)', background: 'transparent',
              cursor: 'pointer', fontSize: 11, color: 'var(--muted)',
            }}
          >
            + serija
          </button>
        )}
      </div>

      {/* Active series controls: color | name | smooth toggle */}
      {activeS && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
          <input
            type="color"
            value={activeS.color}
            onChange={e => onUpdateSeriesColor(activeS.id, e.target.value)}
            style={{ width: 28, height: 28, padding: 2, border: '1px solid var(--hairline)', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
            title="Barva serije"
          />
          <input
            type="text"
            value={activeS.name}
            onChange={e => onUpdateSeriesName(activeS.id, e.target.value)}
            style={{ flex: 1, fontSize: 12 }}
            placeholder="Ime serije"
          />
          <button
            onClick={() => onUpdateSeriesSmooth(activeS.id, !activeS.smooth)}
            title={activeS.smooth ? 'Gladka krivulja — klikni za ravno' : 'Ravna linija — klikni za gladko'}
            style={{
              width: 28, height: 28, padding: 0, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1px solid ${activeS.smooth ? activeS.color : 'var(--hairline)'}`,
              borderRadius: 'var(--r-sm)',
              background: activeS.smooth ? `${activeS.color}1a` : 'transparent',
              color: activeS.smooth ? activeS.color : 'var(--muted)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {activeS.smooth ? <CurveIcon /> : <LineIcon />}
          </button>
        </div>
      )}

      {/* Data point rows */}
      {dataPoints.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 4, marginBottom: 4, paddingRight: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, paddingLeft: 2 }}>X</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, paddingLeft: 2 }}>Y</span>
            <span />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {dataPoints.map((point, i) => (
              <div key={point.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 4, alignItems: 'center' }}>
                <input
                  type="number"
                  value={point.x}
                  onChange={e => handleChange(point.id, 'x', e.target.value)}
                  step="0.1"
                  aria-label={`X ${i + 1}`}
                />
                <input
                  type="number"
                  value={point.y}
                  onChange={e => handleChange(point.id, 'y', e.target.value)}
                  step="0.1"
                  aria-label={`Y ${i + 1}`}
                />
                <button
                  className="btn btn-ghost"
                  style={{ padding: 0, width: 28, height: 28 }}
                  onClick={() => onRemovePoint(activeS.id, point.id)}
                  title="Briši točko"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <line x1="2" y1="2" x2="10" y2="10" /><line x1="10" y1="2" x2="2" y2="10" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {dataPoints.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '16px 0', color: 'var(--muted)',
          fontSize: 12, border: '1px dashed var(--hairline)', borderRadius: 'var(--r-md)', marginBottom: 8,
        }}>
          Ni podatkov. Dodaj točke spodaj.
        </div>
      )}

      <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onAddPoint(activeS.id)}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" />
        </svg>
        Dodaj točko
      </button>
    </div>
  );
}
