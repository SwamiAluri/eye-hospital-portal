'use client';

import { createContext, type ReactNode, useContext } from 'react';

const BilateralTableContext = createContext({ showLastColumn: false });

interface BilateralTableProps {
  children: ReactNode;
  showLastColumn?: boolean;
  className?: string;
}

/** Grid shell: Label | [Last] | OD | OS */
export function BilateralTable({ children, showLastColumn = false, className = '' }: BilateralTableProps) {
  const cols = showLastColumn
    ? 'grid-cols-1 lg:grid-cols-[minmax(7rem,9rem)_minmax(3.5rem,4.5rem)_minmax(5.5rem,1fr)_minmax(5.5rem,1fr)]'
    : 'grid-cols-1 lg:grid-cols-[minmax(7rem,9rem)_minmax(5.5rem,7rem)_minmax(5.5rem,7rem)]';

  return (
    <BilateralTableContext.Provider value={{ showLastColumn }}>
      <div className={`grid ${cols} gap-x-2 gap-y-2 lg:gap-y-1.5 text-sm items-start lg:items-center w-full max-w-3xl ${className}`}>
        <div className="hidden lg:block" />
        {showLastColumn && (
          <div className="hidden lg:block text-[10px] font-semibold text-slate-500 uppercase tracking-wide text-center border-b border-slate-200 pb-1">
            Last
          </div>
        )}
        <div className="hidden lg:block text-[10px] font-semibold text-blue-700 uppercase tracking-wide text-center border-b border-blue-200 pb-1">
          Right / OD
        </div>
        <div className="hidden lg:block text-[10px] font-semibold text-emerald-700 uppercase tracking-wide text-center border-b border-emerald-200 pb-1">
          Left / OS
        </div>
        {children}
      </div>
    </BilateralTableContext.Provider>
  );
}

export function BilateralRow({
  label,
  last,
  od,
  os,
}: {
  label: ReactNode;
  last?: ReactNode;
  od: ReactNode;
  os: ReactNode;
}) {
  const { showLastColumn } = useContext(BilateralTableContext);
  const odCell = (
    <div className="py-0.5 min-w-0 lg:col-auto rounded-md lg:rounded-none border border-blue-100 lg:border-0 bg-blue-50/40 lg:bg-transparent px-2 lg:px-0">
      <span className="lg:hidden text-[10px] font-semibold text-blue-700 uppercase block mb-1">
        Right / OD
      </span>
      {od}
    </div>
  );
  const osCell = (
    <div className="py-0.5 min-w-0 lg:col-auto rounded-md lg:rounded-none border border-emerald-100 lg:border-0 bg-emerald-50/40 lg:bg-transparent px-2 lg:px-0">
      <span className="lg:hidden text-[10px] font-semibold text-emerald-700 uppercase block mb-1">
        Left / OS
      </span>
      {os}
    </div>
  );
  return (
    <>
      <div className="text-gray-600 font-medium py-1 pr-2 text-xs sm:text-sm lg:col-span-1">
        {label}
      </div>
      {showLastColumn && (
        <div className="text-center text-[11px] text-slate-500 py-1 tabular-nums lg:col-auto">
          {last ?? '—'}
        </div>
      )}
      <div className="lg:contents flex flex-col gap-2 sm:contents col-span-full">
        {odCell}
        {osCell}
      </div>
    </>
  );
}

export function BilateralSectionHeader({ title }: { title: string }) {
  return (
    <div
      className="pt-2 pb-1 border-b border-slate-200 bg-slate-50 px-2 -mx-1 rounded-t"
      style={{ gridColumn: '1 / -1' }}
    >
      <h4 className="text-xs font-semibold text-slate-800">{title}</h4>
    </div>
  );
}

/** 5-col: Label | Last? | Old OD | Old OS | New OD | New OS — for Rx compare */
const RxCompareContext = createContext({ showLastColumn: false });

export function RxCompareTable({
  children,
  showLastColumn = false,
  className = '',
}: {
  children: ReactNode;
  showLastColumn?: boolean;
  className?: string;
}) {
  const cols = showLastColumn
    ? 'grid-cols-[minmax(100px,140px)_minmax(56px,72px)_repeat(4,minmax(0,1fr))]'
    : 'grid-cols-[minmax(100px,140px)_repeat(4,minmax(0,1fr))]';

  return (
    <RxCompareContext.Provider value={{ showLastColumn }}>
    <div className={`grid ${cols} gap-x-2 gap-y-1.5 text-sm items-center ${className}`}>
      <div />
      {showLastColumn && (
        <div className="text-[10px] font-semibold text-slate-500 uppercase text-center border-b border-slate-200 pb-1">
          Last
        </div>
      )}
      <div className="text-[10px] font-semibold text-gray-600 uppercase text-center border-b border-gray-300 pb-1 bg-gray-50 rounded-t">
        Old OD
      </div>
      <div className="text-[10px] font-semibold text-gray-600 uppercase text-center border-b border-gray-300 pb-1 bg-gray-50 rounded-t">
        Old OS
      </div>
      <div className="text-[10px] font-semibold text-emerald-800 uppercase text-center border-b border-emerald-300 pb-1 bg-emerald-50 rounded-t">
        New OD
      </div>
      <div className="text-[10px] font-semibold text-emerald-800 uppercase text-center border-b border-emerald-300 pb-1 bg-emerald-50 rounded-t">
        New OS
      </div>
      {children}
    </div>
    </RxCompareContext.Provider>
  );
}

export function RxCompareRow({
  label,
  last,
  oldOd,
  oldOs,
  newOd,
  newOs,
}: {
  label: ReactNode;
  last?: ReactNode;
  oldOd: ReactNode;
  oldOs: ReactNode;
  newOd: ReactNode;
  newOs: ReactNode;
}) {
  const { showLastColumn } = useContext(RxCompareContext);
  return (
    <>
      <div className="text-gray-600 font-medium py-1 pr-1 text-xs">{label}</div>
      {showLastColumn && (
        <div className="text-center text-[11px] text-slate-500 py-1">{last ?? '—'}</div>
      )}
      <div className="py-0.5 bg-gray-50/80 rounded px-0.5">{oldOd}</div>
      <div className="py-0.5 bg-gray-50/80 rounded px-0.5">{oldOs}</div>
      <div className="py-0.5 bg-emerald-50/80 rounded px-0.5">{newOd}</div>
      <div className="py-0.5 bg-emerald-50/80 rounded px-0.5">{newOs}</div>
    </>
  );
}
