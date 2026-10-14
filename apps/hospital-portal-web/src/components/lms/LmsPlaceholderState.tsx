'use client';

import { Construction } from 'lucide-react';

export function LmsPlaceholderState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div
      className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center"
      data-testid="lms-placeholder-state"
      role="status"
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <Construction className="h-6 w-6 text-gray-500" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm font-medium text-amber-700">Not yet implemented</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-lg text-xs text-gray-500">{description}</p>
      ) : null}
      <p className="mx-auto mt-3 max-w-md text-[11px] text-gray-400">
        Navigation establishes the Enterprise LMS information architecture only.
        No clinical, specimen, result, or billing workflow is active on this page.
      </p>
    </div>
  );
}
