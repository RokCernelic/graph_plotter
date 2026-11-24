import { DataPoint, GraphConfig, Series } from '@/types';

export const CM_TO_PX = 37.8; // 1 cm ≈ 37.8 pixels at 96 DPI

export function cmToPx(cm: number): number {
  return cm * CM_TO_PX;
}

export function pxToCm(px: number): number {
  return px / CM_TO_PX;
}

export interface GraphDimensions {
  svgWidth: number;
  svgHeight: number;
  plotWidth: number;
  plotHeight: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
}

export function getGraphDimensions(config: GraphConfig): GraphDimensions {
  const svgWidth = cmToPx(config.width_cm);
  const svgHeight = cmToPx(config.height_cm);

  // Fixed pixel margins — sized for arrows + horizontal axis labels
  const marginTop = 48;
  const marginRight = 100;
  const marginBottom = 36;
  const marginLeft = 44;

  const plotWidth = Math.max(40, svgWidth - marginLeft - marginRight);
  const plotHeight = Math.max(40, svgHeight - marginTop - marginBottom);

  return { svgWidth, svgHeight, plotWidth, plotHeight, marginTop, marginRight, marginBottom, marginLeft };
}

export interface ScaleInfo {
  xScale: number;
  yScale: number;
}

export function getScaleInfo(config: GraphConfig, dim: GraphDimensions): ScaleInfo {
  const xRange = config.x_max - config.x_min;
  const yRange = config.y_max - config.y_min;
  return {
    xScale: dim.plotWidth / xRange,
    yScale: dim.plotHeight / yRange,
  };
}

export interface PixelCoords {
  px: number;
  py: number;
}

export function dataToPixel(
  point: DataPoint,
  config: GraphConfig,
  dim: GraphDimensions,
  scale: ScaleInfo
): PixelCoords {
  return {
    px: dim.marginLeft + (point.x - config.x_min) * scale.xScale,
    py: dim.marginTop + (config.y_max - point.y) * scale.yScale,
  };
}

export function getGridMode(config: GraphConfig): 'both' | 'vertical' | 'horizontal' | 'none' {
  return config.grid_mode ?? (config.hide_grid ? 'none' : 'both');
}

export interface TickInfo {
  value: number;
  label: string;
}

export function generateTicks(min: number, max: number, maxTicks: number = 5, customStep?: number): TickInfo[] {
  const range = max - min;
  if (range <= 0) return [{ value: min, label: String(min) }];

  let step: number;
  if (customStep && customStep > 0 && range / customStep <= 200) {
    step = customStep;
  } else {
    step = Math.pow(10, Math.floor(Math.log10(range)));
    if (range / step < maxTicks) step = range / maxTicks;
  }

  const ticks: TickInfo[] = [];
  let current = Math.ceil(min / step) * step;

  while (current <= max + step * 0.001) {
    if (current >= min - step * 0.001) {
      const rounded = Math.round(current * 1000000) / 1000000;
      ticks.push({
        value: rounded,
        label: rounded === Math.round(rounded) ? String(Math.round(rounded)) : String(rounded),
      });
    }
    current += step;
  }

  return ticks.length > 0 ? ticks : [{ value: min, label: String(min) }, { value: max, label: String(max) }];
}

function niceBound(value: number, range: number, direction: 'floor' | 'ceil'): number {
  const mag = range > 0 ? Math.pow(10, Math.floor(Math.log10(range))) : 1;
  const padded = direction === 'floor' ? value - range * 0.15 : value + range * 0.15;
  const result = direction === 'floor'
    ? Math.floor(padded / mag) * mag
    : Math.ceil(padded / mag) * mag;
  return direction === 'floor' ? Math.min(result, value) : Math.max(result, value);
}

export function autoFitAxes(seriesArray: Series[]): Partial<GraphConfig> {
  const allPoints = seriesArray.flatMap(s => s.data_points);
  if (allPoints.length === 0) return {};

  const xs = allPoints.map(p => p.x);
  const ys = allPoints.map(p => p.y);

  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  const xRange = xMax - xMin || 2;
  const yRange = yMax - yMin || 2;

  return {
    x_min: niceBound(xMin, xRange, 'floor'),
    x_max: niceBound(xMax, xRange, 'ceil'),
    y_min: niceBound(yMin, yRange, 'floor'),
    y_max: niceBound(yMax, yRange, 'ceil'),
  };
}
