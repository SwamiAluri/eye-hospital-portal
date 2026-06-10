'use client';

/** Shared skeleton while a lazy-loaded exam tab chunk loads. */
export function ExamTabPanelSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse space-y-4">
      <div className="h-5 bg-gray-200 rounded w-48" />
      <div className="h-24 bg-gray-100 rounded" />
      <div className="h-24 bg-gray-100 rounded" />
    </div>
  );
}
