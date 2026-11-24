export interface DataPoint {
  id: string;
  x: number;
  y: number;
  x_name?: string; // symbolic label on the x axis (e.g. "t_1"), draws a dashed projection
  y_name?: string; // symbolic label on the y axis (e.g. "s_k")
}

export const SERIES_COLORS = ['#0a2e0e', '#1e40af', '#b91c1c', '#7c3aed', '#b45309'];

export interface Series {
  id: string;
  name: string;
  color: string;
  smooth: boolean;
  data_points: DataPoint[];
}

export interface LabelPos { x: number; y: number; }

export type GridMode = 'both' | 'vertical' | 'horizontal' | 'none';

export interface Guide { id: string; x1: number; y1: number; x2: number; y2: number; }

export interface TextNote { id: string; text: string; x: number; y: number; }

export interface GraphConfig {
  id?: string;
  name?: string;
  width_cm: number;
  height_cm: number;
  x_label: string;
  y_label: string;
  x_label_offset?: LabelPos; // offset from the default spot next to the axis arrow, so labels stay attached on resize
  y_label_offset?: LabelPos;
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
  x_tick_step?: number;
  y_tick_step?: number;
  hidden_x_ticks?: number[];
  hidden_y_ticks?: number[];
  series: Series[];
  texts?: TextNote[];
  guides?: Guide[];
  hide_numbers?: boolean; // legacy: both axes
  hide_x_numbers?: boolean;
  hide_y_numbers?: boolean;
  hide_grid?: boolean;
  grid_mode?: GridMode;
}

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  width_cm: 10,
  height_cm: 10,
  x_label: 'X os',
  y_label: 'Y os',
  x_min: 0,
  x_max: 10,
  y_min: 0,
  y_max: 10,
  series: [{
    id: '1',
    name: 'Serija 1',
    color: SERIES_COLORS[0],
    smooth: false,
    data_points: [],
  }],
};
