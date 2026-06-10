'use client';

import type { QueueDisplayPatient } from '@/lib/api/queue-display.api';
import NowServingHero from './NowServingHero';
import NextQueueList from './NextQueueList';
import ProceedCallout from './ProceedCallout';

export interface QueueSlideProps {
  station: string;
  stationLabel: string;
  displayLabel: string;
  displayLabelTe?: string;
  roomCode: string;
  nowServing: QueueDisplayPatient | null;
  nextQueue: QueueDisplayPatient[];
  staffName?: string;
}

export default function QueueSlide({
  station,
  stationLabel,
  displayLabel,
  displayLabelTe,
  roomCode,
  nowServing,
  nextQueue,
  staffName,
}: QueueSlideProps) {
  const roomLabel = displayLabel || `Room ${roomCode}`;

  return (
    <div className="flex flex-col h-full min-h-0 px-4 lg:px-6 pb-4 gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4 lg:gap-6 flex-1 min-h-0">
        <NowServingHero
          station={station}
          stationLabel={stationLabel}
          displayLabel={roomLabel}
          nowServing={nowServing}
        />
        <NextQueueList nextQueue={nextQueue} />
      </div>

      <ProceedCallout
        station={station}
        displayLabel={roomLabel}
        displayLabelTe={displayLabelTe}
        roomCode={roomCode}
        staffName={staffName}
        visible={!!nowServing}
      />

      {!nowServing && nextQueue.length > 0 && (
        <p className="text-center text-slate-500 text-base lg:text-lg pb-1">
          Waiting — please watch for your token above
        </p>
      )}
    </div>
  );
}
