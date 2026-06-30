'use client';

import { useMemo, useState } from 'react';
import { addDays, format, isBefore, parseISO, startOfDay, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './CounsellingPopover';
import { CounsellingButton } from './CounsellingButton';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { cn } from '@/lib/utils';

export type CounsellingDatePickerVariant = 'compact' | 'scheduling';

export interface CounsellingDatePickerProps {
  value: string;
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  minDate?: Date;
  placeholder?: string;
  className?: string;
  id?: string;
  /** compact = follow-up fields (quick picks); scheduling = surgery dates (month/year dropdown) */
  variant?: CounsellingDatePickerVariant;
  'data-testid'?: string;
}

const QUICK_PICKS = [
  { label: 'Tomorrow', days: 1 },
  { label: 'Next week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
] as const;

function toIsoDate(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function isDisabledDate(date: Date, minDate?: Date) {
  if (!minDate) return false;
  return isBefore(startOfDay(date), startOfDay(minDate));
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
  variant = 'compact',
  'data-testid': testId,
}: CounsellingDatePickerProps) {
  const [open, setOpen] = useState(false);
  const isScheduling = variant === 'scheduling';

  const selected = useMemo(() => {
    if (!value) return undefined;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : undefined;
  }, [value]);

  const pickDate = (date: Date) => {
    onChange(toIsoDate(date));
    setOpen(false);
  };

  const calendarStartMonth = useMemo(() => {
    if (isScheduling && !minDate) {
      if (selected && isBefore(startOfDay(selected), startOfDay(new Date()))) {
        return selected;
      }
      return addDays(new Date(), -365 * 5);
    }
    return selected ?? minDate ?? new Date();
  }, [isScheduling, minDate, selected]);

  const calendarEndMonth = isScheduling
    ? addDays(new Date(), 365 * 10)
    : addDays(new Date(), 365 * 2);

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
            'w-full justify-start gap-2 px-3 font-normal',
            isScheduling ? counsellingSessionTokens.catalogInput : 'h-11',
            !value && 'text-counselling-muted-foreground',
            selected && 'border-counselling-primary/30 bg-counselling-accent/40',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-counselling-primary/70" />
          {selected ? format(selected, 'dd MMM yyyy') : placeholder}
        </CounsellingButton>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto overflow-hidden rounded-xl p-0 shadow-lg"
        align="start"
        sideOffset={6}
      >
        {!isScheduling ? (
          <div className="border-b border-counselling-border/70 px-3 py-2.5">
            <p className="text-xs font-medium text-counselling-foreground">Quick Picks</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_PICKS.map(({ label, days }) => {
                const date = addDays(startOfDay(new Date()), days);
                const pickDisabled = disabled || isDisabledDate(date, minDate);

                return (
                  <CounsellingButton
                    key={label}
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pickDisabled}
                    className="h-8 rounded-full border border-counselling-border/80 px-3 text-xs hover:bg-counselling-accent/60"
                    onClick={() => pickDate(date)}
                  >
                    {label}
                  </CounsellingButton>
                );
              })}
            </div>
          </div>
        ) : null}

        <Calendar
          mode="single"
          selected={selected}
          disabled={minDate ? { before: minDate } : undefined}
          onSelect={(date) => {
            if (!date) return;
            pickDate(date);
          }}
          autoFocus
          captionLayout={isScheduling ? 'dropdown' : 'label'}
          startMonth={calendarStartMonth}
          endMonth={calendarEndMonth}
          className="bg-white"
          classNames={{
            today: 'bg-counselling-accent text-counselling-accent-foreground rounded-md',
          }}
        />

        <div className="border-t border-counselling-border/70 px-3 py-2 text-xs text-counselling-muted-foreground">
          {selected
            ? `Selected: ${format(selected, 'EEEE, d MMMM yyyy')}`
            : isScheduling
              ? 'Choose a surgery date from the calendar'
              : 'Choose a follow-up date from the calendar'}
        </div>
      </PopoverContent>
    </Popover>
  );
}
