'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

interface ExamMegaSectionCardProps {
  anchor: string;
  title: string;
  icon?: ReactNode;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children: ReactNode;
}

export function ExamMegaSectionCard({
  anchor,
  title,
  icon,
  expanded,
  onExpandedChange,
  children,
}: ExamMegaSectionCardProps) {
  return (
    <section
      id={anchor}
      className="scroll-mt-28 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
    >
      <button
        type="button"
        className="w-full px-4 py-3 border-b border-gray-100 flex items-center gap-2 min-h-[44px] lg:min-h-0 text-left"
        onClick={() => onExpandedChange(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
        )}
        {icon && <span className="text-gray-600 shrink-0">{icon}</span>}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </button>
      {expanded && <div className="px-4 py-3 min-w-0">{children}</div>}
    </section>
  );
}
