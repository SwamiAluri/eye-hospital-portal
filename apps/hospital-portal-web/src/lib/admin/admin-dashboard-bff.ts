/** Base URL for auth-service (no trailing slash). */
export function getAuthServiceBase(): string {
  const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  return url.replace(/\/api\/?$/, '');
}

export function adminDashboardUrl(path: string): string {
  const base = getAuthServiceBase();
  return `${base}/api/admin/dashboard${path}`;
}
