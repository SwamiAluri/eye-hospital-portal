'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueueDisplayRoomSlide } from '@/lib/api/queue-display.api';

export type SoundMode = 'off' | 'chime' | 'tts' | 'both';

interface QueueCallAnnouncerProps {
  slides: QueueDisplayRoomSlide[];
  soundMode?: SoundMode;
}

function playChime() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.25);
    setTimeout(() => {
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'sine';
      o2.frequency.value = 1175;
      g2.gain.value = 0.08;
      o2.connect(g2);
      g2.connect(ctx.destination);
      o2.start();
      o2.stop(ctx.currentTime + 0.35);
    }, 180);
  } catch {
    // ignore audio failures
  }
}

function speakEnglish(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-IN';
  utterance.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export default function QueueCallAnnouncer({ slides, soundMode = 'both' }: QueueCallAnnouncerProps) {
  const [enabled, setEnabled] = useState(false);
  const lastServingKey = useRef<string>('');

  const announce = useCallback(
    (slide: QueueDisplayRoomSlide) => {
      if (!enabled || soundMode === 'off' || !slide.nowServing) return;

      const patient = slide.nowServing;
      const room = slide.displayLabel || slide.roomCode;
      const message = `Token ${patient.tokenNumber}. ${patient.patientName}. Please proceed to ${room}.`;

      if (soundMode === 'chime' || soundMode === 'both') {
        playChime();
      }
      if (soundMode === 'tts' || soundMode === 'both') {
        setTimeout(() => speakEnglish(message), soundMode === 'both' ? 400 : 0);
      }
    },
    [enabled, soundMode],
  );

  useEffect(() => {
    for (const slide of slides) {
      if (!slide.nowServing) continue;
      const key = `${slide.station}-${slide.roomCode}-${slide.nowServing.tokenNumber}`;
      if (key !== lastServingKey.current) {
        lastServingKey.current = key;
        announce(slide);
        break;
      }
    }
  }, [slides, announce]);

  if (soundMode === 'off') {
    return null;
  }

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={() => setEnabled(true)}
        className="fixed bottom-16 right-4 z-50 rounded-full bg-emerald-600 text-white px-4 py-2 text-sm font-semibold shadow-lg hover:bg-emerald-700"
      >
        Enable announcements
      </button>
    );
  }

  return null;
}
