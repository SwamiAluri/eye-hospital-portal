import { useAuthStore } from '@/lib/auth-store';
import { useCallback, useMemo } from 'react';

interface PermissionCacheEntry {
  permissions: string[];
  roles: string[];
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface PermissionCacheOptions {
  ttl?: number; // Default 5 minutes
  storageKey?: string;
}

class PermissionCache {
  private cache: Map<string, PermissionCacheEntry> = new Map();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes
  private readonly storageKey = 'permission_cache';

  constructor() {
    this.loadFromStorage();
    this.startCleanupInterval();
  }

  /**
   * Get cached permissions for a user
   */
  get(userId: string): PermissionCacheEntry | null {
    const entry = this.cache.get(userId);
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(userId);
      this.saveToStorage();
      return null;
    }

    return entry;
  }

  /**
   * Set permissions in cache
   */
  set(userId: string, permissions: string[], roles: string[], options: PermissionCacheOptions = {}): void {
    const entry: PermissionCacheEntry = {
      permissions: [...permissions],
      roles: [...roles],
      timestamp: Date.now(),
      ttl: options.ttl || this.defaultTTL
    };

    this.cache.set(userId, entry);
    this.saveToStorage();
  }

  /**
   * Invalidate cache for a specific user
   */
  invalidate(userId: string): void {
    this.cache.delete(userId);
    this.saveToStorage();
  }

  /**
   * Clear all cached permissions
   */
  clear(): void {
    this.cache.clear();
    this.saveToStorage();
  }

  /**
   * Check if user has permission (with caching)
   */
  hasPermission(userId: string, permissionCode: string): boolean | null {
    const entry = this.get(userId);
    if (!entry) return null; // Cache miss

    // Handle wildcard permission
    if (entry.permissions.includes('*')) return true;

    return entry.permissions.includes(permissionCode);
  }

  /**
   * Check if user has role (with caching)
   */
  hasRole(userId: string, roleName: string): boolean | null {
    const entry = this.get(userId);
    if (!entry) return null; // Cache miss

    return entry.roles.includes(roleName);
  }

  /**
   * Get all permissions for user (with caching)
   */
  getPermissions(userId: string): string[] | null {
    const entry = this.get(userId);
    return entry ? [...entry.permissions] : null;
  }

  /**
   * Get all roles for user (with caching)
   */
  getRoles(userId: string): string[] | null {
    const entry = this.get(userId);
    return entry ? [...entry.roles] : null;
  }

  /**
   * Save cache to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const cacheObject = Object.fromEntries(this.cache);
      localStorage.setItem(this.storageKey, JSON.stringify(cacheObject));
    } catch (error) {
      console.warn('Failed to save permission cache to storage:', error);
    }
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const cacheObject = JSON.parse(stored);
        this.cache = new Map(Object.entries(cacheObject));
      }
    } catch (error) {
      console.warn('Failed to load permission cache from storage:', error);
      this.cache.clear();
    }
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupInterval(): void {
    if (typeof window === 'undefined') return;

    // Clean up expired entries every minute
    setInterval(() => {
      const now = Date.now();
      let hasChanges = false;

      for (const [userId, entry] of this.cache.entries()) {
        if (now > entry.timestamp + entry.ttl) {
          this.cache.delete(userId);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        this.saveToStorage();
      }
    }, 60 * 1000); // Every minute
  }
}

// Create singleton instance
const permissionCache = new PermissionCache();

/**
 * Enhanced auth store with caching
 */
export function useCachedAuthStore() {
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const refreshToken = useAuthStore(s => s.refreshToken);
  const tenantId = useAuthStore(s => s.tenantId);
  const roles = useAuthStore(s => s.roles);
  const permissions = useAuthStore(s => s.permissions);
  const isLoading = useAuthStore(s => s.isLoading);
  const mustChangePassword = useAuthStore(s => s.mustChangePassword);
  const storeHasPermission = useAuthStore(s => s.hasPermission);
  const storeHasRole = useAuthStore(s => s.hasRole);
  const setAuth = useAuthStore(s => s.setAuth);
  const logout = useAuthStore(s => s.logout);
  const clearMustChangePassword = useAuthStore(s => s.clearMustChangePassword);

  const userId = user?.id;

  const hasPermission = useCallback((permissionCode: string): boolean => {
    if (!userId) return false;
    const cached = permissionCache.hasPermission(userId, permissionCode);
    if (cached !== null) return cached;
    return storeHasPermission(permissionCode);
  }, [userId, storeHasPermission]);

  const hasRole = useCallback((roleName: string): boolean => {
    if (!userId) return false;
    const cached = permissionCache.hasRole(userId, roleName);
    if (cached !== null) return cached;
    return storeHasRole(roleName);
  }, [userId, storeHasRole]);

  const getPermissions = useCallback((): string[] => {
    if (!userId) return [];
    const cached = permissionCache.getPermissions(userId);
    if (cached !== null) return cached;
    return permissions;
  }, [userId, permissions]);

  const getRoles = useCallback((): string[] => {
    if (!userId) return [];
    const cached = permissionCache.getRoles(userId);
    if (cached !== null) return cached;
    return roles;
  }, [userId, roles]);

  const cachedSetAuth = useCallback(
    (
      authToken: string,
      authRefreshToken: string | null,
      authUser: Parameters<typeof setAuth>[2],
      authRoles: string[],
      authPermissions: string[],
      authTenantId: string | null,
      authMustChangePassword: boolean,
    ) => {
      setAuth(authToken, authRefreshToken, authUser, authRoles, authPermissions, authTenantId, authMustChangePassword);
      permissionCache.set(authUser.id, authPermissions, authRoles);
    },
    [setAuth],
  );

  const cachedLogout = useCallback(async () => {
    if (userId) permissionCache.invalidate(userId);
    await logout();
  }, [userId, logout]);

  return useMemo(
    () => ({
      user,
      token,
      refreshToken,
      tenantId,
      roles,
      permissions,
      isLoading,
      mustChangePassword,
      hasPermission,
      hasRole,
      getPermissions,
      getRoles,
      setAuth: cachedSetAuth,
      logout: cachedLogout,
      clearMustChangePassword,
    }),
    [
      user,
      token,
      refreshToken,
      tenantId,
      roles,
      permissions,
      isLoading,
      mustChangePassword,
      hasPermission,
      hasRole,
      getPermissions,
      getRoles,
      cachedSetAuth,
      cachedLogout,
      clearMustChangePassword,
    ],
  );
}

/**
 * Hook for permission caching utilities
 */
export function usePermissionCache() {
  const user = useAuthStore().user;

  return {
    // Cache management
    invalidateCache: () => {
      if (user) permissionCache.invalidate(user.id);
    },

    clearAllCache: () => permissionCache.clear(),

    // Cache statistics
    getCacheSize: () => permissionCache['cache'].size,

    // Check if permission is cached
    isCached: (permissionCode: string): boolean => {
      if (!user) return false;
      return permissionCache.hasPermission(user.id, permissionCode) !== null;
    }
  };
}

export { permissionCache };
export type { PermissionCacheOptions };