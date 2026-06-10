'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import QueueDisplayKiosk from '@/components/queue-display/QueueDisplayKiosk';
import type { SoundMode } from '@/components/queue-display/QueueCallAnnouncer';
import { useAuthStore } from '@/lib/auth-store';

function parseInterval(value: string | null): number {
  const n = Number(value ?? 10);
  return n === 8 || n === 10 || n === 15 ? n : 10;
}

function parseSoundMode(value: string | null): SoundMode {
  const mode = (value ?? 'both').toLowerCase();
  if (mode === 'off' || mode === 'chime' || mode === 'tts' || mode === 'both') {
    return mode;
  }
  return 'both';
}

function QueueDisplayContent() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const branchId =
    searchParams.get('branchId') ??
    user?.branchId ??
    (typeof window !== 'undefined' ? localStorage.getItem('branchId') : null) ??
    undefined;

  const mode = (searchParams.get('mode') ?? 'branch') as 'branch' | 'station' | 'room';
  const station = searchParams.get('station') ?? undefined;
  const roomCode = searchParams.get('roomCode') ?? undefined;
  const interval = parseInterval(searchParams.get('interval'));
  const soundMode = parseSoundMode(searchParams.get('sound'));
  const debug = searchParams.get('debug') === '1';

  // Legacy: ?queueType=Optometry&roomCode=OPT-1 → room mode
  const legacyQueueType = searchParams.get('queueType');
  const resolvedMode =
    !searchParams.get('mode') && legacyQueueType && roomCode ? 'room' : mode;
  const resolvedRoom = roomCode ?? (resolvedMode === 'room' ? 'OPT-1' : undefined);
  const resolvedStation =
    station ?? (resolvedMode === 'station' ? 'optometrist' : legacyQueueType === 'Optometry' ? 'optometrist' : undefined);

  if (!branchId) {
    return (
      <div className="h-screen w-screen bg-slate-900 text-white flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-2xl font-semibold mb-2">Queue display needs a branch</p>
          <p className="text-slate-300">
            Use{' '}
            <code className="text-emerald-300">?mode=branch&amp;interval=10</code>
            {' '}or set branch on your user profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <QueueDisplayKiosk
      branchId={branchId}
      mode={resolvedMode}
      station={resolvedStation}
      roomCode={resolvedRoom}
      interval={interval}
      soundMode={soundMode}
      debug={debug}
    />
  );
}

export default function QueueDisplayPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen flex items-center justify-center bg-slate-50 text-slate-600">
          Loading queue display…
        </div>
      }
    >
      <QueueDisplayContent />
    </Suspense>
  );
}
