'use client';

import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ExamSelectFieldProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  priorValue?: string;
  className?: string;
  'aria-label'?: string;
  /** Show filter input inside popover (long lists). */
  searchable?: boolean;
}

/** Single-box select appearance (value + ▼ inside one border), portaled list. */
export function ExamSelectField({
  value,
  options,
  onChange,
  disabled,
  placeholder = 'Select',
  priorValue,
  className = '',
  'aria-label': ariaLabel,
  searchable = false,
}: ExamSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const optionsWithLegacy = useMemo(() => {
    if (value && !options.includes(value)) return [value, ...options];
    return options;
  }, [options, value]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!searchable || !q) return optionsWithLegacy.slice(0, 80);
    return optionsWithLegacy.filter((o) => o.toLowerCase().includes(q)).slice(0, 80);
  }, [optionsWithLegacy, filter, searchable]);

  const pick = (opt: string) => {
    onChange(opt);
    setFilter('');
    setOpen(false);
  };

  const display = value || placeholder;
  const isPlaceholder = !value;

  return (
    <div className={cn('relative min-w-0 w-full max-w-[8.5rem]', className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (disabled) return;
          setOpen(next);
          if (!next) setFilter('');
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            className={cn(
              'flex w-full items-center justify-between gap-1 rounded-md border border-gray-300 bg-white px-2 h-10 md:h-9 text-left',
              'focus:outline-none focus:ring-2 focus:ring-emerald-500',
              'disabled:bg-gray-100 disabled:cursor-not-allowed',
            )}
          >
            <span
              className={cn(
                'truncate text-xs font-mono flex-1',
                isPlaceholder ? 'text-gray-400' : 'text-gray-900',
              )}
            >
              {display}
            </span>
            <ChevronDown className="w-4 h-4 shrink-0 text-gray-500 pointer-events-none" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-[8.5rem] max-w-[14rem] p-0"
          align="start"
          side="bottom"
          sideOffset={4}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {searchable && (
            <div className="p-2 border-b border-gray-100">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Type to filter…"
                className="w-full h-8 px-2 text-xs font-mono border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}
          <ul className="max-h-48 overflow-y-auto py-1 text-sm font-mono">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-gray-500 text-xs">No matches</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt}>
                  <button
                    type="button"
                    className={cn(
                      'w-full text-left px-3 py-1.5 hover:bg-emerald-50 text-xs',
                      value === opt && 'bg-emerald-50 font-semibold text-emerald-900',
                    )}
                    onClick={() => pick(opt)}
                  >
                    {opt}
                  </button>
                </li>
              ))
            )}
          </ul>
        </PopoverContent>
      </Popover>
      {priorValue && (
        <p className="text-[11px] text-slate-500 mt-0.5">
          Last: <span className="font-medium">{priorValue}</span>
        </p>
      )}
    </div>
  );
}
