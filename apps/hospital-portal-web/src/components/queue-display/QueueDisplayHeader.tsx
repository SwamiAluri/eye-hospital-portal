'use client';

import { useEffect, useState } from 'react';

interface QueueDisplayHeaderProps {
  branchName: string;
  isConnected: boolean;
}

export default function QueueDisplayHeader({ branchName, isConnected }: QueueDisplayHeaderProps) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex-shrink-0 px-6 py-4 text-white bg-slate-900">
      <div className="flex items-center justify-between max-w-[1920px] mx-auto gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight truncate">
            {branchName}
          </h1>
          <p className="text-sm md:text-base text-white/60 mt-0.5">Queue Display</p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div
            className={`hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border ${
              isConnected
                ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100'
                : 'bg-amber-500/15 border-amber-400/30 text-amber-100'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}
            />
            {isConnected ? 'Live' : 'Updating'}
          </div>
          <div className="text-right">
            <div className="queue-tv-clock tabular-nums">{time}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
