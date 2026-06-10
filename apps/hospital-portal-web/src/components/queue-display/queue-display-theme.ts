import type { QueueDisplayPatient } from '@/lib/api/queue-display.api';

/** Single restrained brand accent — all stations share emerald; labels differentiate stations. */
export interface StationTheme {
  accent: string;
  stripe: string;
  proceedText: string;
  pillActive: string;
  pillInactive: string;
}

export const BRAND_THEME: StationTheme = {
  accent: '#059669',
  stripe: '#10b981',
  proceedText: '#047857',
  pillActive: 'bg-emerald-600 text-white border-emerald-600',
  pillInactive: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function getStationTheme(_station?: string): StationTheme {
  return BRAND_THEME;
}

const GENERIC_STAFF = new Set([
  'system administrator',
  'administrator',
  'optometrist',
  'doctor',
  'admin',
]);

export function sanitizeStaffName(name?: string | null): string | undefined {
  if (!name?.trim()) return undefined;
  const normalized = name.trim().toLowerCase();
  if (GENERIC_STAFF.has(normalized)) return undefined;
  return name.trim();
}

export function proceedLabelTe(displayLabel: string, displayLabelTe?: string): string {
  const room = displayLabelTe || displayLabel;
  return `దయచేసి ${room} గదికి వెళ్లండి`;
}

export function splitToken(token: string): { prefix: string; suffix: string; hasStructured: boolean } {
  const parts = token.split('-');
  if (parts.length >= 2) {
    return {
      prefix: parts.slice(0, -1).join('-') + '-',
      suffix: parts[parts.length - 1],
      hasStructured: true,
    };
  }
  return { prefix: '', suffix: token, hasStructured: false };
}

export function urgencyBadgeClass(urgency: string, size: 'sm' | 'md' = 'md'): string {
  const base = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-3 py-1';
  if (urgency === 'Emergency') {
    return `${base} rounded-full font-bold uppercase bg-red-600 text-white ring-2 ring-red-400/50 animate-pulse`;
  }
  if (urgency === 'Urgent') {
    return `${base} rounded-full font-bold uppercase bg-amber-500 text-white`;
  }
  return `${base} rounded-full font-medium bg-slate-100 text-slate-600`;
}

export function emptyNextPlaceholder(): QueueDisplayPatient {
  return {
    tokenNumber: '—',
    patientName: '',
    gender: '',
    ageCategory: '',
    urgency: 'Routine',
    isReturnVisit: false,
    passNumber: 1,
  };
}

export const DEFAULT_TICKER = [
  {
    en: 'Please keep your token with you and listen for your name.',
    te: 'దయచేసి మీ టోకెన్‌ను దగ్గర ఉంచుకోండి.',
  },
];

export const NEXT_QUEUE_MAX = 4;
