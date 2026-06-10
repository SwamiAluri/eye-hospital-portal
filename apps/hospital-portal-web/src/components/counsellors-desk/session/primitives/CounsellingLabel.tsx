'use client';

import { Label, type LabelProps } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type CounsellingLabelProps = LabelProps;

export function CounsellingLabel({ className, ...props }: CounsellingLabelProps) {
  return <Label className={cn('text-sm text-counselling-foreground', className)} {...props} />;
}
