'use client';

/** Pairs two MH list sections side-by-side on xl+ with aligned row heights. */
export function MhSectionRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start [&>*]:min-w-0">
      {children}
    </div>
  );
}
