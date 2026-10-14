'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  listLmsOrderables,
  parseLmsOrderApiError,
  type LmsOrderableItemDto,
  type LmsOrderSelectionInput,
} from '@/lib/lms/lms-orders.api';

export type SelectedOrderable = {
  catalogueItemId: string;
  displayName: string;
  internalOrderCode: string;
  catalogueType: string;
};

type Props = {
  operatingBranchId: string | null;
  selected: SelectedOrderable[];
  onChange: (next: SelectedOrderable[]) => void;
  disabled?: boolean;
};

export function OrderablesPicker({ operatingBranchId, selected, onChange, disabled }: Props) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<LmsOrderableItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!operatingBranchId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await listLmsOrderables({
        operatingBranchId,
        search: search.trim() || undefined,
        page: 1,
        pageSize: 25,
      });
      setItems(result.items);
    } catch (e) {
      setError(parseLmsOrderApiError(e, 'Failed to load orderables.').message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [operatingBranchId, search]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const selectedIds = new Set(selected.map((s) => s.catalogueItemId));

  const add = (item: LmsOrderableItemDto) => {
    if (selectedIds.has(item.catalogueItemId)) return;
    onChange([
      ...selected,
      {
        catalogueItemId: item.catalogueItemId,
        displayName: item.displayName,
        internalOrderCode: item.internalOrderCode,
        catalogueType: item.catalogueType,
      },
    ]);
  };

  const remove = (id: string) => {
    onChange(selected.filter((s) => s.catalogueItemId !== id));
  };

  return (
    <div className="space-y-3" data-testid="orderables-picker">
      <div>
        <Label htmlFor="orderables-search">Tests & panels</Label>
        <div className="relative mt-1.5">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="orderables-search"
            className="pl-8"
            placeholder="Search orderables (Active, branch-applicable)"
            value={search}
            disabled={disabled || !operatingBranchId}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!operatingBranchId ? (
          <p className="mt-1 text-xs text-muted-foreground">Select an operating branch to load orderables.</p>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive" data-testid="orderables-error">
          {error}
        </p>
      ) : null}

      <div className="max-h-40 overflow-auto rounded-md border" data-testid="orderables-results">
        {loading ? (
          <p className="p-3 text-sm text-muted-foreground">Loading orderables…</p>
        ) : items.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No orderables match.</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li
                key={item.catalogueItemId}
                className="flex items-center justify-between gap-2 border-b px-3 py-2 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.internalOrderCode} · {item.catalogueType}
                    {item.classification === 'REFERRAL' ? ' · Referral' : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled || selectedIds.has(item.catalogueItemId)}
                  onClick={() => add(item)}
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div data-testid="orderables-selected">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Selected ({selected.length})
        </p>
        {selected.length === 0 ? (
          <p className="text-sm text-muted-foreground">No selections yet.</p>
        ) : (
          <ul className="space-y-1">
            {selected.map((s) => (
              <li
                key={s.catalogueItemId}
                className="flex items-center justify-between rounded border px-2 py-1.5 text-sm"
              >
                <span className="truncate">
                  {s.displayName}{' '}
                  <span className="text-muted-foreground">({s.internalOrderCode})</span>
                </span>
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
                  disabled={disabled}
                  aria-label={`Remove ${s.displayName}`}
                  onClick={() => remove(s.catalogueItemId)}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function toSelectionInputs(selected: SelectedOrderable[]): LmsOrderSelectionInput[] {
  return selected.map((s, i) => ({ catalogueItemId: s.catalogueItemId, sortOrder: i }));
}
