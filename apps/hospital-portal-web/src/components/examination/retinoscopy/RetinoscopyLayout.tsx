'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  RETINOSCOPY_SECTIONS,
  type RetinoscopySectionId,
  type RetinoscopySectionRecordStatus,
} from '@/lib/optometry/retinoscopy-section-constants';
import { Check } from 'lucide-react';

interface RetinoscopyLayoutProps {
  sectionStatus: Partial<Record<RetinoscopySectionId, RetinoscopySectionRecordStatus>>;
  onNavigateSection: (id: RetinoscopySectionId) => void;
  children: ReactNode;
}

const OBSERVER_SUPPRESS_MS = 900;

export function RetinoscopyLayout({
  sectionStatus,
  onNavigateSection,
  children,
}: RetinoscopyLayoutProps) {
  const [activeSection, setActiveSection] = useState<RetinoscopySectionId>('wet');
  const suppressObserverUntilRef = useRef(0);

  const scrollToSection = useCallback(
    (id: RetinoscopySectionId) => {
      setActiveSection(id);
      suppressObserverUntilRef.current = Date.now() + OBSERVER_SUPPRESS_MS;
      onNavigateSection(id);
      const anchor = RETINOSCOPY_SECTIONS.find((s) => s.id === id)?.anchor;
      requestAnimationFrame(() => {
        document.getElementById(anchor ?? `retinoscopy-section-${id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    },
    [onNavigateSection],
  );

  useEffect(() => {
    const elements = RETINOSCOPY_SECTIONS.map((s) => document.getElementById(s.anchor)).filter(
      Boolean,
    ) as HTMLElement[];

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < suppressObserverUntilRef.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          const match = RETINOSCOPY_SECTIONS.find((s) => s.anchor === visible[0].target.id);
          if (match) setActiveSection(match.id);
        }
      },
      { rootMargin: '-15% 0px -55% 0px', threshold: [0, 0.2, 0.5] },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const navButton = (s: (typeof RETINOSCOPY_SECTIONS)[number]) => {
    const status = sectionStatus[s.id];
    const isActive = activeSection === s.id;
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => scrollToSection(s.id)}
        className={`w-full text-left px-3 py-2.5 lg:py-2 rounded-lg text-sm transition-colors min-h-[44px] lg:min-h-0 ${
          isActive
            ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 shadow-sm'
            : 'text-gray-600 hover:bg-gray-50 border border-transparent'
        }`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-base leading-snug">{s.shortLabel}</span>
          <span className="flex items-center gap-1 shrink-0">
            {status === 'recorded' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 w-full">
      <div className="lg:hidden -mx-1 overflow-x-auto pb-1">
        <div className="flex gap-2 px-1 min-w-min">
          {RETINOSCOPY_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollToSection(s.id)}
              className={`shrink-0 px-3 py-2 min-h-[44px] text-base font-medium rounded-full border transition-colors ${
                activeSection === s.id
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {s.shortLabel}
              {sectionStatus[s.id] === 'recorded' && ' ✓'}
            </button>
          ))}
        </div>
      </div>

      <nav className="hidden lg:block w-48 xl:w-52 shrink-0">
        <div className="sticky top-4 space-y-1">
          {RETINOSCOPY_SECTIONS.map(navButton)}
        </div>
      </nav>

      <div className="flex-1 min-w-0 flex flex-col gap-3">{children}</div>
    </div>
  );
}
