'use client';

/**
 * Directory-scoped DOB control (not SessionDatePicker).
 * Manual DD/MM/YYYY entry + calendar; emits yyyy-MM-dd for URL/API.
 * Visible inline prefix (e.g. "DOB From:" / "To:") — no label above the field.
 */

import { useEffect, useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/counsellors-desk/session/primitives/CounsellingPopover';
import {
  DIRECTORY_DOB_PLACEHOLDER,
  directoryDobLatestSelectableDate,
  isoToDirectoryDobDisplay,
  parseDirectoryDobDisplay,
  sanitizeDirectoryDobInput,
} from '@/lib/patients/patient-directory-dob';
import { cn } from '@/lib/utils';

export function PatientDirectoryDobField({
  id,
  label,
  prefix,
  value,
  onCommit,
  className,
  'data-testid': testId,
}: {
  id: string;
  /** Accessible name (e.g. "DOB From" / "DOB To") — not the visual prefix. */
  label: string;
  /** Compact inline visual prefix (e.g. "DOB From:" / "To:"). */
  prefix: string;
  /** ISO yyyy-MM-dd from URL state */
  value?: string;
  /** Called only with valid ISO or undefined (cleared). Never with invalid dates. */
  onCommit: (isoDate: string | undefined) => void;
  /** Optional width override for longer prefixes (DOB From). */
  className?: string;
  'data-testid'?: string;
}) {
  const [text, setText] = useState(() => isoToDirectoryDobDisplay(value));
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const latestDob = directoryDobLatestSelectableDate();

  useEffect(() => {
    setText(isoToDirectoryDobDisplay(value));
    setInvalid(false);
  }, [value]);

  const selected = (() => {
    if (!value) return undefined;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : undefined;
  })();

  const commitDisplay = (display: string) => {
    const parsed = parseDirectoryDobDisplay(display);
    if (parsed.status === 'empty') {
      setInvalid(false);
      if (value) onCommit(undefined);
      return;
    }
    if (parsed.status === 'incomplete') {
      setInvalid(false);
      return;
    }
    if (parsed.status === 'invalid') {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (parsed.iso !== value) onCommit(parsed.iso);
  };

  return (
    <div
      className={cn(
        'flex h-9 shrink-0 items-center gap-1 rounded-lg border bg-counselling-card pl-2 pr-1',
        // Content-sized: longer "DOB From:" prefix gets more width; date slot stays fixed.
        'w-auto',
        invalid
          ? 'border-red-500'
          : 'border-counselling-border focus-within:border-counselling-primary/60 focus-within:ring-2 focus-within:ring-counselling-primary/25',
        className,
      )}
    >
      <span
        className="shrink-0 select-none whitespace-nowrap text-xs font-medium text-counselling-muted-foreground"
        aria-hidden
      >
        {prefix}
      </span>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        value={text}
        placeholder={DIRECTORY_DOB_PLACEHOLDER}
        aria-label={label}
        aria-invalid={invalid || undefined}
        data-testid={testId}
        className="w-[8.75rem] min-w-[8.75rem] shrink-0 border-0 bg-transparent py-0 text-sm tabular-nums tracking-normal text-counselling-foreground placeholder:text-counselling-muted-foreground focus-visible:outline-none"
        onChange={(event) => {
          const next = sanitizeDirectoryDobInput(event.target.value);
          setText(next);
          const parsed = parseDirectoryDobDisplay(next);
          if (parsed.status === 'valid') {
            setInvalid(false);
            if (parsed.iso !== value) onCommit(parsed.iso);
          } else if (parsed.status === 'empty') {
            setInvalid(false);
            if (value) onCommit(undefined);
          } else if (parsed.status === 'invalid') {
            setInvalid(true);
          } else {
            setInvalid(false);
          }
        }}
        onBlur={() => commitDisplay(text)}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-counselling-muted-foreground hover:bg-counselling-muted/40 hover:text-counselling-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/40"
            aria-label={`${label} calendar`}
          >
            <CalendarIcon className="h-3.5 w-3.5" aria-hidden />
          </button>
        </PopoverTrigger>
        {/*
          align="end": popover's right edge tracks the calendar button (right of the field),
          so the panel sits under this field — not under the neighbouring DOB control.
        */}
        <PopoverContent
          className="w-auto overflow-hidden rounded-xl p-0 shadow-lg"
          align="end"
          side="bottom"
          sideOffset={6}
          avoidCollisions={false}
        >
          <Calendar
            mode="single"
            selected={selected}
            captionLayout="dropdown"
            startMonth={new Date(1920, 0)}
            endMonth={latestDob}
            disabled={{ after: latestDob }}
            defaultMonth={selected && selected <= latestDob ? selected : latestDob}
            onSelect={(date) => {
              if (!date) return;
              if (date > latestDob) return;
              const iso = format(date, 'yyyy-MM-dd');
              setText(isoToDirectoryDobDisplay(iso));
              setInvalid(false);
              setOpen(false);
              if (iso !== value) onCommit(iso);
            }}
            autoFocus
            className="bg-white"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
