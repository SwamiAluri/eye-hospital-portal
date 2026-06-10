'use client';

import { Input, type InputProps } from '@/components/ui/input';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';

export type CounsellingInputProps = InputProps;

/** Form inputs inside counselling session — no embedded label wrapper by default. */
export function CounsellingInput({ className, ...props }: CounsellingInputProps) {
  return (
    <Input
      className={cn('h-11 rounded-lg border-counselling-border text-sm focus:ring-counselling-ring', className)}
      {...props}
    />
  );
}
