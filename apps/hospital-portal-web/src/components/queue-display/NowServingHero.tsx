'use client';

import type { QueueDisplayPatient } from '@/lib/api/queue-display.api';
import { BRAND_THEME, splitToken, urgencyBadgeClass } from './queue-display-theme';

interface NowServingHeroProps {
  station: string;
  stationLabel: string;
  displayLabel: string;
  nowServing: QueueDisplayPatient | null;
}

function TokenHero({ token }: { token: string }) {
  const { prefix, suffix, hasStructured } = splitToken(token);

  return (
    <div className="relative rounded-2xl px-6 py-8 text-center bg-slate-50/80">
      {hasStructured ? (
        <>
          <div className="queue-tv-token-prefix text-slate-500 font-mono tabular-nums">{prefix}</div>
          <div className="queue-tv-token-suffix font-mono tabular-nums font-black text-slate-900">
            {suffix}
          </div>
        </>
      ) : (
        <div className="queue-tv-token-suffix font-mono tabular-nums font-black text-slate-900">{token}</div>
      )}
    </div>
  );
}

export default function NowServingHero({
  stationLabel,
  displayLabel,
  nowServing,
}: NowServingHeroProps) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="mb-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Now Serving</p>
        <p className="text-xl lg:text-2xl font-bold text-slate-800 mt-1">{stationLabel}</p>
        <p className="text-base text-slate-500">{displayLabel}</p>
      </div>

      <div
        className="flex-1 flex flex-col bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden min-h-[280px]"
        style={{ borderLeftWidth: 6, borderLeftColor: BRAND_THEME.stripe }}
      >
        {nowServing ? (
          <div className="flex flex-col flex-1 p-5 lg:p-6 justify-center">
            <TokenHero token={nowServing.tokenNumber} />
            <div className="mt-4 text-center">
              <p className="queue-tv-name font-semibold text-slate-900 leading-snug">{nowServing.patientName}</p>
              <p className="text-base lg:text-lg text-slate-500 mt-1">
                {nowServing.gender} · {nowServing.ageCategory}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {nowServing.urgency !== 'Routine' && (
                  <span className={urgencyBadgeClass(nowServing.urgency, 'md')}>{nowServing.urgency}</span>
                )}
                {nowServing.isReturnVisit && (
                  <span className="text-xs px-3 py-1 rounded-full font-bold bg-teal-100 text-teal-800">
                    Pass {nowServing.passNumber}
                    {nowServing.reasonLabel ? ` · ${nowServing.reasonLabel}` : ''}
                  </span>
                )}
                {!nowServing.isReturnVisit && nowServing.reasonLabel && (
                  <span className="text-xs px-3 py-1 rounded-full font-bold uppercase bg-slate-100 text-slate-700">
                    {nowServing.reasonLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="text-center">
              <div className="text-6xl font-light text-slate-300 mb-2">—</div>
              <p className="text-slate-500 text-lg">Waiting for next patient</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
