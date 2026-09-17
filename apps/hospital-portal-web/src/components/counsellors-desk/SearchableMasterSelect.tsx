'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  CounsellingButton,
  CounsellingCommand,
  CounsellingCommandEmpty,
  CounsellingCommandGroup,
  CounsellingCommandInput,
  CounsellingCommandItem,
  CounsellingCommandList,
  CounsellingPopover,
  CounsellingPopoverContent,
  CounsellingPopoverTrigger,
} from '@/components/counsellors-desk/session/primitives';
import { cn } from '@/lib/utils';

export interface SearchableMasterSelectProps {
  label: string;
  value: string;
  options: { id: string; name: string }[];
  onChange: (value: string) => void;
  /** When 'id', onChange emits option.id (for foreign keys). Default 'name' preserves master-label fields. */
  emit?: 'id' | 'name';
  placeholder?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  disabled?: boolean;
  emptyMessage?: string;
  'data-testid'?: string;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[12.5px] font-medium leading-[18px] text-counselling-muted-foreground">
      {children}
    </label>
  );
}

/** Searchable counselling combobox for master-label values (e.g. anaesthesia type). */
export function SearchableMasterSelect({
  label,
  value,
  options,
  onChange,
  emit = 'name',
  placeholder = 'Select…',
  loading,
  error,
  onRetry,
  disabled,
  emptyMessage = 'No options found.',
  'data-testid': testId,
}: SearchableMasterSelectProps) {
  const [open, setOpen] = useState(false);

  const optionsWithOrphan = useMemo(() => {
    if (!value) return options;
    if (options.some((o) => o.id === value || o.name === value)) return options;
    return [{ id: value, name: value }, ...options];
  }, [options, value]);

  const selected = optionsWithOrphan.find((o) => o.id === value || o.name === value);

  if (loading) {
    return (
      <div>
        <FieldLabel>{label}</FieldLabel>
        <p className="text-sm text-counselling-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <FieldLabel>{label}</FieldLabel>
        <p className="text-sm text-counselling-muted-foreground">Unable to load options.</p>
        {onRetry ? (
          <CounsellingButton type="button" size="sm" variant="outline" className="mt-2 h-8 text-xs" onClick={onRetry}>
            Retry
          </CounsellingButton>
        ) : null}
      </div>
    );
  }

  return (
    <div data-testid={testId}>
      <FieldLabel>{label}</FieldLabel>
      <CounsellingPopover open={open} onOpenChange={setOpen}>
        <CounsellingPopoverTrigger asChild>
          <CounsellingButton
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'h-10 w-full justify-between px-3 font-normal',
              !selected && 'text-counselling-muted-foreground',
            )}
          >
            <span className="truncate">{selected?.name ?? placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </CounsellingButton>
        </CounsellingPopoverTrigger>
        <CounsellingPopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          collisionPadding={16}
        >
          <CounsellingCommand>
            <CounsellingCommandInput placeholder={`Search ${label.toLowerCase()}…`} />
            <CounsellingCommandList>
              <CounsellingCommandEmpty>{emptyMessage}</CounsellingCommandEmpty>
              <CounsellingCommandGroup>
                {optionsWithOrphan.map((o) => (
                  <CounsellingCommandItem
                    key={o.id}
                    value={o.name}
                    onSelect={() => {
                      onChange(emit === 'id' ? o.id : o.name);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        value === o.name || value === o.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {o.name}
                  </CounsellingCommandItem>
                ))}
              </CounsellingCommandGroup>
            </CounsellingCommandList>
          </CounsellingCommand>
        </CounsellingPopoverContent>
      </CounsellingPopover>
    </div>
  );
}
