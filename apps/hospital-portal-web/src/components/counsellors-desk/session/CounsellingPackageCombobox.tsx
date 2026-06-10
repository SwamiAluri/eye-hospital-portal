'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { formatInr } from '@/lib/counsellors-desk/package-preview';
import type { CounsellingPackageTemplate } from '@/types/counselling-estimate';
import { counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
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

export interface CounsellingPackageComboboxProps {
  templates: CounsellingPackageTemplate[];
  selectedTemplateId: string | null;
  disabled?: boolean;
  placeholder?: string;
  onSelect: (template: CounsellingPackageTemplate) => void;
  className?: string;
}

export function CounsellingPackageCombobox({
  templates,
  selectedTemplateId,
  disabled,
  placeholder = 'Search packages by name or code…',
  onSelect,
  className,
}: CounsellingPackageComboboxProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, CounsellingPackageTemplate[]>();
    templates.forEach((t) => {
      const cat = t.category ?? 'Other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(t);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [templates]);

  return (
    <CounsellingPopover open={open} onOpenChange={setOpen}>
      <CounsellingPopoverTrigger asChild>
        <CounsellingButton
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          data-testid={counsellingTestIds.packageSearch}
          className={cn(
            'w-full justify-between font-normal text-counselling-foreground',
            !selected && 'text-counselling-muted-foreground',
            className,
          )}
        >
          <span className="truncate">
            {selected ? `${selected.name} · ${formatInr(selected.packageAmount)}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </CounsellingButton>
      </CounsellingPopoverTrigger>
      <CounsellingPopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <CounsellingCommand>
          <CounsellingCommandInput placeholder={placeholder} />
          <CounsellingCommandList>
            <CounsellingCommandEmpty>No packages found.</CounsellingCommandEmpty>
            {grouped.map(([category, items]) => (
              <CounsellingCommandGroup key={category} heading={category}>
                {items.map((t) => (
                  <CounsellingCommandItem
                    key={t.id}
                    value={`${t.name} ${t.code} ${t.category ?? ''}`}
                    onSelect={() => {
                      onSelect(t);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        selectedTemplateId === t.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    <span className="ml-2 shrink-0 text-xs tabular-nums text-counselling-muted-foreground">
                      {formatInr(t.packageAmount)}
                    </span>
                  </CounsellingCommandItem>
                ))}
              </CounsellingCommandGroup>
            ))}
          </CounsellingCommandList>
        </CounsellingCommand>
      </CounsellingPopoverContent>
    </CounsellingPopover>
  );
}
