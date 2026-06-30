'use client';

import { Search, X } from 'lucide-react';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { CounsellingInput } from '@/components/counsellors-desk/session/primitives/CounsellingInput';
import { cn } from '@/lib/utils';

export interface CounsellingSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** default = h-11 forms; catalog = h-9 filter bars */
  density?: 'default' | 'catalog';
  'data-testid'?: string;
}

export function CounsellingSearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  disabled,
  className,
  density = 'catalog',
  'data-testid': testId,
}: CounsellingSearchInputProps) {
  const isCatalog = density === 'catalog';

  return (
    <div className={cn('relative', className)}>
      <Search
        size={14}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-counselling-muted-foreground/80"
        aria-hidden
      />
      <CounsellingInput
        type="search"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'pl-8 pr-8',
          isCatalog && counsellingSessionTokens.catalogInput,
        )}
      />
      {value ? (
        <CounsellingButton
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label="Clear search"
          className={cn(
            'absolute right-0.5 top-1/2 -translate-y-1/2 px-0',
            isCatalog ? 'h-7 w-7' : 'h-8 w-8',
          )}
          onClick={() => onChange('')}
        >
          <X size={14} />
        </CounsellingButton>
      ) : null}
    </div>
  );
}
