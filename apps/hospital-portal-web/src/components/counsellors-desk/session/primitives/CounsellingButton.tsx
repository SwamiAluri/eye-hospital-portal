'use client';

import { forwardRef } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';

export type CounsellingButtonProps = ButtonProps;

/** Counselling actions — wraps app Button with touch-friendly defaults. */
export const CounsellingButton = forwardRef<HTMLButtonElement, CounsellingButtonProps>(
  function CounsellingButton({ className, size = 'md', ...props }, ref) {
    return (
      <Button
        ref={ref}
        size={size}
        className={cn(counsellingSessionTokens.touchTarget, className)}
        {...props}
      />
    );
  },
);
CounsellingButton.displayName = 'CounsellingButton';
