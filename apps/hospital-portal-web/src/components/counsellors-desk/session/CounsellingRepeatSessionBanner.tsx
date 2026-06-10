'use client';

import { RefreshCw } from 'lucide-react';
import { SessionTypeSelect } from '@/components/counsellors-desk/SessionTypeSelect';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives';

export interface CounsellingRepeatSessionBannerProps {
  sessionTypeCode: string;
  onSessionTypeChange: (code: string) => void;
  onStartSession: () => void;
}

export function CounsellingRepeatSessionBanner({
  sessionTypeCode,
  onSessionTypeChange,
  onStartSession,
}: CounsellingRepeatSessionBannerProps) {
  const canStart = sessionTypeCode.trim().length > 0;

  return (
    <div
      className="flex-shrink-0 border-b border-orange-200/80 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-4 sm:px-5"
      data-testid="counselling-repeat-session-banner"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
            <RefreshCw className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-orange-900">Repeat counselling required</h2>
            <p className="mt-1 text-xs leading-relaxed text-orange-800/90">
              Patient needs more time before deciding. Choose the session type for this round, then
              click <strong>Start Session</strong> to continue.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end">
          <SessionTypeSelect
            id="repeat-session-type"
            value={sessionTypeCode}
            onChange={onSessionTypeChange}
            context="repeat"
            label="Session type for this round"
            className="w-full sm:w-[220px]"
          />
          <CounsellingButton
            type="button"
            onClick={onStartSession}
            disabled={!canStart}
            data-testid="counselling-btn-start-repeat-session"
            className="h-[38px] shrink-0 whitespace-nowrap bg-orange-600 px-5 hover:bg-orange-700 disabled:opacity-50"
          >
            Start Session
          </CounsellingButton>
        </div>
      </div>
    </div>
  );
}
