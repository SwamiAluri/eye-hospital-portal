'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { VaSectionId } from '@/lib/optometry/visual-acuity-constants';

function formatExamDate(d: unknown): string {
  if (!d) return '—';
  try {
    return new Date(String(d)).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return String(d);
  }
}

function formatRxFromRecord(rec: Record<string, unknown>, eye: 'OD' | 'OS'): string | null {
  const finalRx = rec.finalRx as Record<string, Record<string, unknown>> | undefined;
  const startingRx = rec.startingRx as Record<string, Record<string, unknown>> | undefined;
  const eyeData = finalRx?.[eye] ?? startingRx?.[eye];
  if (!eyeData) return null;
  const s = eyeData.sphere ?? '';
  const c = eyeData.cylinder ?? '';
  const a = eyeData.axis ?? '';
  if (!s && !c && !a) return null;
  return `${s}/${c}×${a}`;
}

function formatVaFromRecord(rec: Record<string, unknown>, eye: 'OD' | 'OS'): string | null {
  const dist = (rec.distanceVA ?? rec.distance) as
    | Record<string, { unaided?: string; aided?: string }>
    | undefined;
  const eyeData = dist?.[eye];
  if (!eyeData) return null;
  const parts = [eyeData.unaided, eyeData.aided].filter(Boolean);
  return parts.length ? parts.join(' → ') : null;
}

interface VaSectionHistoryPanelProps {
  sectionId: VaSectionId;
  vaHistory?: unknown[];
  refHistory?: unknown[];
  maxItems?: number;
}

export function VaSectionHistoryPanel({
  sectionId,
  vaHistory = [],
  refHistory = [],
  maxItems = 3,
}: VaSectionHistoryPanelProps) {
  const [open, setOpen] = useState(false);

  const rxSections: VaSectionId[] = ['old', 'new', 'refraction'];
  const useRef = rxSections.includes(sectionId);
  const useVa = sectionId === 'distance' || sectionId === 'old' || sectionId === 'new';

  const refList = (Array.isArray(refHistory) ? refHistory : []) as Record<string, unknown>[];
  const vaList = (Array.isArray(vaHistory) ? vaHistory : []) as Record<string, unknown>[];

  const source = useRef && refList.length > 0 ? refList : useVa ? vaList : [];
  if (source.length === 0) return null;

  const sorted = [...source].sort((a, b) => {
    const da = new Date(String(a.examinationDate ?? 0)).getTime();
    const db = new Date(String(b.examinationDate ?? 0)).getTime();
    return db - da;
  });

  const totalCount = sorted.length;
  const items = sorted.slice(0, maxItems);

  const renderRow = (rec: Record<string, unknown>) => {
    const date = formatExamDate(rec.examinationDate);
    if (sectionId === 'distance') {
      const od = formatVaFromRecord(rec, 'OD');
      const os = formatVaFromRecord(rec, 'OS');
      return (
        <li key={String(rec.id ?? date)} className="py-1.5 border-b border-slate-100 last:border-0">
          <span className="font-medium text-slate-800">{date}</span>
          <span className="block text-[11px] font-mono text-slate-600 mt-0.5">
            {od && `OD ${od}`}
            {od && os && ' · '}
            {os && `OS ${os}`}
          </span>
        </li>
      );
    }
    const od = formatRxFromRecord(rec, 'OD');
    const os = formatRxFromRecord(rec, 'OS');
    return (
      <li key={String(rec.id ?? date)} className="py-1.5 border-b border-slate-100 last:border-0">
        <span className="font-medium text-slate-800">{date}</span>
        <span className="block text-[11px] font-mono text-slate-600 mt-0.5">
          {od && `OD ${od}`}
          {od && os && ' · '}
          {os && `OS ${os}`}
        </span>
      </li>
    );
  };

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-emerald-800 min-h-[44px] lg:min-h-0"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        View history ({totalCount} visit{totalCount === 1 ? '' : 's'}, showing {items.length})
      </button>
      {open && (
        <ul className="mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
          {items.map((rec) => renderRow(rec))}
        </ul>
      )}
    </div>
  );
}
