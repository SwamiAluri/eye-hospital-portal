'use client';

import { useEffect, useMemo, useState } from 'react';
import { usersApi } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type PlatformUserOption = {
  id: string;
  displayName: string;
  email?: string | null;
  userStatus?: string | null;
};

type Props = {
  id: string;
  label: string;
  value: string | null;
  displayValue?: string | null;
  onChange: (userId: string, displayName: string) => void;
  disabled?: boolean;
  required?: boolean;
};

export function OrderProviderPicker({
  id,
  label,
  value,
  displayValue,
  onChange,
  disabled,
  required,
}: Props) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<PlatformUserOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void usersApi
      .getAll()
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        setUsers(
          rows
            .map((u: Record<string, unknown>) => ({
              id: String(u.id),
              displayName:
                `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() ||
                String(u.userName ?? u.email ?? u.id),
              email: (u.email as string | null) ?? null,
              userStatus: (u.userStatus as string | null) ?? null,
            }))
            .filter((u) => !u.userStatus || u.userStatus.toLowerCase() === 'active'),
        );
        setLoadError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setUsers([]);
          setLoadError('Unable to load users. Enter a known user ID if available.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users.slice(0, 12);
    return users
      .filter(
        (u) =>
          u.displayName.toLowerCase().includes(q) ||
          (u.email ?? '').toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [users, query]);

  const shown = value
    ? displayValue || users.find((u) => u.id === value)?.displayName || value
    : '';

  return (
    <div className="space-y-1.5" data-testid={`provider-picker-${id}`}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {value ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{shown}</span>
          <button
            type="button"
            className="text-xs text-muted-foreground underline disabled:opacity-50"
            disabled={disabled}
            onClick={() => {
              onChange('', '');
              setQuery('');
              setOpen(true);
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <Input
            id={id}
            value={query}
            disabled={disabled}
            placeholder="Search active users by name"
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
          {open && filtered.length > 0 ? (
            <ul
              className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-background shadow-md"
              role="listbox"
            >
              {filtered.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted',
                    )}
                    onClick={() => {
                      onChange(u.id, u.displayName);
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    <span className="font-medium">{u.displayName}</span>
                    {u.email ? (
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      {loadError ? <p className="text-xs text-amber-700">{loadError}</p> : null}
    </div>
  );
}
