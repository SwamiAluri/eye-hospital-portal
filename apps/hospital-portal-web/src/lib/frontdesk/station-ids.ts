/** @deprecated Use `useFrontdeskRoutingStations()` — labels come from `operations.station` master. */
export const ROUTING_STATIONS = [
  { value: 'optometrist', label: 'Optometry' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'counselor', label: 'Counselor' },
] as const;

export type RoutingStationId = string;

const STATION_LABELS: Record<string, string> = {
  reception: 'Reception',
  optometrist: 'Optometry',
  optometry: 'Optometry',
  doctor: 'Doctor',
  counselor: 'Counselor',
  counsellor: 'Counselor',
  counselling: 'Counselor',
  imaging: 'Imaging',
  billing: 'Billing',
  pharmacy: 'Pharmacy',
  optical: 'Optical',
  completed: 'Completed',
};

/** Map UI / legacy aliases to canonical backend station IDs. */
export function normalizeStationId(station: string): string {
  const s = station.trim().toLowerCase();
  switch (s) {
    case 'optometry':
      return 'optometrist';
    case 'counselling':
    case 'counsellor':
      return 'counselor';
    default:
      return s;
  }
}

export function stationDisplayLabel(
  station?: string | null,
  masterLabels?: Record<string, string>,
): string {
  if (!station) return 'Reception';
  const key = station.trim().toLowerCase();
  if (masterLabels?.[key]) return masterLabels[key];
  return STATION_LABELS[key] ?? station;
}

/** Build a code → label map from master station options. */
export function stationLabelMap(
  stations: Array<{ value: string; label: string }>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of stations) {
    map[s.value.toLowerCase()] = s.label;
  }
  return map;
}

/** Map queue-management card types to backend station IDs. */
export function queueTypeToStation(queueType: 'Optometry' | 'Doctor' | 'Billing' | 'Pharmacy'): string {
  switch (queueType) {
    case 'Optometry':
      return 'optometrist';
    case 'Doctor':
      return 'doctor';
    case 'Billing':
      return 'billing';
    case 'Pharmacy':
      return 'pharmacy';
    default:
      return queueType.toLowerCase();
  }
}
