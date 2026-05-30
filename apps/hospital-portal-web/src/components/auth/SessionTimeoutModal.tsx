'use client';

import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WARNING_MS } from '@/lib/session-idle-config';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  secondsLeft: number;
  warningTotalSeconds?: number;
  onStaySignedIn: () => void;
  onSignOut: () => void;
}

export function SessionTimeoutModal({
  open,
  secondsLeft,
  warningTotalSeconds = Math.ceil(WARNING_MS / 1000),
  onStaySignedIn,
  onSignOut,
}: Props) {
  if (!open) return null;

  const progressValue = Math.max(
    0,
    Math.min(100, (secondsLeft / warningTotalSeconds) * 100),
  );
  const isUrgent = secondsLeft <= 10;
  const isCritical = secondsLeft <= 5;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      aria-describedby="session-timeout-desc"
    >
      <div className="absolute inset-0 bg-black/50" aria-hidden />
      <div
        className="relative z-10 w-full max-w-md rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center space-y-3 text-center">
          <div
            className={cn(
              'mx-auto flex h-12 w-12 items-center justify-center rounded-full',
              isCritical
                ? 'bg-red-50 text-red-600'
                : 'bg-amber-50 text-amber-600',
            )}
          >
            <ShieldAlert className="h-6 w-6" aria-hidden />
          </div>
          <h2 id="session-timeout-title" className="text-xl font-bold text-gray-900">
            Session expiring soon
          </h2>
          <p id="session-timeout-desc" className="text-center text-sm text-gray-600">
            You&apos;ve been inactive. Sign out now or stay signed in to continue working.
          </p>
        </div>

        <div className="flex flex-col items-center gap-2 py-2">
          <div
            className={cn(
              'text-5xl font-bold tabular-nums tracking-tight',
              isCritical
                ? 'text-red-600 animate-pulse'
                : isUrgent
                  ? 'text-amber-600'
                  : 'text-gray-900',
            )}
            aria-live="polite"
            aria-atomic="true"
          >
            {secondsLeft}
          </div>
          <p className="text-xs font-medium uppercase tracking-widest text-gray-400">
            {secondsLeft === 1 ? 'second remaining' : 'seconds remaining'}
          </p>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
            role="progressbar"
            aria-valuenow={progressValue}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Time remaining before automatic sign out"
          >
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                isCritical
                  ? 'bg-red-500'
                  : isUrgent
                    ? 'bg-amber-500'
                    : 'bg-emerald-500',
              )}
              style={{ width: `${progressValue}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
          <Button type="button" variant="outline" onClick={onSignOut}>
            Sign out
          </Button>
          <Button type="button" variant="primary" autoFocus onClick={onStaySignedIn}>
            Stay signed in
          </Button>
        </div>
      </div>
    </div>
  );
}
