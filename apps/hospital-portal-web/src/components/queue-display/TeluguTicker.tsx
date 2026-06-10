'use client';

import type { QueueDisplayTickerMessage } from '@/lib/api/queue-display.api';

interface TeluguTickerProps {
  messages: QueueDisplayTickerMessage[];
}

export default function TeluguTicker({ messages }: TeluguTickerProps) {
  if (messages.length === 0) return null;

  const combined = messages.flatMap((m) => [m.en, m.te].filter(Boolean)).join('   ·   ');

  return (
    <div className="flex-shrink-0 border-t border-slate-700 overflow-hidden bg-slate-900">
      <div className="relative h-14 lg:h-16 flex items-center">
        <div className="animate-queue-ticker whitespace-nowrap text-sm lg:text-base text-white/95 font-medium px-6">
          <span className="inline-block pr-20">{combined}</span>
          <span className="inline-block pr-20" aria-hidden="true">
            {combined}
          </span>
        </div>
      </div>
    </div>
  );
}
