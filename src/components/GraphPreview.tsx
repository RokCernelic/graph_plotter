'use client';

import React, { useMemo, useState, useRef, useCallback } from 'react';
import { GraphConfig } from '@/types';
import { generateGraphSVG } from '@/utils/svgGenerator';
import { cmToPx, CM_TO_PX } from '@/utils/graphCalculations';

interface GraphPreviewProps {
  config: GraphConfig;
  onUpdateConfig: (updates: Partial<GraphConfig>) => void;
}

const PREVIEW_MAX = 640;
const MIN_CM = 4;
const MAX_CM = 30;

export default function GraphPreview({ config, onUpdateConfig }: GraphPreviewProps) {
  const svgString = useMemo(() => generateGraphSVG(config), [config]);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const naturalW = cmToPx(config.width_cm);
  const naturalH = cmToPx(config.height_cm);

  const fitScale = Math.min(PREVIEW_MAX / naturalW, PREVIEW_MAX / naturalH, 1);
  const displayScale = fitScale * zoom;

  const displayW = Math.round(naturalW * displayScale);
  const displayH = Math.round(naturalH * displayScale);

  // Drag-resize: track start position and initial cm dimensions
  const dragState = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: config.width_cm,
      startH: config.height_cm,
    };
    setIsDragging(true);

    const onMouseMove = (e: MouseEvent) => {
      if (!dragState.current) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;

      // Convert pixel delta → cm, accounting for display scale
      const rawW = dragState.current.startW + dx / (displayScale * CM_TO_PX);
      const rawH = dragState.current.startH + dy / (displayScale * CM_TO_PX);

      // Snap to 0.5 cm
      const newW = Math.round(Math.max(MIN_CM, Math.min(MAX_CM, rawW)) * 2) / 2;
      const newH = Math.round(Math.max(MIN_CM, Math.min(MAX_CM, rawH)) * 2) / 2;

      onUpdateConfig({ width_cm: newW, height_cm: newH });
    };

    const onMouseUp = () => {
      dragState.current = null;
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [config.width_cm, config.height_cm, displayScale, onUpdateConfig]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: PREVIEW_MAX + 40 }}>

      {/* Toolbar */}
      <div className="no-print" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--canvas)', border: '1px solid var(--hairline)',
        borderRadius: 'var(--r-md)', padding: '8px 14px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            <span style={{ fontSize: 12, color: 'var(--body)', fontWeight: 500 }}>
              {config.width_cm} × {config.height_cm} cm
            </span>
          </div>
          <span style={{ color: 'var(--hairline)' }}>|</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {config.series.reduce((n, s) => n + s.data_points.length, 0)} točk
          </span>
          {config.name && (
            <>
              <span style={{ color: 'var(--hairline)' }}>|</span>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{config.name}</span>
            </>
          )}
        </div>

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}>−</button>
          <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 36, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => setZoom(z => Math.min(2, z + 0.25))}>+</button>
          <button className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: 11, marginLeft: 2 }}
            onClick={() => setZoom(1)}>Ponastavi</button>
        </div>
      </div>

      {/* Graph card with resize handle */}
      <div style={{ position: 'relative', display: 'inline-block', alignSelf: 'flex-start' }}>
        <div style={{
          background: 'var(--canvas)',
          border: `1px solid ${isDragging ? 'var(--forest)' : 'var(--hairline)'}`,
          borderRadius: 'var(--r-lg)',
          boxShadow: isDragging ? '0 0 0 3px rgba(10,46,14,0.12)' : 'var(--shadow-md)',
          padding: 24,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          userSelect: 'none',
        }}>
          <div
            style={{ width: displayW, height: displayH, flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: svgString }}
          />
        </div>

        {/* Drag handle — bottom-right corner */}
        <div
          className="no-print"
          onMouseDown={handleResizeMouseDown}
          title={`Povleci za spremembo velikosti (${config.width_cm}×${config.height_cm} cm)`}
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            width: 20,
            height: 20,
            cursor: 'nwse-resize',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            padding: 3,
            borderRadius: '0 0 var(--r-lg) 0',
          }}
        >
          {/* Grip dots — standard resize indicator */}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="10" cy="10" r="1.5" fill={isDragging ? 'var(--forest)' : 'var(--muted)'} />
            <circle cx="10" cy="6"  r="1.5" fill={isDragging ? 'var(--forest)' : 'var(--muted)'} />
            <circle cx="10" cy="2"  r="1.5" fill={isDragging ? 'var(--forest)' : 'var(--muted)'} />
            <circle cx="6"  cy="10" r="1.5" fill={isDragging ? 'var(--forest)' : 'var(--muted)'} />
            <circle cx="6"  cy="6"  r="1.5" fill={isDragging ? 'var(--forest)' : 'var(--muted)'} />
            <circle cx="2"  cy="10" r="1.5" fill={isDragging ? 'var(--forest)' : 'var(--muted)'} />
          </svg>
        </div>

        {/* Size tooltip while dragging */}
        {isDragging && (
          <div style={{
            position: 'absolute',
            bottom: 28,
            right: 8,
            background: 'var(--forest)',
            color: 'white',
            fontSize: 11,
            fontWeight: 500,
            padding: '3px 8px',
            borderRadius: 4,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}>
            {config.width_cm} × {config.height_cm} cm
          </div>
        )}
      </div>

      {/* Print: render at natural size, no chrome */}
      <div className="hidden print:block" dangerouslySetInnerHTML={{ __html: svgString }} />
    </div>
  );
}
