'use client';

import { useEffect, useState } from 'react';
import type { QueueDisplayRoomSlide } from '@/lib/api/queue-display.api';
import QueueSlide from './QueueSlide';
import StationSlideNav from './StationSlideNav';

interface QueueCarouselProps {
  slides: QueueDisplayRoomSlide[];
  rotationSeconds: number;
}

export default function QueueCarousel({ slides, rotationSeconds }: QueueCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [progressKey, setProgressKey] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
    setProgressKey((k) => k + 1);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;

    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % slides.length);
        setProgressKey((k) => k + 1);
        setVisible(true);
      }, 350);
    }, rotationSeconds * 1000);

    return () => clearInterval(timer);
  }, [slides.length, rotationSeconds]);

  if (slides.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-xl min-h-0">
        No patients in queue
      </div>
    );
  }

  const slide = slides[activeIndex];

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <StationSlideNav
        slides={slides}
        activeIndex={activeIndex}
        rotationSeconds={rotationSeconds}
        progressKey={progressKey}
      />
      <div
        className={`flex-1 min-h-0 transition-all duration-300 ease-in-out ${
          visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
        }`}
      >
        <QueueSlide
          station={slide.station}
          stationLabel={slide.stationLabel}
          displayLabel={slide.displayLabel}
          displayLabelTe={slide.displayLabelTe}
          roomCode={slide.roomCode}
          nowServing={slide.nowServing}
          nextQueue={slide.nextQueue}
          staffName={slide.staffName}
        />
      </div>
    </div>
  );
}
