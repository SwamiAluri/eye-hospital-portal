'use client';

import { useMemo, useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CounsellingButton } from './CounsellingButton';
import { cn } from '@/lib/utils';

export interface CounsellingDatePickerProps {
  value: string;
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  minDate?: Date;
  placeholder?: string;
  className?: string;
  id?: string;
  'data-testid'?: string;
}

/** Popover + Calendar date picker for counselling forms. */
export function CounsellingDatePicker({
  value,
  onChange,
  disabled,
  minDate,
  placeholder = 'Pick a date',
  className,
  id,
  'data-testid': testId,
}: CounsellingDatePickerProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => {
    if (!value) return undefined;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : undefined;
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <CounsellingButton
          type="button"
          id={id}
          variant="outline"
          disabled={disabled}
          data-testid={testId}
          className={cn(
            'h-11 w-full justify-start gap-2 px-3 font-normal',
            !value && 'text-counselling-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-60" />
          {selected ? format(selected, 'dd MMM yyyy') : placeholder}
        </CounsellingButton>
      </PopoverTrigger>
      <PopoverContent className="z-[80] w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          disabled={minDate ? { before: minDate } : undefined}
          onSelect={(date) => {
            if (!date) return;
            onChange(format(date, 'yyyy-MM-dd'));
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
