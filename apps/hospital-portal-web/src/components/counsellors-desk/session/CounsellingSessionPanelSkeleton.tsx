'use client';

import { CounsellingSkeleton } from '@/components/counsellors-desk/session/primitives';

export interface CounsellingSessionPanelSkeletonProps {
  label: string;
}

/** Skeleton placeholder while counselling/coverage panels load. */
export function CounsellingSessionPanelSkeleton({ label }: CounsellingSessionPanelSkeletonProps) {
  return (
    <div className="space-y-4 p-5" aria-busy aria-label={label}>
      <CounsellingSkeleton className="h-7 w-40 bg-counselling-muted" />
      <CounsellingSkeleton className="h-24 w-full rounded-xl bg-counselling-muted" />
      <CounsellingSkeleton className="h-48 w-full rounded-xl bg-counselling-muted" />
    </div>
  );
}
