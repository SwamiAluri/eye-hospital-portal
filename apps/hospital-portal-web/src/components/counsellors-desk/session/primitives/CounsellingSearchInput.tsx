'use client';

import { Search, X } from 'lucide-react';
import { CounsellingButton } from '@/components/counsellors-desk/session/primitives/CounsellingButton';
import { CounsellingInput } from '@/components/counsellors-desk/session/primitives/CounsellingInput';
import { cn } from '@/lib/utils';

export interface CounsellingSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function CounsellingSearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  disabled,
  className,
  'data-testid': testId,
}: CounsellingSearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-counselling-muted-foreground/80"
        aria-hidden
      />
      <CounsellingInput
        type="search"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-9"
      />
      {value ? (
        <CounsellingButton
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label="Clear search"
          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 px-0"
          onClick={() => onChange('')}
        >
          <X size={14} />
        </CounsellingButton>
      ) : null}
    </div>
  );
}
