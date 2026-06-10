'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ResponsiveFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Centered dialog on desktop; bottom sheet on tablet (md and below). */
export function ResponsiveFormSheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: ResponsiveFormSheetProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  if (!open) return null;

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col justify-end">
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => onOpenChange(false)}
          aria-hidden
        />
        <div
          className="relative z-10 bg-white rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheet-title"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 id="sheet-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="px-5 py-4 border-t border-gray-100 flex flex-col gap-2 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="py-2">{children}</div>
        {footer && <DialogFooter className="gap-2 sm:gap-0">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
