'use client';

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { GraphConfig, TextNote } from '@/types';
import { generateGraphSVG, getDefaultLabelPositions, getContentBounds } from '@/utils/svgGenerator';
import { CM_TO_PX, getGraphDimensions, getScaleInfo, generateTicks } from '@/utils/graphCalculations';

interface GraphPreviewProps {
  config: GraphConfig;
  onUpdateConfig: (updates: Partial<GraphConfig>) => void;
  activeSeries: string;
  onAddPoints: (seriesId: string, pts: Array<{ x: number; y: number }>) => void;
  onMovePoint: (seriesId: string, pointId: string, x: number, y: number) => void;
}

const PREVIEW_MAX = 640;
const MIN_CM = 4;
const MAX_CM = 30;

const LABEL_GROUPS = [
  { title: 'Kinematika', items: ['t [s]', 's [m]', 'x [m]', 'v [m/s]', 'a [m/s²]', 'h [m]'] },
  { title: 'Dinamika', items: ['F [N]', 'm [kg]', 'W [J]', 'E [J]', 'P [W]', 'p [Pa]'] },
  { title: 'Toplota', items: ['T [°C]', 'T [K]', 'Q [J]', 'V [L]', 'V [m³]'] },
  { title: 'Elektrika', items: ['U [V]', 'I [A]', 'R [Ω]', 'P [W]', 'f [Hz]'] },
];

type MenuState = { kind: 'label' | 'tick'; axis: 'x' | 'y'; sx: number; sy: number; tick?: number } | null;

function useCloseOnOutside(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler); };
  }, [ref, onClose]);
}

const menuBox: React.CSSProperties = {
  position: 'fixed', zIndex: 2000,
  background: 'var(--canvas)', border: '1px solid var(--hairline)',
  borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-md)',
};

function LabelContextMenu({ axis, sx, sy, currentValue, onSelect, onClose }: {
  axis: 'x' | 'y'; sx: number; sy: number; currentValue: string;
  onSelect: (v: string) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useCloseOnOutside(ref, onClose);
  return (
    <div ref={ref} style={{ ...menuBox, left: sx, top: sy, minWidth: 200, overflow: 'hidden' }}>
      <div style={{ padding: '6px 10px 4px', fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Oznaka {axis === 'x' ? 'X' : 'Y'} osi
      </div>
      {LABEL_GROUPS.map(group => (
        <div key={group.title}>
          <div style={{ padding: '3px 10px 2px', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--muted)', textTransform: 'uppercase', borderTop: '1px solid var(--hairline)' }}>
            {group.title}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, padding: '3px 8px 6px' }}>
            {group.items.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => { onSelect(item); onClose(); }}
                style={{
                  padding: '2px 7px', fontSize: 11, fontFamily: 'monospace',
                  background: currentValue === item ? 'var(--forest-bg)' : 'var(--surface)',
                  color: currentValue === item ? 'var(--forest)' : 'var(--body)',
                  border: `1px solid ${currentValue === item ? 'var(--forest)' : 'var(--hairline)'}`,
                  borderRadius: 'var(--r-sm)', cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TickContextMenu({ axis, sx, sy, currentMin, currentMax, currentStep, tickValue, hiddenCount, onHide, onShowAll, onApply, onClose }: {
  axis: 'x' | 'y'; sx: number; sy: number; currentMin: number; currentMax: number; currentStep?: number;
  tickValue?: number; hiddenCount: number; onHide: () => void; onShowAll: () => void;
  onApply: (min: number, max: number, step: number | undefined) => void; onClose: () => void;
}) {
  const [minVal, setMinVal] = useState(String(currentMin));
  const [maxVal, setMaxVal] = useState(String(currentMax));
  const [stepVal, setStepVal] = useState(currentStep != null ? String(currentStep) : '');
  const ref = useRef<HTMLDivElement>(null);
  useCloseOnOutside(ref, onClose);

  const apply = () => {
    const min = parseFloat(minVal);
    const step = stepVal.trim() === '' ? undefined : parseFloat(stepVal);
    const max = parseFloat(maxVal);
    if (isNaN(min) || isNaN(max) || min >= max) return;
    if (step !== undefined && (isNaN(step) || step <= 0)) return;
    onApply(min, max, step);
    onClose();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') apply();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div ref={ref} style={{ ...menuBox, left: sx, top: sy, padding: '10px 12px', width: 170 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        {axis === 'x' ? 'X' : 'Y'} os — številke
      </div>
      {tickValue !== undefined && (
        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 11, padding: '4px 0', marginBottom: 6 }}
          onClick={() => { onHide(); onClose(); }}>
          Skrij številko {tickValue}
        </button>
      )}
      {hiddenCount > 0 && (
        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 11, padding: '4px 0', marginBottom: 8 }}
          onClick={() => { onShowAll(); onClose(); }}>
          Pokaži skrite ({hiddenCount})
        </button>
      )}
      <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Korak</label>
      <input
        autoFocus type="number" value={stepVal} placeholder="samodejno" min="0.001"
        onChange={e => setStepVal(e.target.value)} onKeyDown={onKey}
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 6 }}
      />
      <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Min</label>
      <input
        type="number" value={minVal}
        onChange={e => setMinVal(e.target.value)} onKeyDown={onKey}
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 6 }}
      />
      <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Max</label>
      <input
        type="number" value={maxVal}
        onChange={e => setMaxVal(e.target.value)} onKeyDown={onKey}
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 11, padding: '4px 0' }} onClick={apply}>Potrdi</button>
        <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 11, padding: '4px 0' }} onClick={onClose}>Prekliči</button>
      </div>
    </div>
  );
}

function DraggableLabel({ text, svgX, svgY, displayScale, isXLabel, weight = 600, autoEdit = false, allowEmpty = false, onMove, onTextChange, onContextMenu }: {
  text: string; svgX: number; svgY: number; displayScale: number; isXLabel: boolean;
  weight?: number; autoEdit?: boolean; allowEmpty?: boolean;
  onMove: (x: number, y: number) => void;
  onTextChange: (v: string) => void;
  onContextMenu?: (sx: number, sy: number) => void;
}) {
  const [offset, setOffset] = useState({ dx: 0, dy: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(autoEdit);
  const [editVal, setEditVal] = useState(text);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);
  const cancelled = useRef(false);

  const fontSize = Math.max(10, Math.round(12 * displayScale));

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    didDrag.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = (ev.clientX - dragStart.current.x) / displayScale;
      const dy = (ev.clientY - dragStart.current.y) / displayScale;
      if (Math.abs(dx) + Math.abs(dy) > 1) didDrag.current = true;
      setOffset({ dx, dy });
    };
    const onMouseUp = (ev: MouseEvent) => {
      if (dragStart.current && didDrag.current) {
        const dx = (ev.clientX - dragStart.current.x) / displayScale;
        const dy = (ev.clientY - dragStart.current.y) / displayScale;
        onMove(svgX + dx, svgY + dy);
      }
      dragStart.current = null;
      setIsDragging(false);
      setOffset({ dx: 0, dy: 0 });
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const startEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    cancelled.current = false;
    setEditVal(text);
    setIsEditing(true);
  };

  const commit = () => {
    setIsEditing(false);
    if (cancelled.current) return;
    if (editVal.trim()) onTextChange(editVal.trim());
    else if (allowEmpty) onTextChange('');
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={startEdit}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(e.clientX, e.clientY); }}
      title={allowEmpty ? 'Povleci za premik · dvojni klik za urejanje (prazno = izbriši)' : 'Povleci za premik · dvojni klik za urejanje · desni klik za pogoste oznake'}
      style={{
        position: 'absolute',
        left: (svgX + offset.dx) * displayScale,
        top: (svgY + offset.dy) * displayScale,
        transform: isXLabel ? 'translateY(-50%)' : 'translateY(-75%)',
        fontSize, lineHeight: 1, fontWeight: weight,
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#2c2c2c',
        cursor: isDragging ? 'grabbing' : isEditing ? 'text' : 'grab',
        userSelect: 'none', whiteSpace: 'nowrap', zIndex: 5,
      }}
    >
      {isEditing ? (
        <input
          autoFocus
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { cancelled.current = true; setIsEditing(false); }
          }}
          onMouseDown={e => e.stopPropagation()}
          style={{
            fontSize: 'inherit', fontWeight: 'inherit', fontFamily: 'inherit',
            border: 'none', borderBottom: '2px solid #0a2e0e', outline: 'none',
            background: 'rgba(255,255,255,0.9)', color: '#2c2c2c', padding: '0 2px',
            minWidth: 40, width: `${Math.max(editVal.length, 4) * 0.65}em`,
          }}
        />
      ) : (
        <span
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(10,46,14,0.07)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          style={{ padding: '2px 4px', borderRadius: 3, display: 'block', transition: 'background 0.1s' }}
        >
          {text || ' '}
        </span>
      )}
    </div>
  );
}

export default function GraphPreview({ config, onUpdateConfig, activeSeries, onAddPoints, onMovePoint }: GraphPreviewProps) {
  const svgString = useMemo(() => generateGraphSVG(config, false, true), [config]);
  const bounds = useMemo(() => getContentBounds(config), [config]);
  const printSvg = useMemo(() => generateGraphSVG(config, true), [config]);

  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [menu, setMenu] = useState<MenuState>(null);
  const [drawLine, setDrawLine] = useState<{ x1: number; y1: number; x2: number; y2: number; helper: boolean } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [textMode, setTextMode] = useState(false);
  const [newTextId, setNewTextId] = useState<string | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  const naturalW = bounds.w;
  const naturalH = bounds.h;
  const fitScale = Math.min(PREVIEW_MAX / naturalW, PREVIEW_MAX / naturalH, 1);
  const displayScale = fitScale * zoom;
  const displayW = Math.round(naturalW * displayScale);
  const displayH = Math.round(naturalH * displayScale);

  const defaultPos = useMemo(
    () => getDefaultLabelPositions(config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.x_min, config.x_max, config.y_min, config.y_max, config.width_cm, config.height_cm]
  );
  const xLabelPos = config.x_label_pos ?? defaultPos.xLabel;
  const yLabelPos = config.y_label_pos ?? defaultPos.yLabel;

  // ── Resize drag ──────────────────────────────────────────────────────────
  const dragState = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startY: e.clientY, startW: config.width_cm, startH: config.height_cm };
    setIsDragging(true);

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const dx = ev.clientX - dragState.current.startX;
      const dy = ev.clientY - dragState.current.startY;
      const rawW = dragState.current.startW + dx / (displayScale * CM_TO_PX);
      const rawH = dragState.current.startH + dy / (displayScale * CM_TO_PX);
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

  // ── Geometry helpers (SVG px <-> data) ───────────────────────────────────
  const geo = useMemo(() => {
    const dim = getGraphDimensions(config);
    const scale = getScaleInfo(config, dim);
    const xTicks = generateTicks(config.x_min, config.x_max, 5, config.x_tick_step);
    const yTicks = generateTicks(config.y_min, config.y_max, 5, config.y_tick_step);
    return { dim, scale, xTicks, yTicks };
  }, [config]);

  const snap = useCallback((v: number, ticks: { value: number }[], min: number, max: number) => {
    let r = v;
    if (ticks.length > 1) {
      const step = ticks[1].value - ticks[0].value;
      const origin = ticks[0].value;
      r = origin + Math.round((v - origin) / step) * step;
    }
    r = Math.min(Math.max(r, min), max);
    return Math.round(r * 1e6) / 1e6;
  }, []);

  const toData = useCallback((clientX: number, clientY: number, rect: DOMRect, free = false) => {
    const sx = (clientX - rect.left) / displayScale + bounds.x;
    const sy = (clientY - rect.top) / displayScale + bounds.y;
    const { dim, scale, xTicks, yTicks } = geo;
    const rx = config.x_min + (sx - dim.marginLeft) / scale.xScale;
    const ry = config.y_max - (sy - dim.marginTop) / scale.yScale;
    if (free) {
      const clamp = (v: number, a: number, b: number) => Math.round(Math.min(Math.max(v, a), b) * 100) / 100;
      return { x: clamp(rx, config.x_min, config.x_max), y: clamp(ry, config.y_min, config.y_max) };
    }
    return {
      x: snap(rx, xTicks, config.x_min, config.x_max),
      y: snap(ry, yTicks, config.y_min, config.y_max),
    };
  }, [geo, bounds, displayScale, snap, config.x_min, config.x_max, config.y_min, config.y_max]);

  // ── Shift + drag: draw a grid-snapped line, adds its end points ─────────
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (textMode && !e.shiftKey) {
      e.preventDefault();
      const p = toData(e.clientX, e.clientY, rect, true);
      const note: TextNote = { id: crypto.randomUUID(), text: 'Besedilo', x: p.x, y: p.y };
      onUpdateConfig({ texts: [...(config.texts ?? []), note] });
      setNewTextId(note.id);
      setTextMode(false);
      return;
    }
    // plain drag: grid-snapped data line; Shift + drag: free dashed helper line
    e.preventDefault();
    const helper = e.shiftKey;
    const start = toData(e.clientX, e.clientY, rect, helper);
    setDrawLine({ x1: start.x, y1: start.y, x2: start.x, y2: start.y, helper });

    const onMouseMove = (ev: MouseEvent) => {
      const p = toData(ev.clientX, ev.clientY, rect, helper);
      setDrawLine({ x1: start.x, y1: start.y, x2: p.x, y2: p.y, helper });
    };
    const onMouseUp = (ev: MouseEvent) => {
      const end = toData(ev.clientX, ev.clientY, rect, helper);
      setDrawLine(null);
      if (end.x !== start.x || end.y !== start.y) {
        if (helper) {
          onUpdateConfig({ guides: [...(config.guides ?? []), { id: crypto.randomUUID(), x1: start.x, y1: start.y, x2: end.x, y2: end.y }] });
        } else {
          onAddPoints(activeSeries, [start, end]);
        }
      }
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // ── Drag existing points (grid-snapped, hold Alt for free placement) ────
  const handlePointMouseDown = (e: React.MouseEvent, seriesId: string, pointId: string) => {
    if (e.button !== 0 || e.shiftKey || !canvasRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const move = (ev: MouseEvent) => {
      const p = toData(ev.clientX, ev.clientY, rect, ev.altKey);
      onMovePoint(seriesId, pointId, p.x, p.y);
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  // ── Right-click on tick numbers ──────────────────────────────────────────
  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = (e.clientX - rect.left) / displayScale + bounds.x;
    const sy = (e.clientY - rect.top) / displayScale + bounds.y;
    const { dim } = geo;
    const xRange = config.x_max - config.x_min;
    const yRange = config.y_max - config.y_min;
    const xOrigin = dim.marginLeft + ((0 - config.x_min) / xRange) * dim.plotWidth;
    const yOrigin = dim.marginTop + (config.y_max / yRange) * dim.plotHeight;
    const xAxisY = Math.min(Math.max(yOrigin, dim.marginTop), dim.marginTop + dim.plotHeight);
    const yAxisX = Math.min(Math.max(xOrigin, dim.marginLeft), dim.marginLeft + dim.plotWidth);

    const inX = sy >= xAxisY + 2 && sy <= xAxisY + 26 && sx >= dim.marginLeft - 12 && sx <= dim.marginLeft + dim.plotWidth + 12;
    const inY = sx >= yAxisX - 42 && sx <= yAxisX - 1 && sy >= dim.marginTop - 12 && sy <= dim.marginTop + dim.plotHeight + 12;
    const nearest = (vals: number[], pos: (v: number) => number, at: number) =>
      vals.reduce<number | undefined>((best, v) =>
        best === undefined || Math.abs(pos(v) - at) < Math.abs(pos(best) - at) ? v : best, undefined);
    if (inX) {
      const tick = nearest(geo.xTicks.map(t => t.value), v => dim.marginLeft + (v - config.x_min) * geo.scale.xScale, sx);
      setMenu({ kind: 'tick', axis: 'x', sx: e.clientX, sy: e.clientY, tick });
    } else if (inY) {
      const tick = nearest(geo.yTicks.map(t => t.value), v => dim.marginTop + (config.y_max - v) * geo.scale.yScale, sy);
      setMenu({ kind: 'tick', axis: 'y', sx: e.clientX, sy: e.clientY, tick });
    }
    else setMenu(null);
  };

  const dim = geo.dim;
  const totalPoints = config.series.reduce((n, s) => n + s.data_points.length, 0);
  const activeColor = config.series.find(s => s.id === activeSeries)?.color ?? '#0a2e0e';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: PREVIEW_MAX + 40 }}>

      {/* Toolbar */}
      <div className="no-print" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--canvas)', border: '1px solid var(--hairline)',
        borderRadius: 'var(--r-md)', padding: '8px 14px', boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--body)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {config.width_cm} × {config.height_cm} cm
          </span>
          <span style={{ color: 'var(--hairline)' }}>|</span>
          <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{totalPoints} točk</span>
          {config.name && (
            <>
              <span style={{ color: 'var(--hairline)' }}>|</span>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{config.name}</span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '3px 8px', fontSize: 11, marginRight: 6, ...(textMode ? { background: 'var(--forest)', color: 'white' } : {}) }}
            onClick={() => setTextMode(m => !m)}
            title="Besedilo: klikni na graf, da dodaš besedilo"
          >
            T Besedilo
          </button>
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

      <div className="no-print" style={{ fontSize: 11, color: 'var(--muted)' }}>
        Vleci po grafu = nariši črto (točke se dodajo izbrani seriji) · Shift + vleci = črtkana pomožna črta (desni klik nanjo jo izbriše) · gumb »T« + klik = besedilo · desni klik na številke osi = korak in min · točke: vleci (Alt = prosto) · oznake osi: vleci, dvojni klik, desni klik
      </div>

      {/* Graph card with resize handle */}
      <div style={{ position: 'relative', display: 'inline-block', alignSelf: 'flex-start' }}>
        <div style={{
          background: 'var(--canvas)',
          border: `1px solid ${isDragging ? 'var(--forest)' : 'var(--hairline)'}`,
          borderRadius: 'var(--r-lg)',
          boxShadow: isDragging ? '0 0 0 3px rgba(10,46,14,0.12)' : 'var(--shadow-md)',
          padding: 24,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          userSelect: 'none',
        }}>
          <div
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onContextMenu={handleCanvasContextMenu}
            style={{ width: displayW, height: displayH, flexShrink: 0, position: 'relative', cursor: textMode ? 'text' : undefined }}
          >
            <div style={{ width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: svgString }} />

            {drawLine && (
              <svg
                viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
              >
                {(() => {
                  const px = (x: number) => dim.marginLeft + (x - config.x_min) * geo.scale.xScale;
                  const py = (y: number) => dim.marginTop + (config.y_max - y) * geo.scale.yScale;
                  return (
                    <>
                      <line x1={px(drawLine.x1)} y1={py(drawLine.y1)} x2={px(drawLine.x2)} y2={py(drawLine.y2)}
                        stroke={drawLine.helper ? '#444' : activeColor} strokeWidth="1.5" strokeDasharray={drawLine.helper ? '6 4' : undefined} />
                      <circle cx={px(drawLine.x1)} cy={py(drawLine.y1)} r="3.5" fill={activeColor} />
                      <circle cx={px(drawLine.x2)} cy={py(drawLine.y2)} r="3.5" fill={activeColor} />
                    </>
                  );
                })()}
              </svg>
            )}

            <svg
              viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
            >
              {(config.guides ?? []).map(g => {
                const x1 = dim.marginLeft + (g.x1 - config.x_min) * geo.scale.xScale;
                const y1 = dim.marginTop + (config.y_max - g.y1) * geo.scale.yScale;
                const x2 = dim.marginLeft + (g.x2 - config.x_min) * geo.scale.xScale;
                const y2 = dim.marginTop + (config.y_max - g.y2) * geo.scale.yScale;
                return (
                  <line
                    key={g.id} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="transparent" strokeWidth="10"
                    style={{ pointerEvents: 'stroke' }}
                    onContextMenu={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      onUpdateConfig({ guides: (config.guides ?? []).filter(q => q.id !== g.id) });
                    }}
                  >
                    <title>Desni klik = izbriši pomožno črto</title>
                  </line>
                );
              })}
              {config.series.map(sr => sr.data_points.map(pt => (
                <circle
                  key={pt.id}
                  cx={dim.marginLeft + (pt.x - config.x_min) * geo.scale.xScale}
                  cy={dim.marginTop + (config.y_max - pt.y) * geo.scale.yScale}
                  r="8" fill="transparent"
                  style={{ pointerEvents: 'all', cursor: 'grab' }}
                  onMouseDown={e => handlePointMouseDown(e, sr.id, pt.id)}
                />
              )))}
            </svg>

            {(config.texts ?? []).map(t => {
              const px = dim.marginLeft + (t.x - config.x_min) * geo.scale.xScale;
              const py = dim.marginTop + (config.y_max - t.y) * geo.scale.yScale;
              const updateNote = (patch: Partial<TextNote>) =>
                onUpdateConfig({ texts: (config.texts ?? []).map(n => n.id === t.id ? { ...n, ...patch } : n) });
              return (
                <DraggableLabel
                  key={t.id}
                  text={t.text}
                  svgX={px - bounds.x} svgY={py - bounds.y}
                  displayScale={displayScale} isXLabel weight={400}
                  autoEdit={t.id === newTextId} allowEmpty
                  onMove={(x, y) => {
                    const nx = config.x_min + (x + bounds.x - dim.marginLeft) / geo.scale.xScale;
                    const ny = config.y_max - (y + bounds.y - dim.marginTop) / geo.scale.yScale;
                    updateNote({ x: Math.round(nx * 100) / 100, y: Math.round(ny * 100) / 100 });
                  }}
                  onTextChange={v => v === ''
                    ? onUpdateConfig({ texts: (config.texts ?? []).filter(n => n.id !== t.id) })
                    : updateNote({ text: v })}
                />
              );
            })}

            <DraggableLabel
              text={config.x_label}
              svgX={xLabelPos.x - bounds.x} svgY={xLabelPos.y - bounds.y}
              displayScale={displayScale} isXLabel
              onMove={(x, y) => onUpdateConfig({ x_label_pos: { x: x + bounds.x, y: y + bounds.y } })}
              onTextChange={v => onUpdateConfig({ x_label: v })}
              onContextMenu={(sx, sy) => setMenu({ kind: 'label', axis: 'x', sx, sy })}
            />
            <DraggableLabel
              text={config.y_label}
              svgX={yLabelPos.x - bounds.x} svgY={yLabelPos.y - bounds.y}
              displayScale={displayScale} isXLabel={false}
              onMove={(x, y) => onUpdateConfig({ y_label_pos: { x: x + bounds.x, y: y + bounds.y } })}
              onTextChange={v => onUpdateConfig({ y_label: v })}
              onContextMenu={(sx, sy) => setMenu({ kind: 'label', axis: 'y', sx, sy })}
            />
          </div>
        </div>

        <div
          className="no-print"
          onMouseDown={handleResizeMouseDown}
          title={`Povleci za spremembo velikosti (${config.width_cm}×${config.height_cm} cm)`}
          style={{
            position: 'absolute', bottom: 4, right: 4, width: 20, height: 20,
            cursor: 'nwse-resize', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
            padding: 3, borderRadius: '0 0 var(--r-lg) 0',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            {[[10, 10], [10, 6], [10, 2], [6, 10], [6, 6], [2, 10]].map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" fill={isDragging ? 'var(--forest)' : 'var(--muted)'} />
            ))}
          </svg>
        </div>

        {isDragging && (
          <div style={{
            position: 'absolute', bottom: 28, right: 8, background: 'var(--forest)', color: 'white',
            fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4,
            pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            {config.width_cm} × {config.height_cm} cm
          </div>
        )}
      </div>

      {menu?.kind === 'label' && (
        <LabelContextMenu
          axis={menu.axis} sx={menu.sx} sy={menu.sy}
          currentValue={menu.axis === 'x' ? config.x_label : config.y_label}
          onSelect={v => onUpdateConfig(menu.axis === 'x' ? { x_label: v } : { y_label: v })}
          onClose={closeMenu}
        />
      )}
      {menu?.kind === 'tick' && (
        <TickContextMenu
          axis={menu.axis} sx={menu.sx} sy={menu.sy}
          currentMin={menu.axis === 'x' ? config.x_min : config.y_min}
          currentMax={menu.axis === 'x' ? config.x_max : config.y_max}
          currentStep={menu.axis === 'x' ? config.x_tick_step : config.y_tick_step}
          tickValue={menu.tick}
          hiddenCount={(menu.axis === 'x' ? config.hidden_x_ticks : config.hidden_y_ticks)?.length ?? 0}
          onHide={() => {
            if (menu.tick === undefined) return;
            const key = menu.axis === 'x' ? 'hidden_x_ticks' : 'hidden_y_ticks';
            onUpdateConfig({ [key]: [...(config[key] ?? []), menu.tick] });
          }}
          onShowAll={() => onUpdateConfig(menu.axis === 'x' ? { hidden_x_ticks: [] } : { hidden_y_ticks: [] })}
          onApply={(min, max, step) => {
            onUpdateConfig(menu.axis === 'x'
              ? { x_min: min, x_max: max, x_tick_step: step }
              : { y_min: min, y_max: max, y_tick_step: step });
          }}
          onClose={closeMenu}
        />
      )}

      <div className="hidden print:block" dangerouslySetInnerHTML={{ __html: printSvg }} />
    </div>
  );
}
