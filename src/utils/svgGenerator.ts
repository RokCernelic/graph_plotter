import { GraphConfig, Series } from '@/types';
import { getGraphDimensions, getScaleInfo, dataToPixel, generateTicks, GraphDimensions, ScaleInfo } from './graphCalculations';

const ARROW_EXT = 30;
const CLIP_PAD = 8; // data may overshoot the plot area slightly so edge points/lines are not cut off

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface PixelPt { px: number; py: number; }

// Natural cubic spline: C2-continuous interpolation, minimises curvature.
// This is the standard "physicist's smooth curve" — it passes through every
// data point but without the overshooting that Catmull-Rom can produce.
function naturalCubicSplinePath(pts: PixelPt[]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return '';

  const x = pts.map(p => p.px);
  const y = pts.map(p => p.py);
  const h = Array.from({ length: n - 1 }, (_, i) => x[i + 1] - x[i]);

  // Fall back to straight lines if any interval is degenerate
  if (h.some(hi => Math.abs(hi) < 0.01)) {
    let d = `M ${x[0].toFixed(2)},${y[0].toFixed(2)}`;
    for (let i = 1; i < n; i++) d += ` L ${x[i].toFixed(2)},${y[i].toFixed(2)}`;
    return d;
  }

  // Solve tridiagonal system for second derivatives c[i] (natural end conditions: c[0]=c[n-1]=0)
  const c = new Array(n).fill(0);

  if (n > 2) {
    const m = n - 2; // number of interior unknowns
    const diag = new Array(m);
    const lower = new Array(m); // sub-diagonal: h[i-1] for each interior row
    const upper = new Array(m); // super-diagonal: h[i] for each interior row
    const rhs = new Array(m);

    for (let j = 0; j < m; j++) {
      const i = j + 1;
      diag[j] = 2 * (h[i - 1] + h[i]);
      lower[j] = h[i - 1];
      upper[j] = h[i];
      rhs[j] = 3 * ((y[i + 1] - y[i]) / h[i] - (y[i] - y[i - 1]) / h[i - 1]);
    }

    // Thomas forward sweep
    const d2 = [...diag];
    const r2 = [...rhs];
    for (let j = 1; j < m; j++) {
      const factor = lower[j] / d2[j - 1];
      d2[j] -= factor * upper[j - 1];
      r2[j] -= factor * r2[j - 1];
    }

    // Back substitution
    const cInt = new Array(m);
    cInt[m - 1] = r2[m - 1] / d2[m - 1];
    for (let j = m - 2; j >= 0; j--) {
      cInt[j] = (r2[j] - upper[j] * cInt[j + 1]) / d2[j];
    }

    for (let j = 0; j < m; j++) c[j + 1] = cInt[j];
  }

  // First derivatives (slopes) at each point
  const s = Array.from({ length: n - 1 }, (_, i) =>
    (y[i + 1] - y[i]) / h[i] - h[i] * (2 * c[i] + c[i + 1]) / 3
  );
  const sLast = s[n - 2] + h[n - 2] * (c[n - 2] + c[n - 1]);
  const slopes = [...s, sLast];

  // Convert each cubic polynomial segment to an SVG cubic Bezier
  let d = `M ${x[0].toFixed(2)},${y[0].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const cp1x = x[i] + h[i] / 3;
    const cp1y = y[i] + slopes[i] * h[i] / 3;
    const cp2x = x[i + 1] - h[i] / 3;
    const cp2y = y[i + 1] - slopes[i + 1] * h[i] / 3;
    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${x[i + 1].toFixed(2)},${y[i + 1].toFixed(2)}`;
  }
  return d;
}

function straightLinePath(pts: PixelPt[]): string {
  if (pts.length === 0) return '';
  let d = `M ${pts[0].px.toFixed(2)},${pts[0].py.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].px.toFixed(2)},${pts[i].py.toFixed(2)}`;
  return d;
}

// Splits a series into solid runs and dashed vertical segments (equal x).
function buildSeriesPaths(
  series: Series,
  config: GraphConfig,
  dim: GraphDimensions,
  scale: ScaleInfo
): { solid: string[]; dashed: string[] } {
  const solid: string[] = [];
  const dashed: string[] = [];
  if (series.data_points.length < 2) return { solid, dashed };

  const sorted = [...series.data_points].sort((a, b) => a.x - b.x);
  const pts = sorted.map(p => dataToPixel(p, config, dim, scale));

  const flush = (run: PixelPt[]) => {
    if (run.length < 2) return;
    solid.push(series.smooth ? naturalCubicSplinePath(run) : straightLinePath(run));
  };

  let run: PixelPt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (Math.abs(pts[i].px - pts[i - 1].px) < 0.01) {
      flush(run);
      dashed.push(straightLinePath([pts[i - 1], pts[i]]));
      run = [pts[i]];
    } else {
      run.push(pts[i]);
    }
  }
  flush(run);
  return { solid, dashed };
}

export function getDefaultLabelPositions(config: GraphConfig): {
  xLabel: { x: number; y: number };
  yLabel: { x: number; y: number };
} {
  const dim = getGraphDimensions(config);
  const xRange = config.x_max - config.x_min;
  const yRange = config.y_max - config.y_min;
  const xOriginPx = dim.marginLeft + ((0 - config.x_min) / xRange) * dim.plotWidth;
  const yOriginPx = dim.marginTop + ((config.y_max - 0) / yRange) * dim.plotHeight;
  const xAxisY = Math.min(Math.max(yOriginPx, dim.marginTop), dim.marginTop + dim.plotHeight);
  const yAxisX = Math.min(Math.max(xOriginPx, dim.marginLeft), dim.marginLeft + dim.plotWidth);
  return {
    xLabel: { x: dim.marginLeft + dim.plotWidth + ARROW_EXT + 6, y: xAxisY },
    yLabel: { x: yAxisX + 5, y: dim.marginTop - ARROW_EXT - 2 },
  };
}

export const isTickHidden = (list: number[] | undefined, v: number) =>
  !!list?.some(h => Math.abs(h - v) < 1e-6);

// "t_1" / "s_{max}" -> text with a subscript
function richText(name: string): string {
  const re = /_\{([^}]+)\}|_([A-Za-z0-9])/g;
  let out = '';
  let last = 0;
  let afterSub = false;
  const plain = (t: string) => {
    if (!t) return;
    out += afterSub ? `<tspan dy="-3">${escapeXml(t)}</tspan>` : escapeXml(t);
    afterSub = false;
  };
  for (let m = re.exec(name); m; m = re.exec(name)) {
    plain(name.slice(last, m.index));
    out += `<tspan dy="3" font-size="75%">${escapeXml(m[1] ?? m[2])}</tspan>`;
    afterSub = true;
    last = m.index + m[0].length;
  }
  plain(name.slice(last));
  return out;
}

export interface ContentBounds { x: number; y: number; w: number; h: number; }

const CROP_PAD = 5;

// Tight bounding box (SVG px) around everything visible: plot, axes, arrows, numbers, labels, notes.
export function getContentBounds(config: GraphConfig): ContentBounds {
  const dim = getGraphDimensions(config);
  const xRange = config.x_max - config.x_min;
  const yRange = config.y_max - config.y_min;
  const xOriginPx = dim.marginLeft + ((0 - config.x_min) / xRange) * dim.plotWidth;
  const yOriginPx = dim.marginTop + (config.y_max / yRange) * dim.plotHeight;
  const xAxisY = Math.min(Math.max(yOriginPx, dim.marginTop), dim.marginTop + dim.plotHeight);
  const yAxisX = Math.min(Math.max(xOriginPx, dim.marginLeft), dim.marginLeft + dim.plotWidth);
  const scale = getScaleInfo(config, dim);
  const def = getDefaultLabelPositions(config);
  const xPos = config.x_label_pos ?? def.xLabel;
  const yPos = config.y_label_pos ?? def.yLabel;

  let x0 = dim.marginLeft, x1 = dim.marginLeft + dim.plotWidth;
  let y0 = dim.marginTop, y1 = dim.marginTop + dim.plotHeight;
  const add = (ax: number, ay: number, bx: number, by: number) => {
    x0 = Math.min(x0, ax); y0 = Math.min(y0, ay); x1 = Math.max(x1, bx); y1 = Math.max(y1, by);
  };
  const tw = (s: string, perChar: number) => s.length * perChar + 3;

  // axes + arrowheads
  add(yAxisX - 1, dim.marginTop - ARROW_EXT - 1, yAxisX + 5, dim.marginTop + dim.plotHeight);
  add(dim.marginLeft, xAxisY - 5, dim.marginLeft + dim.plotWidth + ARROW_EXT + 9, xAxisY + 5);

  // tick numbers
  for (const t of config.hide_numbers ? [] : generateTicks(config.x_min, config.x_max, 5, config.x_tick_step)) {
    if (isTickHidden(config.hidden_x_ticks, t.value)) continue;
    const px = dim.marginLeft + (t.value - config.x_min) * scale.xScale;
    const w = tw(t.label, 6.8);
    add(px - w / 2, xAxisY, px + w / 2, xAxisY + 21);
  }
  for (const t of config.hide_numbers ? [] : generateTicks(config.y_min, config.y_max, 5, config.y_tick_step)) {
    if (isTickHidden(config.hidden_y_ticks, t.value)) continue;
    const py = dim.marginTop + (config.y_max - t.value) * scale.yScale;
    add(yAxisX - 8 - tw(t.label, 6.8), py - 7, yAxisX, py + 7);
  }

  for (const sr of config.series) {
    for (const p of sr.data_points) {
      const px = dim.marginLeft + (p.x - config.x_min) * scale.xScale;
      const py = dim.marginTop + (config.y_max - p.y) * scale.yScale;
      if (p.x_name) { const w = tw(p.x_name.replace(/[_{}]/g, ''), 7.6); add(px - w / 2, xAxisY, px + w / 2, xAxisY + 24); }
      if (p.y_name) add(yAxisX - 8 - tw(p.y_name.replace(/[_{}]/g, ''), 7.6), py - 9, yAxisX, py + 9);
    }
  }

  // axis labels (bold 12px; x is vertically centred, y sits on its baseline)
  add(xPos.x, xPos.y - 8, xPos.x + tw(config.x_label, 7.6), xPos.y + 8);
  add(yPos.x, yPos.y - 12, yPos.x + tw(config.y_label, 7.6), yPos.y + 4);

  for (const t of config.texts ?? []) {
    const px = dim.marginLeft + (t.x - config.x_min) * scale.xScale;
    const py = dim.marginTop + (config.y_max - t.y) * scale.yScale;
    add(px, py - 8, px + tw(t.text, 6.8), py + 8);
  }

  return { x: x0 - CROP_PAD, y: y0 - CROP_PAD, w: x1 - x0 + 2 * CROP_PAD, h: y1 - y0 + 2 * CROP_PAD };
}

export function generateGraphSVG(config: GraphConfig, forExport = false, skipLabels = false): string {
  const dim = getGraphDimensions(config);
  const scale = getScaleInfo(config, dim);

  const xTicks = generateTicks(config.x_min, config.x_max, 5, config.x_tick_step);
  const yTicks = generateTicks(config.y_min, config.y_max, 5, config.y_tick_step);

  const xRange = config.x_max - config.x_min;
  const yRange = config.y_max - config.y_min;

  const xOriginPx = dim.marginLeft + ((0 - config.x_min) / xRange) * dim.plotWidth;
  const yOriginPx = dim.marginTop + ((config.y_max - 0) / yRange) * dim.plotHeight;

  const xAxisY = Math.min(Math.max(yOriginPx, dim.marginTop), dim.marginTop + dim.plotHeight);
  const yAxisX = Math.min(Math.max(xOriginPx, dim.marginLeft), dim.marginLeft + dim.plotWidth);

  const b = getContentBounds(config);
  const sizeAttrs = forExport ? `width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" ` : '';
  const lines: string[] = [];

  lines.push(
    `<svg ${sizeAttrs}viewBox="${b.x.toFixed(1)} ${b.y.toFixed(1)} ${b.w.toFixed(1)} ${b.h.toFixed(1)}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;background:white;overflow:visible;">`
  );

  // ── Defs ─────────────────────────────────────────────────────────────────
  lines.push(
    `<defs>` +
    `<clipPath id="plot-area"><rect x="${dim.marginLeft - CLIP_PAD}" y="${dim.marginTop - CLIP_PAD}" width="${dim.plotWidth + 2 * CLIP_PAD}" height="${dim.plotHeight + 2 * CLIP_PAD}"/></clipPath>` +
    `<marker id="arr" markerWidth="9" markerHeight="7" refX="9" refY="3.5" orient="auto">` +
    `<path d="M 0 0 L 9 3.5 L 0 7 Z" fill="#2c2c2c"/>` +
    `</marker>` +
    `</defs>`
  );

  // ── Grid lines ────────────────────────────────────────────────────────────
  lines.push('<g stroke="#d4d4d4" stroke-width="1">');
  for (const tick of config.hide_grid ? [] : xTicks) {
    const px = dim.marginLeft + (tick.value - config.x_min) * scale.xScale;
    if (px > dim.marginLeft + 0.5 && px < dim.marginLeft + dim.plotWidth - 0.5)
      lines.push(`<line x1="${px.toFixed(1)}" y1="${dim.marginTop}" x2="${px.toFixed(1)}" y2="${dim.marginTop + dim.plotHeight}"/>`);
  }
  for (const tick of config.hide_grid ? [] : yTicks) {
    const py = dim.marginTop + (config.y_max - tick.value) * scale.yScale;
    if (py > dim.marginTop + 0.5 && py < dim.marginTop + dim.plotHeight - 0.5)
      lines.push(`<line x1="${dim.marginLeft}" y1="${py.toFixed(1)}" x2="${dim.marginLeft + dim.plotWidth}" y2="${py.toFixed(1)}"/>`);
  }
  lines.push('</g>');

  // ── Axes as rays with arrowheads ──────────────────────────────────────────
  lines.push('<g stroke="#2c2c2c" stroke-width="1.5" stroke-linecap="round">');
  lines.push(
    `<line x1="${dim.marginLeft}" y1="${xAxisY.toFixed(1)}" ` +
    `x2="${(dim.marginLeft + dim.plotWidth + ARROW_EXT).toFixed(1)}" y2="${xAxisY.toFixed(1)}" ` +
    `marker-end="url(#arr)"/>`
  );
  lines.push(
    `<line x1="${yAxisX.toFixed(1)}" y1="${(dim.marginTop + dim.plotHeight).toFixed(1)}" ` +
    `x2="${yAxisX.toFixed(1)}" y2="${(dim.marginTop - ARROW_EXT).toFixed(1)}" ` +
    `marker-end="url(#arr)"/>`
  );
  lines.push('</g>');

  // ── Tick marks + labels ───────────────────────────────────────────────────
  lines.push('<g font-family="Inter, system-ui, sans-serif" font-size="11" fill="#2c2c2c" text-anchor="middle">');
  for (const tick of config.hide_numbers ? [] : xTicks) {
    const px = dim.marginLeft + (tick.value - config.x_min) * scale.xScale;
    lines.push(`<line x1="${px.toFixed(1)}" y1="${xAxisY.toFixed(1)}" x2="${px.toFixed(1)}" y2="${(xAxisY + 5).toFixed(1)}" stroke="#2c2c2c" stroke-width="1"/>`);
    if (!isTickHidden(config.hidden_x_ticks, tick.value))
      lines.push(`<text x="${px.toFixed(1)}" y="${(xAxisY + 16).toFixed(1)}">${tick.label}</text>`);
  }
  lines.push('</g>');

  lines.push('<g font-family="Inter, system-ui, sans-serif" font-size="11" fill="#2c2c2c" text-anchor="end">');
  for (const tick of config.hide_numbers ? [] : yTicks) {
    const py = dim.marginTop + (config.y_max - tick.value) * scale.yScale;
    lines.push(`<line x1="${(yAxisX - 5).toFixed(1)}" y1="${py.toFixed(1)}" x2="${yAxisX.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#2c2c2c" stroke-width="1"/>`);
    if (!isTickHidden(config.hidden_y_ticks, tick.value))
      lines.push(`<text x="${(yAxisX - 8).toFixed(1)}" y="${py.toFixed(1)}" dominant-baseline="central">${tick.label}</text>`);
  }
  lines.push('</g>');

  // ── Axis labels ───────────────────────────────────────────────────────────
  if (!skipLabels) {
    const defaults = getDefaultLabelPositions(config);
    const xPos = config.x_label_pos ?? defaults.xLabel;
    const yPos = config.y_label_pos ?? defaults.yLabel;
    lines.push(
      `<text x="${xPos.x.toFixed(1)}" y="${xPos.y.toFixed(1)}" ` +
      `font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600" ` +
      `fill="#2c2c2c" dominant-baseline="central">${escapeXml(config.x_label)}</text>`
    );
    lines.push(
      `<text x="${yPos.x.toFixed(1)}" y="${yPos.y.toFixed(1)}" ` +
      `font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="600" ` +
      `fill="#2c2c2c" dominant-baseline="auto">${escapeXml(config.y_label)}</text>`
    );
  }

  // ── Data: one group per series ────────────────────────────────────────────
  for (const series of config.series) {
    if (series.data_points.length === 0) continue;

    lines.push('<g clip-path="url(#plot-area)">');

    if (series.data_points.length > 1) {
      const { solid, dashed } = buildSeriesPaths(series, config, dim, scale);
      for (const d of solid) {
        lines.push(`<path d="${d}" fill="none" stroke="${series.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`);
      }
      for (const d of dashed) {
        lines.push(`<path d="${d}" fill="none" stroke="${series.color}" stroke-width="2.5" stroke-dasharray="6 5" stroke-linecap="butt"/>`);
      }
    }

    // dashed projections + symbolic names on the axes
    for (const p of series.data_points) {
      const c = dataToPixel(p, config, dim, scale);
      const dash = `stroke="${series.color}" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.85"`;
      if (p.x_name) lines.push(`<line x1="${c.px.toFixed(2)}" y1="${c.py.toFixed(2)}" x2="${c.px.toFixed(2)}" y2="${xAxisY.toFixed(2)}" ${dash}/>`);
      if (p.y_name) lines.push(`<line x1="${c.px.toFixed(2)}" y1="${c.py.toFixed(2)}" x2="${yAxisX.toFixed(2)}" y2="${c.py.toFixed(2)}" ${dash}/>`);
    }

    lines.push(`<g fill="${series.color}">`);
    for (const p of series.data_points) {
      const c = dataToPixel(p, config, dim, scale);
      lines.push(`<circle cx="${c.px.toFixed(2)}" cy="${c.py.toFixed(2)}" r="3.5"/>`);
    }
    lines.push('</g>');
    lines.push('</g>');
  }

  // ── Symbolic point names on the axes ─────────────────────────────────────
  for (const series of config.series) {
    for (const p of series.data_points) {
      const c = dataToPixel(p, config, dim, scale);
      if (p.x_name)
        lines.push(`<text x="${c.px.toFixed(1)}" y="${(xAxisY + 17).toFixed(1)}" font-family="Inter, system-ui, sans-serif" font-size="12" font-style="italic" fill="#2c2c2c" text-anchor="middle">${richText(p.x_name)}</text>`);
      if (p.y_name)
        lines.push(`<text x="${(yAxisX - 8).toFixed(1)}" y="${c.py.toFixed(1)}" font-family="Inter, system-ui, sans-serif" font-size="12" font-style="italic" fill="#2c2c2c" text-anchor="end" dominant-baseline="central">${richText(p.y_name)}</text>`);
    }
  }

  // ── Text notes ────────────────────────────────────────────────────────────
  if (!skipLabels && config.texts?.length) {
    lines.push('<g font-family="Inter, system-ui, sans-serif" font-size="12" fill="#2c2c2c">');
    for (const t of config.texts) {
      const c = dataToPixel({ id: t.id, x: t.x, y: t.y }, config, dim, scale);
      lines.push(`<text x="${c.px.toFixed(1)}" y="${c.py.toFixed(1)}" dominant-baseline="central">${escapeXml(t.text)}</text>`);
    }
    lines.push('</g>');
  }

  // ── Dashed helper lines (free-form, not data) ────────────────────────────
  if (config.guides?.length) {
    lines.push('<g clip-path="url(#plot-area)" stroke="#444" stroke-width="1.5" stroke-dasharray="6 4" stroke-linecap="butt">');
    for (const g of config.guides) {
      const a = dataToPixel({ id: '', x: g.x1, y: g.y1 }, config, dim, scale);
      const b = dataToPixel({ id: '', x: g.x2, y: g.y2 }, config, dim, scale);
      lines.push(`<line x1="${a.px.toFixed(2)}" y1="${a.py.toFixed(2)}" x2="${b.px.toFixed(2)}" y2="${b.py.toFixed(2)}"/>`);
    }
    lines.push('</g>');
  }

  lines.push('</svg>');
  return lines.join('\n');
}

export async function svgToPng(svgString: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png');
    };
    img.onerror = () => reject(new Error('SVG image load failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
  });
}

export function downloadPng(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
