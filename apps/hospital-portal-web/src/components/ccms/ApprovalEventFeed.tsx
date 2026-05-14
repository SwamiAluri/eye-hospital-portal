'use client';

import React from 'react';
import type { ApprovalEvent } from '../../lib/api/ccms/ccms-approvals.api';

interface Props {
  events: ApprovalEvent[];
  isLoading?: boolean;
}

const EVENT_COLORS: Record<string, string> = {
  PreAuthRequested:    'bg-blue-100 text-blue-700',
  PreAuthSubmitted:    'bg-indigo-100 text-indigo-700',
  TpaApproved:         'bg-green-100 text-green-700',
  TpaPartialApproval:  'bg-teal-100 text-teal-700',
  TpaRejected:         'bg-red-100 text-red-700',
  TpaQueryRaised:      'bg-yellow-100 text-yellow-700',
  EnhancementRequested:'bg-orange-100 text-orange-700',
  ClaimSubmitted:      'bg-purple-100 text-purple-700',
  SettlementReceived:  'bg-emerald-100 text-emerald-700',
};

export function ApprovalEventFeed({ events, isLoading }: Props) {
  if (isLoading) {
    return <p className="text-xs text-gray-400 animate-pulse py-4 text-center">Loading events…</p>;
  }

  if (!events.length) {
    return <p className="text-xs text-gray-400 py-4 text-center">No events recorded yet.</p>;
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {[...events].reverse().map(ev => {
        const colorClass = EVENT_COLORS[ev.eventType] ?? 'bg-gray-100 text-gray-600';
        return (
          <div key={ev.id} className="flex gap-3 items-start">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap mt-0.5 ${colorClass}`}>
              {ev.eventType}
            </span>
            <div className="flex-1 min-w-0">
              {ev.notes && <p className="text-[11px] text-gray-600 truncate">{ev.notes}</p>}
              <p className="text-[10px] text-gray-400">
                {new Date(ev.occurredAt).toLocaleString('en-IN')}
                {ev.performedBy && ` · ${ev.performedBy}`}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
