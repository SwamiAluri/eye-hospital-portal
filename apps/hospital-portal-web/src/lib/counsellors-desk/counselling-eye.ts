export const COUNSELLING_EYE_OPTIONS = ['RE', 'LE', 'BE'] as const;
export type CounsellingEyeOption = (typeof COUNSELLING_EYE_OPTIONS)[number];

export function counsellingEyeLabel(eye: CounsellingEyeOption): string {
  return eye === 'BE' ? 'Both' : eye;
}

export function counsellingEyeBadgeClass(eye: CounsellingEyeOption): string {
  if (eye === 'RE') return 'bg-teal-100 text-teal-800';
  if (eye === 'LE') return 'bg-blue-100 text-[#00478d]';
  return 'bg-emerald-100 text-emerald-800';
}
