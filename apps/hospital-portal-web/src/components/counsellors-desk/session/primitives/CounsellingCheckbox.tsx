'use client';

import { Checkbox, type CheckboxProps } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export type CounsellingCheckboxProps = CheckboxProps;

export function CounsellingCheckbox({ className, ...props }: CounsellingCheckboxProps) {
  return <Checkbox className={cn('shrink-0', className)} {...props} />;
}
