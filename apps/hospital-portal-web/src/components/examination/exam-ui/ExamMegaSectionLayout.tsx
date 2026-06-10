'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export interface MegaSectionNavItem {
  id: string;
  shortLabel: string;
  anchor: string;
}

interface ExamMegaSectionLayoutProps<T extends string> {
  sections: MegaSectionNavItem[];
  defaultSectionId: T;
  children: ReactNode;
  footer?: ReactNode;
}

const OBSERVER_SUPPRESS_MS = 900;

export function ExamMegaSectionLayout<T extends string>({
  sections,
  defaultSectionId,
  children,
  footer,
}: ExamMegaSectionLayoutProps<T>) {
  const [activeSection, setActiveSection] = useState<T>(defaultSectionId);
  const suppressObserverUntilRef = useRef(0);

  const scrollToSection = useCallback(
    (id: T) => {
      setActiveSection(id);
      suppressObserverUntilRef.current = Date.now() + OBSERVER_SUPPRESS_MS;
      const anchor = sections.find((s) => s.id === id)?.anchor;
      requestAnimationFrame(() => {
        document.getElementById(anchor ?? `section-${id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    },
    [sections],
  );

  useEffect(() => {
    const elements = sections.map((s) => document.getElementById(s.anchor)).filter(Boolean) as HTMLElement[];
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < suppressObserverUntilRef.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          const match = sections.find((s) => s.anchor === visible[0].target.id);
          if (match) setActiveSection(match.id as T);
        }
      },
      { rootMargin: '-15% 0px -55% 0px', threshold: [0, 0.2, 0.5] },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 w-full">
        <div className="lg:hidden -mx-1 overflow-x-auto pb-1">
          <div className="flex gap-2 px-1 min-w-min">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollToSection(s.id as T)}
                className={`shrink-0 px-3 py-2 min-h-[44px] text-sm font-medium rounded-full border transition-colors ${
                  activeSection === s.id
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {s.shortLabel}
              </button>
            ))}
          </div>
        </div>

        <nav className="hidden lg:block w-44 xl:w-48 shrink-0">
          <div className="sticky top-4 space-y-1">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollToSection(s.id as T)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors min-h-[44px] lg:min-h-0 ${
                  activeSection === s.id
                    ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                }`}
              >
                {s.shortLabel}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-1 min-w-0 flex flex-col gap-3">{children}</div>
      </div>
      {footer}
    </div>
  );
}
