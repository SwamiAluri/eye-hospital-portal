'use client';

import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import type { RefObject } from 'react';
import type { CounsellingSession, WaitingListStatus } from '@/types/counsellors-desk';
import { getStatusBadge } from '@/lib/counsellors-desk/session-utils';

interface SessionPageHeaderProps {
  session: CounsellingSession;
  queueStatus: WaitingListStatus;
  isDirty: boolean;
  historyBtnRef: RefObject<HTMLButtonElement | null>;
  onBack: () => void;
  onOpenHistory: () => void;
}

export function SessionPageHeader({
  session,
  queueStatus,
  isDirty,
  historyBtnRef,
  onBack,
  onOpenHistory,
}: SessionPageHeaderProps) {
  const statusBadge = getStatusBadge(queueStatus);

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 mb-4 shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-white/80 hover:text-white transition-colors flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="w-px h-6 bg-white/30" />
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-sm">
            {session.patientName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-semibold text-lg">{session.patientName}</h1>
              {isDirty && (
                <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs rounded-full font-medium">Unsaved</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-blue-100 text-xs">{session.age} yrs · {session.gender}</span>
              <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs font-mono">{session.uhid}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusBadge.cls}`}>
                {statusBadge.label}
              </span>
              <span className="text-white/70 text-xs">🔒 You</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5 text-blue-100 text-xs">
            <Calendar className="h-3.5 w-3.5" />
            Visit: {new Date(session.visitDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          <button
            ref={historyBtnRef}
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/15 hover:bg-white/25 text-white text-xs rounded-lg transition-colors"
          >
            <Clock className="h-3.5 w-3.5" />
            View History
          </button>
        </div>
      </div>
    </div>
  );
}
