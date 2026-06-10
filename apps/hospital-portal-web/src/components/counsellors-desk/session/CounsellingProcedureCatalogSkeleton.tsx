'use client';

import { CounsellingSkeleton } from '@/components/counsellors-desk/session/primitives';
import { cn } from '@/lib/utils';

export interface CounsellingProcedureCatalogSkeletonProps {
  className?: string;
  rowCount?: number;
}

/** Skeleton placeholder while the procedure catalog loads. */
export function CounsellingProcedureCatalogSkeleton({
  className,
  rowCount = 6,
}: CounsellingProcedureCatalogSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)} aria-busy aria-label="Loading procedures">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <CounsellingSkeleton key={`chip-${i}`} className="h-8 w-16 rounded-full bg-counselling-muted" />
        ))}
      </div>
      <CounsellingSkeleton className="h-10 w-full rounded-lg bg-counselling-muted" />
      <div className="space-y-2">
        {Array.from({ length: rowCount }).map((_, i) => (
          <CounsellingSkeleton
            key={`row-${i}`}
            className="h-11 w-full rounded-lg bg-counselling-muted"
          />
        ))}
      </div>
    </div>
  );
}
