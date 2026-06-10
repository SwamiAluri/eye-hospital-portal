'use client';

import { ArrowRight } from 'lucide-react';
import { BRAND_THEME, proceedLabelTe, sanitizeStaffName } from './queue-display-theme';

interface ProceedCalloutProps {
  station: string;
  displayLabel: string;
  displayLabelTe?: string;
  roomCode: string;
  staffName?: string;
  visible: boolean;
}

export default function ProceedCallout({
  displayLabel,
  displayLabelTe,
  roomCode,
  staffName,
  visible,
}: ProceedCalloutProps) {
  if (!visible) return null;

  const roomLabel = displayLabel || `Room ${roomCode}`;
  const staff = sanitizeStaffName(staffName);

  return (
    <div
      className="rounded-2xl px-5 py-4 flex items-center gap-4 border border-slate-200 bg-white shadow-sm"
      style={{ borderLeftWidth: 5, borderLeftColor: BRAND_THEME.stripe }}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white">
        <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg lg:text-xl font-bold text-emerald-800">
          Please proceed to {roomLabel}
        </p>
        <p className="text-sm lg:text-base text-slate-600 mt-0.5">
          {proceedLabelTe(roomLabel, displayLabelTe)}
        </p>
        {staff && <p className="text-sm text-slate-500 mt-1">With: {staff}</p>}
      </div>
    </div>
  );
}
