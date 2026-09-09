'use client';

import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CounsellingStatusTone = 'info' | 'success' | 'warning' | 'error' | 'loading';

const TONE_CLASS: Record<CounsellingStatusTone, string> = {
  info: 'border-counselling-border/70 bg-counselling-muted/30 text-counselling-foreground',
  success: 'border-emerald-200/80 bg-emerald-50/80 text-emerald-950',
  warning: 'border-amber-200/80 bg-amber-50/80 text-amber-950',
  error: 'border-red-200/80 bg-red-50/80 text-red-950',
  loading: 'border-counselling-border/70 bg-counselling-muted/20 text-counselling-muted-foreground',
};

const TONE_ICON: Record<Exclude<CounsellingStatusTone, 'loading'>, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  error: AlertCircle,
};

export interface CounsellingStatusMessageProps {
  tone?: CounsellingStatusTone;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Compact counselling status row — loading, empty, error, info. */
export function CounsellingStatusMessage({
  tone = 'info',
  title,
  description,
  action,
  className,
}: CounsellingStatusMessageProps) {
  const Icon = tone === 'loading' ? Loader2 : TONE_ICON[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
        TONE_CLASS[tone],
        className,
      )}
    >
      <Icon
        className={cn('mt-0.5 h-4 w-4 shrink-0', tone === 'loading' && 'animate-spin')}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug">{title}</p>
        {description ? (
          <p className="mt-0.5 text-xs opacity-90">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
