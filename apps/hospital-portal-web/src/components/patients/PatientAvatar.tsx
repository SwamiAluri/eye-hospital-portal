'use client';

import { useState } from 'react';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPatientInitials, resolvePatientPhotoUrl } from '@/lib/patients/patient-display-utils';

const SIZE_CLASSES = {
  sm: 'w-9 h-9 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-24 h-24 text-2xl',
} as const;

export type PatientAvatarSize = keyof typeof SIZE_CLASSES;

export interface PatientAvatarProps {
  photoUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  /** Used for initials when first/last name missing */
  displayName?: string | null;
  size?: PatientAvatarSize;
  className?: string;
  showNoPhotoHint?: boolean;
}

export function PatientAvatar({
  photoUrl,
  firstName,
  lastName,
  displayName,
  size = 'md',
  className,
  showNoPhotoHint = false,
}: PatientAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const resolvedUrl = resolvePatientPhotoUrl(photoUrl);
  const initials = getPatientInitials(firstName, lastName, displayName);
  const sizeClass = SIZE_CLASSES[size];

  if (resolvedUrl && !imgError) {
    return (
      <img
        src={resolvedUrl}
        alt={(displayName ?? `${firstName ?? ''} ${lastName ?? ''}`.trim()) || 'Patient'}
        className={cn(
          'rounded-full object-cover ring-2 ring-slate-100 shrink-0',
          sizeClass,
          className,
        )}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold shrink-0 relative',
        sizeClass,
        className,
      )}
      aria-hidden={!showNoPhotoHint}
    >
      <span>{initials}</span>
      {showNoPhotoHint && size === 'xl' && (
        <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-slate-500" aria-hidden />
        </span>
      )}
    </div>
  );
}
