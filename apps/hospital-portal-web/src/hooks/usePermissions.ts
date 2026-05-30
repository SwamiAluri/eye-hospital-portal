import { useAuthStore } from '@/lib/auth-store';

export function useHasPermission(permission: string): boolean {
  return useAuthStore.getState().hasPermission(permission);
}

export function usePermissions() {
  const permissions = useAuthStore(s => s.permissions);

  return {
    hasPermission: (permission: string) => useAuthStore.getState().hasPermission(permission),
    permissions: permissions ?? [],
  };
}
