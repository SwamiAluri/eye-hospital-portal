/**
 * Sidebar item active matching — honors `exact` so prefix roots (e.g. LMS Overview)
 * do not stay highlighted on child routes.
 */
export function isSidebarNavActive(
  pathname: string | null | undefined,
  href: string,
  exact?: boolean,
): boolean {
  if (!pathname) return false;
  if (href === '/dashboard' || exact) {
    return pathname === href;
  }
  return pathname.startsWith(href);
}
