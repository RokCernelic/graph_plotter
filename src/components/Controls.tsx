'use client';

import React, { useState, useRef, useEffect } from 'react';
import { GraphConfig } from '@/types';

interface ControlsProps {
  config: GraphConfig;
  onUpdateConfig: (updates: Partial<GraphConfig>) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--muted)', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{children}</div>;
}

// Common physics labels grouped by topic
const LABEL_GROUPS = [
  {
    title: 'Kinematika',
    items: ['t [s]', 's [m]', 'x [m]', 'v [m/s]', 'a [m/s²]', 'h [m]'],
  },
  {
    title: 'Dinamika',
    items: ['F [N]', 'm [kg]', 'W [J]', 'E [J]', 'P [W]', 'p [Pa]'],
  },
  {
    title: 'Toplota',
    items: ['T [°C]', 'T [K]', 'Q [J]', 'V [L]', 'V [m³]'],
  },
  {
    title: 'Elektrika',
    items: ['U [V]', 'I [A]', 'R [Ω]', 'P [W]', 'f [Hz]'],
  },
];

function LabelInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onClickOutside);
    return () => document.removeEventListener('click', onClickOutside);
  }, []);

  function handleToggle() {
    if (!open && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 3, left: rect.left, width: rect.width });
    }
    setOpen(o => !o);
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ paddingRight: 28, width: '100%', boxSizing: 'border-box' }}
      />
      <button
        type="button"
        onClick={handleToggle}
        title="Pogoste enote"
        style={{
          position: 'absolute', right: 1, top: 1, bottom: 1,
          width: 26, border: 'none',
          background: open ? 'var(--surface)' : 'transparent',
          borderRadius: '0 calc(var(--r-sm) - 1px) calc(var(--r-sm) - 1px) 0',
          cursor: 'pointer', color: open ? 'var(--forest)' : 'var(--muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'color 0.1s',
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2,3.5 5,6.5 8,3.5" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: pos.width,
          zIndex: 1000,
          background: 'var(--canvas)',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--r-md)',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
        }}>
          {LABEL_GROUPS.map(group => (
            <div key={group.title}>
              <div style={{
                padding: '4px 10px 2px',
                fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
                color: 'var(--muted)', textTransform: 'uppercase',
                borderTop: '1px solid var(--hairline)',
              }}>
                {group.title}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, padding: '3px 8px 6px' }}>
                {group.items.map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => { onChange(item); setOpen(false); }}
                    style={{
                      padding: '2px 7px',
                      fontSize: 11,
                      fontFamily: 'monospace',
                      background: value === item ? 'var(--forest-bg)' : 'var(--surface)',
                      color: value === item ? 'var(--forest)' : 'var(--body)',
                      border: `1px solid ${value === item ? 'var(--forest)' : 'var(--hairline)'}`,
                      borderRadius: 'var(--r-sm)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Controls({ config, onUpdateConfig }: ControlsProps) {
  const num = (val: string, key: keyof GraphConfig) => {
    const n = parseFloat(val);
    if (!isNaN(n)) onUpdateConfig({ [key]: n });
  };

  return (
    <div>
      <p className="section-label">Nastavitve osi</p>

      <Field label="Naslov X osi">
        <LabelInput
          value={config.x_label}
          onChange={v => onUpdateConfig({ x_label: v })}
          placeholder="npr. t [s]"
        />
      </Field>

      <Field label="Naslov Y osi">
        <LabelInput
          value={config.y_label}
          onChange={v => onUpdateConfig({ y_label: v })}
          placeholder="npr. v [m/s]"
        />
      </Field>

      <Row>
        <Field label="X min">
          <input type="number" value={config.x_min} onChange={e => num(e.target.value, 'x_min')} step="1" />
        </Field>
        <Field label="X max">
          <input type="number" value={config.x_max} onChange={e => num(e.target.value, 'x_max')} step="1" />
        </Field>
      </Row>

      <Row>
        <Field label="Y min">
          <input type="number" value={config.y_min} onChange={e => num(e.target.value, 'y_min')} step="1" />
        </Field>
        <Field label="Y max">
          <input type="number" value={config.y_max} onChange={e => num(e.target.value, 'y_max')} step="1" />
        </Field>
      </Row>

      <hr className="divider" style={{ margin: '12px 0' }} />

      <p className="section-label">Velikost grafa</p>

      <Row>
        <Field label="Širina (cm)">
          <input type="number" value={config.width_cm} onChange={e => num(e.target.value, 'width_cm')} min="4" max="25" step="0.5" />
        </Field>
        <Field label="Višina (cm)">
          <input type="number" value={config.height_cm} onChange={e => num(e.target.value, 'height_cm')} min="4" max="25" step="0.5" />
        </Field>
      </Row>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
        {([['8×8', 8, 8], ['10×10', 10, 10], ['12×8', 12, 8], ['15×10', 15, 10]] as [string, number, number][]).map(([label, w, h]) => (
          <button
            key={label}
            className="btn btn-secondary"
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => onUpdateConfig({ width_cm: w, height_cm: h })}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
