'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent as SharedSelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Counsellor dropdowns portal outside `.counselling-session`; re-apply scrollbar scope only. */
const SelectContent = React.forwardRef<
  React.ElementRef<typeof SharedSelectContent>,
  React.ComponentPropsWithoutRef<typeof SharedSelectContent>
>(({ className, ...props }, ref) => (
  <SharedSelectContent ref={ref} className={cn('counsellor-scrollbar', className)} {...props} />
));
SelectContent.displayName = 'CounsellingSelectContent';

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
};
