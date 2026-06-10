'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { priceSuffix } from '@/lib/api/service-catalog.api';
import { sanitizeVariantName } from '@/lib/utils/sanitize-names';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
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

export interface CounsellingProcedureComboboxProps {
  variants: CounsellorProcedureVariant[];
  selectedVariantId: string | null;
  disabled?: boolean;
  placeholder?: string;
  onSelect: (variant: CounsellorProcedureVariant) => void;
  className?: string;
}

/** Command palette combobox for procedure search and selection (P4). */
export function CounsellingProcedureCombobox({
  variants,
  selectedVariantId,
  disabled,
  placeholder = 'Search by procedure name or code…',
  onSelect,
  className,
}: CounsellingProcedureComboboxProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => variants.find((v) => v.id === selectedVariantId) ?? null,
    [variants, selectedVariantId],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, CounsellorProcedureVariant[]>();
    variants.forEach((v) => {
      const cat = v.categoryName || v.categoryCode || 'Other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(v);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [variants]);

  return (
    <CounsellingPopover open={open} onOpenChange={setOpen}>
      <CounsellingPopoverTrigger asChild>
        <CounsellingButton
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          data-testid={counsellingTestIds.procedureSearch}
          className={cn(
            'w-full justify-between font-normal text-counselling-foreground',
            !selected && 'text-counselling-muted-foreground',
            className,
          )}
        >
          <span className="truncate">
            {selected
              ? `${sanitizeVariantName(selected.name)} · ₹${selected.price.toLocaleString('en-IN')}${priceSuffix(selected.priceType)}`
              : placeholder}
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
            <CounsellingCommandEmpty>No procedures found.</CounsellingCommandEmpty>
            {grouped.map(([category, items]) => (
              <CounsellingCommandGroup key={category} heading={category}>
                {items.map((v) => (
                  <CounsellingCommandItem
                    key={v.id}
                    value={`${v.name} ${v.code} ${v.categoryName}`}
                    onSelect={() => {
                      onSelect(v);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        selectedVariantId === v.id ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{sanitizeVariantName(v.name)}</span>
                      {v.code && (
                        <span className="text-[10px] text-counselling-muted-foreground">{v.code}</span>
                      )}
                    </span>
                    <span className="ml-2 shrink-0 text-xs tabular-nums text-counselling-muted-foreground">
                      ₹{v.price.toLocaleString('en-IN')}
                      {priceSuffix(v.priceType)}
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
