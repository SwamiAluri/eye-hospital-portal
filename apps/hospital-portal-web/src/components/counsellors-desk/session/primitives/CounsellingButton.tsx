'use client';

import { Button, type ButtonProps } from '@/components/ui/button';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';

export type CounsellingButtonProps = ButtonProps;

/** Counselling actions — wraps app Button with touch-friendly defaults. */
export function CounsellingButton({
  className,
  size = 'md',
  ...props
}: CounsellingButtonProps) {
  return (
    <Button
      size={size}
      className={cn(counsellingSessionTokens.touchTarget, className)}
      {...props}
    />
  );
}
