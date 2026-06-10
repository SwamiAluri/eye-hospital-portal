'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  MEDICAL_HISTORY_SECTIONS,
  type MedicalHistorySectionId,
} from '@/lib/medical-history/medical-history-constants';
import { MhVisitTimeline } from './MhVisitTimeline';
import type { OptometryVisitExamRecord } from '@/lib/optometry/optometry-history.types';

interface MedicalHistoryLayoutProps {
  sectionCounts: Partial<Record<MedicalHistorySectionId, number>>;
  hasUnsavedChanges?: boolean;
  children: React.ReactNode;
  priorVisitBanner?: React.ReactNode;
  patientOptometryHistory?: OptometryVisitExamRecord[];
}

export function MedicalHistoryLayout({
  sectionCounts,
  hasUnsavedChanges,
  children,
  priorVisitBanner,
  patientOptometryHistory,
}: MedicalHistoryLayoutProps) {
  const [activeSection, setActiveSection] = useState<MedicalHistorySectionId>('allergies');

  const scrollToSection = useCallback((id: MedicalHistorySectionId) => {
    setActiveSection(id);
    document.getElementById(`mh-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const ids = MEDICAL_HISTORY_SECTIONS.map((s) => s.id);
    const elements = ids
      .map((id) => document.getElementById(`mh-section-${id}`))
      .filter(Boolean) as HTMLElement[];

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          const id = visible[0].target.id.replace('mh-section-', '') as MedicalHistorySectionId;
          setActiveSection(id);
        }
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5] },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 w-full">
      {/* Mobile / tablet: horizontal chips */}
      <div className="lg:hidden -mx-1 overflow-x-auto pb-1">
        <div className="flex gap-2 px-1 min-w-min">
          {MEDICAL_HISTORY_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollToSection(s.id)}
              className={`shrink-0 px-3 py-2 min-h-[44px] text-base font-medium rounded-full border transition-colors ${
                activeSection === s.id
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {s.label}
              {(sectionCounts[s.id] ?? 0) > 0 && (
                <span className="ml-1 opacity-80">({sectionCounts[s.id]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop sidebar */}
      <nav className="hidden lg:block w-52 shrink-0">
        <div className="sticky top-4 space-y-1">
          {MEDICAL_HISTORY_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollToSection(s.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-base transition-colors ${
                activeSection === s.id
                  ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span>{s.label}</span>
                <span className="text-[10px] tabular-nums text-gray-400">
                  {sectionCounts[s.id] ?? 0}
                </span>
              </span>
            </button>
          ))}
          <div className="pt-3 mt-3 border-t border-gray-100 px-1 space-y-3">
            <MhVisitTimeline patientOptometryHistory={patientOptometryHistory} />
            {hasUnsavedChanges ? (
              <p className="text-xs text-amber-700 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Unsaved changes
              </p>
            ) : (
              <p className="text-xs text-emerald-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                All changes saved
              </p>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {priorVisitBanner}
        {children}
      </div>
    </div>
  );
}
