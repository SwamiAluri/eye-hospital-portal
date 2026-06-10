'use client';

import { Textarea, type TextareaProps } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type CounsellingTextareaProps = TextareaProps;

export function CounsellingTextarea({ className, ...props }: CounsellingTextareaProps) {
  return (
    <Textarea
      className={cn(
        'min-h-[5rem] resize-none rounded-lg border-counselling-border text-sm focus:ring-counselling-ring',
        className,
      )}
      {...props}
    />
  );
}
