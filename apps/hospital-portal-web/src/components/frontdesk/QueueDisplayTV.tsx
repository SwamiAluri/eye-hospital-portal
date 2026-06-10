'use client';

/**
 * @deprecated Prefer QueueDisplayKiosk via /dashboard/frontdesk/queue-display
 */
import QueueDisplayKiosk from '@/components/queue-display/QueueDisplayKiosk';

interface QueueDisplayTVProps {
  branchId: string;
  queueType?: 'Optometry' | 'Doctor' | 'Billing' | 'Pharmacy';
  roomCode?: string;
}

const STATION_BY_QUEUE_TYPE: Record<NonNullable<QueueDisplayTVProps['queueType']>, string> = {
  Optometry: 'optometrist',
  Doctor: 'doctor',
  Billing: 'billing',
  Pharmacy: 'pharmacy',
};

export default function QueueDisplayTV({ branchId, queueType = 'Optometry', roomCode }: QueueDisplayTVProps) {
  return (
    <QueueDisplayKiosk
      branchId={branchId}
      mode={roomCode ? 'room' : 'station'}
      station={STATION_BY_QUEUE_TYPE[queueType]}
      roomCode={roomCode}
      soundMode="both"
    />
  );
}
