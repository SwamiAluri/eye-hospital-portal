'use client';

import type { QueueDisplayRoomSlide } from '@/lib/api/queue-display.api';
import { BRAND_THEME } from './queue-display-theme';

interface StationSlideNavProps {
  slides: QueueDisplayRoomSlide[];
  activeIndex: number;
  rotationSeconds: number;
  progressKey: number;
}

export default function StationSlideNav({
  slides,
  activeIndex,
  rotationSeconds,
  progressKey,
}: StationSlideNavProps) {
  if (slides.length <= 1) return null;

  return (
    <div className="flex-shrink-0 px-4 lg:px-6 pt-4 pb-2">
      <div className="flex flex-wrap gap-2 justify-center max-w-[1920px] mx-auto">
        {slides.map((slide, i) => {
          const isActive = i === activeIndex;
          return (
            <div
              key={`${slide.station}-${slide.roomCode}-${i}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs lg:text-sm font-medium transition-all max-w-[240px] ${
                isActive ? BRAND_THEME.pillActive : BRAND_THEME.pillInactive
              }`}
              title={`${slide.stationLabel} · ${slide.displayLabel}`}
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isActive ? 'bg-white' : 'bg-slate-400'
                }`}
              />
              <span className="truncate">
                {slide.stationLabel} · {slide.displayLabel}
              </span>
            </div>
          );
        })}
      </div>
      <div className="max-w-[1920px] mx-auto mt-2 h-1 rounded-full bg-slate-200 overflow-hidden">
        <div
          key={`${activeIndex}-${progressKey}`}
          className="h-full rounded-full queue-slide-progress bg-emerald-500"
          style={{ animationDuration: `${rotationSeconds}s` }}
        />
      </div>
    </div>
  );
}
