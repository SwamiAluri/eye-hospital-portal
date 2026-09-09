'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  findAnesthetistsByDisplayName,
  formatAnesthetistDistinguisher,
  type AnesthetistOption,
  type AnesthetistUiMode,
} from '@/lib/counsellors-desk/anesthetist-name-match';
import {
  CounsellingButton,
  CounsellingCommand,
  CounsellingCommandEmpty,
  CounsellingCommandGroup,
  CounsellingCommandInput,
  CounsellingCommandItem,
  CounsellingCommandList,
  CounsellingInfoAlert,
  CounsellingPopover,
  CounsellingPopoverContent,
  CounsellingPopoverTrigger,
} from '@/components/counsellors-desk/session/primitives';
import { cn } from '@/lib/utils';

export const OTHER_ANESTHETIST_VALUE = '__other__';

export interface AnesthetistSelectProps {
  staff: AnesthetistOption[];
  mode: AnesthetistUiMode;
  /** Staff user id when mode=list; null when empty or other. */
  selectedStaffId: string | null;
  /** Persisted display name (list or manual). */
  anesthetistName: string;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  onRetry?: () => void;
  onSelectStaff: (staff: AnesthetistOption) => void;
  onSelectOther: () => void;
  onManualNameChange: (name: string) => void;
  className?: string;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[12.5px] font-medium leading-[18px] text-counselling-muted-foreground">
      {children}
    </label>
  );
}

/** Database-backed anaesthetist picker with Other / Not listed + duplicate guidance. */
export function AnesthetistSelect({
  staff,
  mode,
  selectedStaffId,
  anesthetistName,
  loading,
  error,
  disabled,
  onRetry,
  onSelectStaff,
  onSelectOther,
  onManualNameChange,
  className,
}: AnesthetistSelectProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => (selectedStaffId ? staff.find((s) => s.id === selectedStaffId) ?? null : null),
    [staff, selectedStaffId],
  );

  const matches = useMemo(
    () => (mode === 'other' ? findAnesthetistsByDisplayName(anesthetistName, staff) : []),
    [mode, anesthetistName, staff],
  );

  const triggerLabel = (() => {
    if (mode === 'other') return 'Other / Not listed';
    if (selected) return selected.name;
    if (anesthetistName && mode === 'list') return anesthetistName;
    return 'Select anaesthetist';
  })();

  if (loading) {
    return (
      <div className={className} data-testid="anesthetist-select-loading">
        <FieldLabel>Anaesthetist</FieldLabel>
        <p className="text-sm text-counselling-muted-foreground">Loading anaesthetists…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className} data-testid="anesthetist-select-error">
        <FieldLabel>Anaesthetist</FieldLabel>
        <CounsellingInfoAlert
          variant="warning"
          title="Unable to load anaesthetists."
          action={
            onRetry ? (
              <CounsellingButton type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onRetry}>
                Retry
              </CounsellingButton>
            ) : undefined
          }
        >
          Please try again.
        </CounsellingInfoAlert>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)} data-testid="anesthetist-select">
      <div>
        <FieldLabel>Anaesthetist</FieldLabel>
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
                !selected && mode !== 'other' && 'text-counselling-muted-foreground',
              )}
              data-testid="anesthetist-select-trigger"
            >
              <span className="truncate">{triggerLabel}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </CounsellingButton>
          </CounsellingPopoverTrigger>
          <CounsellingPopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0"
            align="start"
            collisionPadding={16}
          >
            <CounsellingCommand>
              <CounsellingCommandInput placeholder="Search anaesthetists…" />
              <CounsellingCommandList>
                <CounsellingCommandEmpty>
                  {staff.length === 0 ? 'No anaesthetists found.' : 'No matching anaesthetists.'}
                </CounsellingCommandEmpty>
                {staff.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-counselling-muted-foreground" data-testid="anesthetist-select-empty">
                    No staff with an Anaesthetist role are configured. Use Other / Not listed, or ask admin to assign the role.
                  </div>
                ) : null}
                <CounsellingCommandGroup>
                  {staff.map((a) => {
                    const sub = formatAnesthetistDistinguisher(a);
                    return (
                      <CounsellingCommandItem
                        key={a.id}
                        value={`${a.name} ${a.employeeId ?? ''} ${a.jobTitle ?? ''} ${a.specialization ?? ''}`}
                        onSelect={() => {
                          onSelectStaff(a);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4 shrink-0',
                            mode === 'list' && selectedStaffId === a.id ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{a.name}</span>
                          {sub ? (
                            <span className="block truncate text-[11px] text-counselling-muted-foreground">{sub}</span>
                          ) : null}
                        </span>
                      </CounsellingCommandItem>
                    );
                  })}
                  <CounsellingCommandItem
                    value="Other Not listed"
                    onSelect={() => {
                      onSelectOther();
                      setOpen(false);
                    }}
                    data-testid="anesthetist-select-other"
                  >
                    <Check
                      className={cn('mr-2 h-4 w-4 shrink-0', mode === 'other' ? 'opacity-100' : 'opacity-0')}
                    />
                    <span className="font-medium">Other / Not listed</span>
                  </CounsellingCommandItem>
                </CounsellingCommandGroup>
              </CounsellingCommandList>
            </CounsellingCommand>
          </CounsellingPopoverContent>
        </CounsellingPopover>
      </div>

      {mode === 'other' && (
        <div>
          <FieldLabel>Anaesthetist Name</FieldLabel>
          <input
            type="text"
            value={anesthetistName}
            onChange={(e) => onManualNameChange(e.target.value)}
            disabled={disabled}
            placeholder="Enter anaesthetist name"
            aria-invalid={matches.length > 0}
            aria-describedby={matches.length > 0 ? 'anesthetist-duplicate-warning' : undefined}
            className={cn(
              'w-full rounded-lg border border-counselling-border bg-counselling-card px-3 py-2 text-sm outline-none transition-colors hover:border-counselling-primary/40 focus:border-counselling-primary/60 focus:ring-2 focus:ring-counselling-primary/25',
              matches.length > 0 && 'border-amber-400',
            )}
            data-testid="anesthetist-manual-name"
          />

          {matches.length > 0 && (
            <div
              id="anesthetist-duplicate-warning"
              className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5"
              role="alert"
              data-testid="anesthetist-duplicate-warning"
            >
              <p className="text-sm font-medium text-amber-950">
                An anaesthetist with this name already exists.
              </p>
              <p className="text-xs text-amber-900">
                Select the existing staff member instead of keeping a manual entry.
              </p>
              <ul className="space-y-2">
                {matches.map((m) => {
                  const sub = formatAnesthetistDistinguisher(m);
                  return (
                    <li
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200/80 bg-white px-2.5 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-counselling-foreground">{m.name}</p>
                        {sub ? (
                          <p className="truncate text-[11px] text-counselling-muted-foreground">{sub}</p>
                        ) : (
                          <p className="truncate text-[11px] text-counselling-muted-foreground">ID: {m.id.slice(0, 8)}…</p>
                        )}
                      </div>
                      <CounsellingButton
                        type="button"
                        size="sm"
                        className="h-8 shrink-0 bg-counselling-primary text-xs text-white hover:bg-counselling-primary/90"
                        onClick={() => onSelectStaff(m)}
                        data-testid={`anesthetist-select-existing-${m.id}`}
                      >
                        Select existing
                      </CounsellingButton>
                    </li>
                  );
                })}
              </ul>
              <CounsellingButton
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => onManualNameChange('')}
                data-testid="anesthetist-use-different-name"
              >
                Use a different name
              </CounsellingButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
