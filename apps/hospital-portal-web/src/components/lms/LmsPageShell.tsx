'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { FlaskConical } from 'lucide-react';
import { LmsContextStrip } from '@/components/lms/LmsContextStrip';

export function LmsPageShell({
  title,
  subtitle,
  icon: Icon = FlaskConical,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col bg-gray-50/60" data-testid="lms-page-shell">
      <div className="staff-page-header flex items-start justify-between gap-4 border-b border-gray-200 bg-white">
        <div className="min-w-0">
          <div className="mb-0.5 flex items-center gap-2">
            <span className="text-[11px] font-medium text-gray-400">Laboratory Management</span>
            <span className="text-gray-300">/</span>
            <span className="text-[11px] font-semibold text-gray-600">{title}</span>
          </div>
          <h1 className="staff-page-title flex items-center gap-2 font-bold text-gray-900">
            <Icon className="h-5 w-5 text-emerald-600" aria-hidden />
            {title}
          </h1>
          {subtitle ? <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p> : null}
          <div className="mt-2">
            <LmsContextStrip />
          </div>
        </div>
        {actions ? <div className="flex-shrink-0">{actions}</div> : null}
      </div>
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  );
}
