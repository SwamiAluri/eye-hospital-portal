'use client';

import { useMemo, type ReactNode } from 'react';
import { useQueueDisplayQuery, useInvalidateQueueDisplay } from '@/hooks/use-queue-display';
import { useQueueConnection } from '@/hooks/useQueueConnection';
import type { QueueDisplayParams } from '@/lib/api/queue-display.api';
import QueueCarousel from './QueueCarousel';
import TeluguTicker from './TeluguTicker';
import QueueCallAnnouncer, { type SoundMode } from './QueueCallAnnouncer';
import QueueDisplayHeader from './QueueDisplayHeader';
import { DEFAULT_TICKER } from './queue-display-theme';

interface QueueDisplayKioskProps {
  branchId: string;
  mode?: 'branch' | 'station' | 'room';
  station?: string;
  roomCode?: string;
  interval?: number;
  soundMode?: SoundMode;
  debug?: boolean;
}

function QueueShell({
  branchName,
  isConnected,
  children,
  tickerMessages,
  debugFooter,
}: {
  branchName: string;
  isConnected: boolean;
  children: ReactNode;
  tickerMessages: typeof DEFAULT_TICKER;
  debugFooter?: ReactNode;
}) {
  return (
    <div className="queue-tv-shell h-[100dvh] w-screen overflow-hidden grid grid-rows-[auto_1fr_auto_auto] bg-[var(--background-secondary)]">
      <QueueDisplayHeader branchName={branchName} isConnected={isConnected} />
      <main className="min-h-0 overflow-hidden flex flex-col">{children}</main>
      <TeluguTicker messages={tickerMessages} />
      {debugFooter}
    </div>
  );
}

function IdleState({
  branchName,
  isConnected,
  onRefresh,
  debugFooter,
}: {
  branchName?: string;
  isConnected: boolean;
  onRefresh: () => void;
  debugFooter?: ReactNode;
}) {
  return (
    <QueueShell
      branchName={branchName ?? 'Hospital'}
      isConnected={isConnected}
      tickerMessages={DEFAULT_TICKER}
      debugFooter={debugFooter}
    >
      <div className="flex flex-col items-center justify-center flex-1 px-6 text-center gap-5">
        <div className="w-20 h-20 rounded-2xl bg-white shadow-lg border border-slate-200 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div>
          <p className="text-2xl lg:text-3xl font-semibold text-slate-800">No patients waiting right now</p>
          <p className="text-slate-500 mt-2 max-w-md mx-auto text-base lg:text-lg">
            This display is live. Patients will appear when they are sent to a station.
          </p>
          <p className="text-slate-400 mt-1 text-sm">దయచేసి మీ టోకెన్‌ను దగ్గర ఉంచుకోండి</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Refresh
        </button>
      </div>
    </QueueShell>
  );
}

export default function QueueDisplayKiosk({
  branchId,
  mode = 'branch',
  station,
  roomCode,
  interval = 10,
  soundMode = 'both',
  debug = false,
}: QueueDisplayKioskProps) {
  const invalidate = useInvalidateQueueDisplay();

  const params: QueueDisplayParams = useMemo(
    () => ({
      branchId,
      mode,
      station,
      roomCode,
      interval,
    }),
    [branchId, mode, station, roomCode, interval],
  );

  const { isConnected } = useQueueConnection({
    branchId,
    autoConnect: true,
    onQueueUpdate: () => invalidate(),
  });

  const { data, isLoading, isError, refetch } = useQueueDisplayQuery(params, true, !isConnected);

  const debugFooter =
    debug && data ? (
      <footer className="flex-shrink-0 bg-slate-800 px-4 py-1.5 text-center text-[10px] text-slate-400 font-mono">
        {data.slides.length} active slide{data.slides.length !== 1 ? 's' : ''} · rotates every {data.rotationSeconds}s
        {!isConnected ? ' · polling' : ''}
      </footer>
    ) : null;

  if (isLoading && !data) {
    return (
      <div className="queue-tv-shell h-[100dvh] w-screen flex items-center justify-center bg-[var(--background-secondary)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
          <p className="text-slate-600">Loading queue display…</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <IdleState
        branchName={data?.branchName}
        isConnected={isConnected}
        onRefresh={() => refetch()}
        debugFooter={debugFooter}
      />
    );
  }

  if (!data || data.slides.length === 0) {
    return (
      <IdleState
        branchName={data?.branchName}
        isConnected={isConnected}
        onRefresh={() => refetch()}
        debugFooter={debugFooter}
      />
    );
  }

  return (
    <QueueShell
      branchName={data.branchName}
      isConnected={isConnected}
      tickerMessages={data.tickerMessages}
      debugFooter={debugFooter}
    >
      <QueueCarousel slides={data.slides} rotationSeconds={data.rotationSeconds} />
      <QueueCallAnnouncer slides={data.slides} soundMode={soundMode} />
    </QueueShell>
  );
}
