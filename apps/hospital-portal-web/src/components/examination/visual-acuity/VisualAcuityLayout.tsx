'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  VA_SECTIONS,
  type VaSectionId,
  type VaSectionRecordStatus,
} from '@/lib/optometry/visual-acuity-constants';
import { Check } from 'lucide-react';
import { VaVisitTimeline } from './VaVisitTimeline';
import type { OptometryVisitExamRecord } from '@/lib/optometry/optometry-history.types';

interface VisualAcuityLayoutProps {
  sectionStatus: Partial<Record<VaSectionId, VaSectionRecordStatus>>;
  sectionCounts?: Partial<Record<VaSectionId, number>>;
  vaHistory?: unknown[];
  refHistory?: unknown[];
  patientOptometryHistory?: OptometryVisitExamRecord[];
  onNavigateSection: (id: VaSectionId) => void;
  children: ReactNode;
}

const OBSERVER_SUPPRESS_MS = 900;

export function VisualAcuityLayout({
  sectionStatus,
  sectionCounts = {},
  vaHistory = [],
  refHistory = [],
  patientOptometryHistory,
  onNavigateSection,
  children,
}: VisualAcuityLayoutProps) {
  const [activeSection, setActiveSection] = useState<VaSectionId>('old');
  const suppressObserverUntilRef = useRef(0);

  const scrollToSection = useCallback(
    (id: VaSectionId) => {
      setActiveSection(id);
      suppressObserverUntilRef.current = Date.now() + OBSERVER_SUPPRESS_MS;
      onNavigateSection(id);
      const anchor = VA_SECTIONS.find((s) => s.id === id)?.anchor;
      requestAnimationFrame(() => {
        document.getElementById(anchor ?? `va-section-${id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    },
    [onNavigateSection],
  );

  useEffect(() => {
    const elements = VA_SECTIONS.map((s) => document.getElementById(s.anchor)).filter(
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
          const match = VA_SECTIONS.find((s) => s.anchor === visible[0].target.id);
          if (match) setActiveSection(match.id);
        }
      },
      { rootMargin: '-15% 0px -55% 0px', threshold: [0, 0.2, 0.5] },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const navButton = (s: (typeof VA_SECTIONS)[number]) => {
    const status = sectionStatus[s.id];
    const count = sectionCounts[s.id] ?? 0;
    const isActive = activeSection === s.id;
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => scrollToSection(s.id)}
        className={`w-full text-left px-3 py-2.5 lg:py-2 rounded-lg text-base transition-colors min-h-[44px] lg:min-h-0 ${
          isActive
            ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 shadow-sm'
            : 'text-gray-600 hover:bg-gray-50 border border-transparent'
        }`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate">{s.label}</span>
          <span className="flex items-center gap-1 shrink-0">
            {status === 'recorded' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
            {count > 0 && (
              <span className="text-[10px] tabular-nums text-gray-400">{count}</span>
            )}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 w-full">
      <div className="lg:hidden -mx-1 space-y-2">
        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="flex gap-2 px-1 min-w-min">
            {VA_SECTIONS.map((s) => (
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
                {s.label}
                {sectionStatus[s.id] === 'recorded' && ' ✓'}
              </button>
            ))}
          </div>
        </div>
        <div className="px-1 pt-2 border-t border-gray-100">
          <VaVisitTimeline
            vaHistory={vaHistory}
            refHistory={refHistory}
            patientOptometryHistory={patientOptometryHistory}
            compact
          />
        </div>
      </div>

      <nav className="hidden lg:block w-48 xl:w-52 shrink-0">
        <div className="sticky top-4 space-y-1">
          {VA_SECTIONS.map(navButton)}
          <div className="pt-3 mt-3 border-t border-gray-100">
            <VaVisitTimeline
              vaHistory={vaHistory}
              refHistory={refHistory}
              patientOptometryHistory={patientOptometryHistory}
            />
          </div>
        </div>
      </nav>

      <div className="flex-1 min-w-0 flex flex-col gap-3">{children}</div>
    </div>
  );
}
