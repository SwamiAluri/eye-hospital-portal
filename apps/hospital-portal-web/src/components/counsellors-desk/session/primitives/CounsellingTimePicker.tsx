'use client';

import { useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import {
  formatCounsellingTimeDisplay,
  parseCounsellingTimeParts,
  partsToHhMm,
  type CounsellingTimePeriod,
} from '@/lib/counsellors-desk/counselling-time';
import { CounsellingButton } from './CounsellingButton';
import { Popover, PopoverContent, PopoverTrigger } from './CounsellingPopover';
import { cn } from '@/lib/utils';

export interface CounsellingTimePickerProps {
  value: string;
  onChange: (hhMm: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'data-testid'?: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const PERIODS: CounsellingTimePeriod[] = ['AM', 'PM'];

/**
 * Compact 12-hour time popover for counselling / finalize OT forms.
 * Value contract: `HH:mm` 24-hour string (same as native time inputs).
 */
export function CounsellingTimePicker({
  value,
  onChange,
  disabled,
  placeholder = '--:-- --',
  id,
  className,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'data-testid': testId,
}: CounsellingTimePickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseCounsellingTimeParts(value), [value]);
  const display = formatCounsellingTimeDisplay(value) || placeholder;

  const draft = parsed ?? { hour12: 9, minute: 0, period: 'AM' as CounsellingTimePeriod };

  const commit = (next: { hour12: number; minute: number; period: CounsellingTimePeriod }) => {
    onChange(partsToHhMm(next));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <CounsellingButton
          type="button"
          id={id}
          variant="outline"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          data-testid={testId}
          className={cn(
            'h-10 w-full justify-between gap-2 px-3 font-normal',
            !value && 'text-counselling-muted-foreground',
            value && 'border-counselling-primary/30 bg-counselling-accent/40',
            ariaInvalid && 'border-red-400',
            className,
          )}
        >
          <span className="tabular-nums">{display}</span>
          <Clock className="h-4 w-4 shrink-0 text-counselling-primary/70" aria-hidden />
        </CounsellingButton>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(100vw-2rem,280px)] p-3"
        align="start"
        sideOffset={6}
        collisionPadding={16}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Select time">
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-counselling-muted-foreground">Hour</p>
            <div className="max-h-40 overflow-y-auto overscroll-contain rounded-md border border-counselling-border/80">
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-center px-2 py-1.5 text-sm tabular-nums outline-none focus-visible:bg-counselling-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-counselling-primary/40',
                    draft.hour12 === h && 'bg-counselling-primary/15 font-semibold text-counselling-primary',
                  )}
                  onClick={() => commit({ ...draft, hour12: h })}
                >
                  {String(h).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-counselling-muted-foreground">Minute</p>
            <div className="max-h-40 overflow-y-auto overscroll-contain rounded-md border border-counselling-border/80">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={cn(
                    'flex w-full items-center justify-center px-2 py-1.5 text-sm tabular-nums outline-none focus-visible:bg-counselling-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-counselling-primary/40',
                    draft.minute === m && 'bg-counselling-primary/15 font-semibold text-counselling-primary',
                  )}
                  onClick={() => commit({ ...draft, minute: m })}
                >
                  {String(m).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-counselling-muted-foreground">Period</p>
            <div className="flex flex-col gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={cn(
                    'rounded-md border border-counselling-border/80 px-2 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40',
                    draft.period === p && 'border-counselling-primary/40 bg-counselling-primary/15 text-counselling-primary',
                  )}
                  onClick={() => commit({ ...draft, period: p })}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-counselling-border/70 pt-2">
          <p className="text-xs tabular-nums text-counselling-muted-foreground">
            {formatCounsellingTimeDisplay(partsToHhMm(draft)) || placeholder}
          </p>
          <CounsellingButton type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setOpen(false)}>
            Done
          </CounsellingButton>
        </div>
      </PopoverContent>
    </Popover>
  );
}
