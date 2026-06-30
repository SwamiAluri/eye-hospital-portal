export type ChartWidgetId =
  | 'medical_history'
  | 'vitals'
  | 'documents'
  | 'forms'
  | 'activity'
  | 'ccm_goals'
  | 'ccm_quality';

export type ChartWidgetConfig = {
  id: ChartWidgetId;
  label: string;
  visible: boolean;
  order: number;
};

export type ChartLayoutConfig = {
  widgets: ChartWidgetConfig[];
};

export const DEFAULT_CHART_LAYOUT: ChartLayoutConfig = {
  widgets: [
    { id: 'medical_history', label: 'Medical history', visible: true, order: 0 },
    { id: 'vitals', label: 'Latest vitals', visible: true, order: 1 },
    { id: 'documents', label: 'Files & documents', visible: true, order: 2 },
    { id: 'forms', label: 'Forms', visible: true, order: 3 },
    { id: 'activity', label: 'Activity', visible: true, order: 4 },
    { id: 'ccm_goals', label: 'Care goals', visible: true, order: 5 },
    { id: 'ccm_quality', label: 'Quality measures', visible: true, order: 6 },
  ],
};

const LOCAL_KEY = 'patient_chart_layout_v1';

export function parseChartLayout(json: string | null | undefined): ChartLayoutConfig {
  if (!json?.trim()) return DEFAULT_CHART_LAYOUT;
  try {
    const parsed = JSON.parse(json) as ChartLayoutConfig;
    if (!parsed?.widgets?.length) return DEFAULT_CHART_LAYOUT;
    return {
      widgets: parsed.widgets
        .map((w, i) => ({
          id: w.id,
          label:
            DEFAULT_CHART_LAYOUT.widgets.find((d) => d.id === w.id)?.label ?? w.id,
          visible: w.visible !== false,
          order: typeof w.order === 'number' ? w.order : i,
        }))
        .sort((a, b) => a.order - b.order),
    };
  } catch {
    return DEFAULT_CHART_LAYOUT;
  }
}

export function readLocalChartLayout(): ChartLayoutConfig {
  if (typeof window === 'undefined') return DEFAULT_CHART_LAYOUT;
  return parseChartLayout(localStorage.getItem(LOCAL_KEY));
}

export function writeLocalChartLayout(config: ChartLayoutConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(config));
}

export function serializeChartLayout(config: ChartLayoutConfig): string {
  return JSON.stringify(config);
}
