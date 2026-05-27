import { GraphConfig } from '@/types';

const STORAGE_KEY = 'graph_plotter_saved_graphs';

export function getSavedGraphs(): Record<string, GraphConfig> {
  if (typeof window === 'undefined') return {};

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function saveGraph(name: string, config: GraphConfig): void {
  if (typeof window === 'undefined') return;

  try {
    const graphs = getSavedGraphs();
    graphs[name] = { ...config, id: name, name };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(graphs));
  } catch {
    console.error('Failed to save graph');
  }
}

export function deleteGraph(name: string): void {
  if (typeof window === 'undefined') return;

  try {
    const graphs = getSavedGraphs();
    delete graphs[name];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(graphs));
  } catch {
    console.error('Failed to delete graph');
  }
}

export function getGraphNames(): string[] {
  const graphs = getSavedGraphs();
  return Object.keys(graphs);
}
