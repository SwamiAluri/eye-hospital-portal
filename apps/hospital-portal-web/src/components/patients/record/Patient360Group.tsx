import type { ReactNode } from 'react';

export function Patient360Group({
  id,
  title,
  source,
  children,
}: {
  id?: string;
  title: string;
  source?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section id={id} className="min-w-0 scroll-mt-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {source ? <p className="sr-only">Source: {source}</p> : null}
      <div className="mt-1.5 space-y-1.5 text-sm text-gray-700">{children}</div>
    </section>
  );
}

export function Patient360Subnav({
  items,
}: {
  items: { id: string; label: string }[];
}) {
  return (
    <nav aria-label="Section contents" className="mb-3 overflow-x-auto">
      <ul className="flex min-w-0 flex-wrap gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="inline-flex rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
