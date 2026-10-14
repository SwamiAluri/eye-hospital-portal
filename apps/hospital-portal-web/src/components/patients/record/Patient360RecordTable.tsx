'use client';

import type { ReactNode } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export const patient360LinkClass =
  'inline-flex text-sm font-medium text-emerald-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 rounded-sm';

export function Patient360Section({
  id,
  title,
  heading = 'h3',
  children,
}: {
  id?: string;
  title: string;
  heading?: 'h3' | 'h4';
  children: ReactNode;
}) {
  const HeadingTag = heading;
  return (
    <section id={id} className="min-w-0 scroll-mt-4">
      <HeadingTag className="text-sm font-semibold text-gray-900">{title}</HeadingTag>
      <div className="mt-1.5 space-y-1.5 text-sm text-gray-700">{children}</div>
    </section>
  );
}

export function patient360Honesty(
  result: { state: string; rows: unknown[] } | null | undefined,
  copy: { empty: string; unauthorized: string; unavailable: string; loading: string },
): string | undefined {
  if (!result) return copy.loading;
  if (result.state === 'unauthorized') return copy.unauthorized;
  if (result.state === 'unavailable') return copy.unavailable;
  if (result.rows.length === 0) return copy.empty;
  return undefined;
}

const PATIENT_360_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatPatient360Date(value: string | null | undefined): string {
  if (!value) return '—';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2})?)?/);
  if (!match) return value;
  const month = PATIENT_360_MONTHS[Number(match[2]) - 1];
  if (!month) return value;
  const day = `${match[3]} ${month} ${match[1]}`;
  const time = match[4];
  if (!time || time === '00:00') return day;
  return `${day} ${time}`;
}

function formatPatient360Clock(hhmm: string): string {
  const [hourRaw, minute] = hhmm.split(':');
  const hour = Number(hourRaw);
  if (!Number.isFinite(hour) || minute == null) return hhmm;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${minute} ${suffix}`;
}

export function formatPatient360DateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2})?)?/);
  if (!match) return value;
  const month = PATIENT_360_MONTHS[Number(match[2]) - 1];
  if (!month) return value;
  const day = `${match[3]} ${month} ${match[1]}`;
  return match[4] ? `${day} · ${formatPatient360Clock(match[4])}` : day;
}

export function Patient360RecordTable({
  caption,
  columns,
  rows,
  emptyState,
  footerState,
}: {
  caption: string;
  columns: { header: string; srOnly?: boolean; align?: 'left' | 'right'; className?: string }[];
  rows: { id: string; cells: ReactNode[] }[];
  emptyState?: ReactNode;
  footerState?: ReactNode;
}) {
  return (
    <Table caption={caption} className="min-w-[40rem]">
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.header}
              className={cn(column.srOnly && 'w-px', column.align === 'right' && 'text-right', column.className)}
            >
              {column.srOnly ? <span className="sr-only">{column.header}</span> : column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length > 0 ? (
          rows.map((row) => (
            <TableRow key={row.id}>
              {row.cells.map((cell, index) => (
                <TableCell
                  key={`${row.id}-${index}`}
                  className={cn(
                    columns[index]?.align === 'right' && 'text-right tabular-nums',
                    columns[index]?.className,
                  )}
                >
                  {cell ?? '—'}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={Math.max(columns.length, 1)} className="text-gray-700">
              <span role="status">{emptyState ?? 'No records'}</span>
            </TableCell>
          </TableRow>
        )}
        {rows.length > 0 && footerState ? (
          <TableRow>
            <TableCell colSpan={Math.max(columns.length, 1)} className="text-gray-700">
              <span role="status">{footerState}</span>
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}

export function Patient360Status({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-sm text-gray-700">
      {children}
    </p>
  );
}

export function Patient360DetailSheet({
  trigger,
  title,
  children,
}: {
  trigger: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger className={patient360LinkClass}>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2 text-sm text-gray-700">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function truncatePatient360Text(value: string, max = 48): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}
