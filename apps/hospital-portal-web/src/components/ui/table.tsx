import * as React from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & {
    caption?: string
  }
>(({ className, caption, ...props }, ref) => (
  <div className="w-full overflow-auto">
    <table
      ref={ref}
      className={cn('w-full caption-bottom text-sm', className)}
      role="table"
      {...props}
    >
      {caption && <caption className="sr-only">{caption}</caption>}
      {props.children}
    </table>
  </div>
))
Table.displayName = 'Table'

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement> & {
    sticky?: boolean
  }
>(({ className, sticky = false, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      '[&_tr]:border-b bg-gray-50',
      sticky && 'sticky top-0 z-10',
      className
    )}
    {...props}
  />
))
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
))
TableBody.displayName = 'TableBody'

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn('bg-gray-50 font-medium text-gray-900 border-t-2 border-gray-200', className)}
    {...props}
  />
))
TableFooter.displayName = 'TableFooter'

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & {
    zebra?: boolean
  }
>(({ className, zebra = false, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-gray-100 transition-colors hover:bg-gray-50',
      'data-[state=selected]:bg-emerald-50',
      zebra && 'even:bg-gray-50',
      className
    )}
    {...props}
  />
))
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & {
    sortable?: boolean
    sortDirection?: 'asc' | 'desc' | 'none'
    onSort?: () => void
  }
>(({ className, sortable = false, sortDirection = 'none', onSort, children, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-12 px-4 text-left align-middle font-semibold text-gray-600 [&:has([role=checkbox])]:pr-0',
      sortable && 'cursor-pointer select-none hover:bg-gray-100',
      className
    )}
    aria-sort={sortable && sortDirection ? (sortDirection === 'none' ? undefined : sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
    onClick={sortable ? onSort : undefined}
    {...props}
  >
    {sortable ? (
      <div className="flex items-center gap-2">
        {children}
        {sortDirection === 'asc' ? (
          <ArrowUp className="h-4 w-4 text-emerald-600" />
        ) : sortDirection === 'desc' ? (
          <ArrowDown className="h-4 w-4 text-emerald-600" />
        ) : (
          <ArrowUpDown className="h-4 w-4 text-gray-400" />
        )}
      </div>
    ) : (
      children
    )}
  </th>
))
TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
    {...props}
  />
))
TableCell.displayName = 'TableCell'

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-sm text-slate-500 dark:text-slate-400', className)}
    {...props}
  />
))
TableCaption.displayName = 'TableCaption'

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}