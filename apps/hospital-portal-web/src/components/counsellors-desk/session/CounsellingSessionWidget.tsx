'use client';

import type { ReactNode } from 'react';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';

export interface CounsellingSessionWidgetProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
  /** When true, fills height and scrolls body (Insurance left column). */
  scrollBody?: boolean;
  'data-testid'?: string;
}

/** Shared Notes / Insurance / Decision functional widget surface. */
export function CounsellingSessionWidget({
  title,
  icon,
  children,
  className,
  headerAction,
  scrollBody = false,
  'data-testid': testId,
}: CounsellingSessionWidgetProps) {
  return (
    <section
      data-testid={testId}
      className={cn(
        counsellingSessionTokens.sessionWidget,
        counsellingSessionTokens.sessionWidgetPad,
        scrollBody && 'flex h-full min-h-0 flex-col overflow-hidden',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-2',
          scrollBody ? 'shrink-0 pb-3' : 'pb-3',
        )}
      >
        <h2 className={counsellingSessionTokens.sessionWidgetTitle}>
          {icon}
          {title}
        </h2>
        {headerAction}
      </div>
      {scrollBody ? (
        <div className="counselling-hidden-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          <div className="space-y-3">{children}</div>
        </div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}
