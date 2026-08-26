'use client';

import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type IpOverlaySize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl' | 'full';

export interface IpOverlayDialogProps {
  open?: boolean;
  onClose: () => void;
  title: string;
  size?: IpOverlaySize;
  /** Keep the existing X/header; Radix still supplies focus trap + Escape. */
  testId?: string;
  className?: string;
  /**
   * Workspaces default to false so a stray overlay click does not dump a long form.
   * Small confirms can set true.
   */
  dismissOnOverlay?: boolean;
  children: ReactNode;
}

/**
 * UX-090. Thin wrapper over `dialog.tsx` so IP/ward/OT overlays share focus trap
 * and Escape without a second modal stack.
 */
export function IpOverlayDialog({
  open = true,
  onClose,
  title,
  size = 'md',
  testId,
  className,
  dismissOnOverlay,
  children,
}: IpOverlayDialogProps) {
  const allowOverlayDismiss = dismissOnOverlay ?? (size === 'sm' || size === 'md');

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        size={size}
        hideCloseButton
        data-testid={testId}
        aria-describedby={undefined}
        className={cn('ip-target p-0 gap-0 overflow-hidden flex flex-col', className)}
        onPointerDownOutside={allowOverlayDismiss ? undefined : (e) => e.preventDefault()}
        onInteractOutside={allowOverlayDismiss ? undefined : (e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
