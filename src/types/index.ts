export interface DataPoint {
  id: string;
  x: number;
  y: number;
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

export interface GraphConfig {
  id?: string;
  name?: string;
  width_cm: number;
  height_cm: number;
  x_label: string;
  y_label: string;
  x_label_pos?: LabelPos;
  y_label_pos?: LabelPos;
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
  x_tick_step?: number;
  y_tick_step?: number;
  series: Series[];
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
