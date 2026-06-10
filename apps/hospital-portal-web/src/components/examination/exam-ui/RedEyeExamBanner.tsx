'use client';

import { AlertCircle } from 'lucide-react';

const RED_EYE_PATTERNS =
  /\b(red eye|redness|hyperemia|conjunctivitis|painful red|acute red)\b/i;

export function chiefComplaintSuggestsRedEye(complaint?: string | null): boolean {
  if (!complaint?.trim()) return false;
  return RED_EYE_PATTERNS.test(complaint);
}

interface RedEyeExamBannerProps {
  chiefComplaint?: string | null;
}

/** Shown on anterior segment when CC suggests red eye — prompts external/conjunctiva review. */
export function RedEyeExamBanner({ chiefComplaint }: RedEyeExamBannerProps) {
  if (!chiefComplaintSuggestsRedEye(chiefComplaint)) return null;
  return (
    <div
      className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3"
      role="status"
    >
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <p>
        <span className="font-semibold">Red eye noted on chief complaint.</span> Review external
        eye, conjunctiva, and cornea sections carefully.
      </p>
    </div>
  );
}
