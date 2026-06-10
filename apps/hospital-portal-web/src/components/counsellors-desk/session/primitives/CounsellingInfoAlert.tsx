'use client';

import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export type CounsellingAlertVariant = 'info' | 'warning' | 'success' | 'destructive';

const variantMap: Record<CounsellingAlertVariant, 'info' | 'warning' | 'default' | 'destructive'> = {
  info: 'info',
  warning: 'warning',
  success: 'default',
  destructive: 'destructive',
};

export interface CounsellingInfoAlertProps {
  variant?: CounsellingAlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

/** Doctor recommendation, package conflict, and guidance banners. */
export function CounsellingInfoAlert({
  variant = 'info',
  title,
  children,
  className,
  action,
}: CounsellingInfoAlertProps) {
  return (
    <Alert variant={variantMap[variant]} className={cn('rounded-xl', className)}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {title ? <AlertTitle className="text-sm">{title}</AlertTitle> : null}
          <AlertDescription className="text-sm">{children}</AlertDescription>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </Alert>
  );
}
