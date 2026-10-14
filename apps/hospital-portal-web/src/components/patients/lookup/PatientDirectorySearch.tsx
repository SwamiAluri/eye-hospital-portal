'use client';

import { Search } from 'lucide-react';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';

export function PatientDirectorySearch({
  value,
  onChange,
  onFocusChange,
}: {
  value: string;
  onChange: (value: string) => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  return (
    <div className="relative min-w-[12rem] flex-1">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-counselling-muted-foreground/80"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        aria-label="Search patients by name, MRN, phone, or email"
        placeholder="Search name, MRN, phone, email…"
        className="flex h-9 w-full rounded-lg border border-counselling-border bg-counselling-card py-2 pl-8 pr-3 text-sm text-counselling-foreground placeholder:text-counselling-muted-foreground focus-visible:border-counselling-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-counselling-primary/25"
        data-testid={patientLookupTestIds.searchInput}
      />
    </div>
  );
}
