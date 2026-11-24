'use client';

import React, { useState, useEffect } from 'react';

interface NumInputProps {
  value: number;
  onCommit: (n: number) => void;
  step?: string;
  min?: string;
  max?: string;
  ariaLabel?: string;
}

// Keeps its own text while focused so the field can be fully emptied;
// only valid numbers are pushed to the parent.
export default function NumInput({ value, onCommit, step, min, max, ariaLabel }: NumInputProps) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  return (
    <input
      type="number"
      value={text}
      step={step}
      min={min}
      max={max}
      aria-label={ariaLabel}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setText(String(value)); }}
      onChange={e => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (!isNaN(n)) onCommit(n);
      }}
    />
  );
}
