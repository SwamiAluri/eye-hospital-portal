'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { OptometryExamTabId } from '@/lib/optometry/optometry-exam-types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface ExamTabNavItem {
  id: string;
  label: string;
  shortLabel?: string;
  step: number;
}

interface ExamTabNavProps {
  tabs: ExamTabNavItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  /** Return Tailwind classes for status dot, or null to hide dot (idle tabs). */
  statusDotClass: (tabId: OptometryExamTabId) => string | null;
  /** Tabs shown inline before overflow menu (default 7). */
  visibleCount?: number;
}

function TabPill({
  tab,
  isActive,
  onSelect,
  dotClass,
}: {
  tab: ExamTabNavItem;
  isActive: boolean;
  onSelect: () => void;
  dotClass: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-full text-xs sm:text-sm font-medium transition-colors ${
        isActive
          ? 'bg-emerald-600 text-white shadow-sm'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
      title={tab.label}
    >
      <span
        className={`hidden md:inline text-[10px] font-bold tabular-nums ${
          isActive ? 'text-emerald-100' : 'text-slate-400'
        }`}
      >
        {tab.step}
      </span>
      <span className="whitespace-nowrap">
        <span className="lg:hidden">{tab.shortLabel ?? tab.label}</span>
        <span className="hidden lg:inline">{tab.label}</span>
      </span>
      {dotClass && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass} ${
            isActive ? 'ring-1 ring-white/50' : ''
          }`}
          aria-hidden
        />
      )}
    </button>
  );
}

export function ExamTabNav({
  tabs,
  activeTab,
  onTabChange,
  statusDotClass,
  visibleCount = 7,
}: ExamTabNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const { primaryTabs, overflowTabs } = useMemo(
    () => ({
      primaryTabs: tabs.slice(0, visibleCount),
      overflowTabs: tabs.slice(visibleCount),
    }),
    [tabs, visibleCount],
  );

  const overflowHasActive = overflowTabs.some((t) => t.id === activeTab);

  return (
    <div className="sticky top-0 z-20 bg-white border-t border-slate-100 shadow-sm">
      <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 scrollbar-thin">
        {primaryTabs.map((tab) => (
          <TabPill
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            onSelect={() => onTabChange(tab.id)}
            dotClass={statusDotClass(tab.id as OptometryExamTabId)}
          />
        ))}

        {overflowTabs.length > 0 && (
          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`shrink-0 inline-flex items-center gap-1 px-3 py-2 min-h-[40px] rounded-full text-xs sm:text-sm font-medium border transition-colors ${
                  overflowHasActive
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                More
                <ChevronDown className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2 z-[100]">
              <ul className="space-y-0.5">
                {overflowTabs.map((tab) => {
                  const dot = statusDotClass(tab.id as OptometryExamTabId);
                  return (
                    <li key={tab.id}>
                      <button
                        type="button"
                        className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between gap-2 ${
                          activeTab === tab.id
                            ? 'bg-emerald-50 text-emerald-800 font-medium'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                        onClick={() => {
                          onTabChange(tab.id);
                          setMoreOpen(false);
                        }}
                      >
                        <span>
                          <span className="text-[10px] text-slate-400 mr-1.5 tabular-nums">
                            {tab.step}
                          </span>
                          {tab.label}
                        </span>
                        {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
