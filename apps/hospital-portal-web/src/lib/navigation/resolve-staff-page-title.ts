export type StaffNavItem = {
  label: string;
  href: string;
  exact?: boolean;
  subItems?: StaffNavItem[];
};

/** A counselling session is not its own menu item. The bar keeps the list name, not the patient. */
const COUNSELLING_SESSION_PATH = /^\/dashboard\/counsellors-desk\/[^/]+$/;

function pathOnly(href: string): string {
  const path = (href.split(/[?#]/)[0] ?? '').trim();
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

function walk(items: StaffNavItem[], visit: (item: StaffNavItem) => void): void {
  for (const item of items) {
    visit(item);
    if (item.subItems?.length) walk(item.subItems, visit);
  }
}

/**
 * Sidebar label for the current staff address.
 * Longest matching menu address wins. Exact items do not claim their children.
 * Record routes keep the parent menu name. Unmatched addresses return an empty string.
 */
export function resolveStaffPageTitle(pathname: string, items: StaffNavItem[]): string {
  const path = pathOnly(pathname);
  let best: { label: string; length: number } | null = null;

  walk(items, (item) => {
    const href = pathOnly(item.href);
    if (!href) return;
    const matches = item.exact
      ? path === href
      : path === href || path.startsWith(`${href}/`);
    if (!matches) return;
    if (!best || href.length > best.length) {
      best = { label: item.label, length: href.length };
    }
  });

  if (best) return best.label;
  if (COUNSELLING_SESSION_PATH.test(path)) return 'Counselling Sessions';
  return '';
}
