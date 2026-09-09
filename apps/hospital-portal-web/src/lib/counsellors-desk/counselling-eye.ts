export const COUNSELLING_EYE_OPTIONS = ['RE', 'LE', 'BE'] as const;
export type CounsellingEyeOption = (typeof COUNSELLING_EYE_OPTIONS)[number];

export function counsellingEyeLabel(eye: CounsellingEyeOption): string {
  return eye === 'BE' ? 'Both' : eye;
}

/** Waiting-list parity badges — RE orange / LE purple / BE green. */
export function counsellingEyeBadgeClass(eye: CounsellingEyeOption): string {
  if (eye === 'RE') return 'bg-orange-100 text-orange-700';
  if (eye === 'LE') return 'bg-purple-100 text-purple-700';
  return 'bg-green-100 text-green-700';
}

export function counsellingEyeBadgeText(eye: CounsellingEyeOption): string {
  return eye;
}
