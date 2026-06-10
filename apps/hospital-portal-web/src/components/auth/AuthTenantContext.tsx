'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface AuthTenantContextValue {
  tenantName: string | null;
  setTenantName: (name: string | null) => void;
}

const AuthTenantContext = createContext<AuthTenantContextValue | null>(null);

export function AuthTenantProvider({ children }: { children: ReactNode }) {
  const [tenantName, setTenantNameState] = useState<string | null>(null);

  const setTenantName = useCallback((name: string | null) => {
    setTenantNameState(name);
  }, []);

  return (
    <AuthTenantContext.Provider value={{ tenantName, setTenantName }}>
      {children}
    </AuthTenantContext.Provider>
  );
}

export function useAuthTenant() {
  const ctx = useContext(AuthTenantContext);
  if (!ctx) {
    throw new Error('useAuthTenant must be used within AuthTenantProvider');
  }
  return ctx;
}

/** Safe hook when provider may not wrap (returns no-op setter) */
export function useAuthTenantOptional() {
  return useContext(AuthTenantContext);
}
