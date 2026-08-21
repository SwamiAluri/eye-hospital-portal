'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

export interface AuthTenant {
  id: string;
  name: string;
  tenantCode: string;
}

/** Primary dev / test tenant — matches seed data and admin@test.com. */
export const DEFAULT_LOGIN_TENANT_ID = '155fe198-6ae5-4a01-9254-ead5b427247e';

const DEFAULT_LOGIN_TENANT: AuthTenant = {
  id: DEFAULT_LOGIN_TENANT_ID,
  name: 'India Eye Hospital Network',
  tenantCode: 'INDIA_EYE_NET',
};

const FALLBACK_TENANTS: AuthTenant[] = [DEFAULT_LOGIN_TENANT];

const TENANT_FETCH_TIMEOUT_MS = 8000;

function normalizeTenants(raw: unknown): AuthTenant[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t: Record<string, unknown>) => ({
      id: String(t.id ?? ''),
      name: String(t.name ?? ''),
      tenantCode: String(t.tenantCode ?? t.tenant_code ?? ''),
    }))
    .filter(t => t.id && t.name);
}

/** India Eye first; dedupe by id. */
export function mergeLoginTenants(fetched: AuthTenant[]): AuthTenant[] {
  const rest = fetched.filter(t => t.id !== DEFAULT_LOGIN_TENANT_ID);
  return [DEFAULT_LOGIN_TENANT, ...rest];
}

/** Always default to India Eye when it is in the list (always after merge). */
export function pickDefaultTenantId(tenants: AuthTenant[]): string {
  if (tenants.some(t => t.id === DEFAULT_LOGIN_TENANT_ID)) {
    return DEFAULT_LOGIN_TENANT_ID;
  }
  return tenants[0]?.id ?? DEFAULT_LOGIN_TENANT_ID;
}

export function useAuthTenants(enabled = true) {
  const [tenants, setTenants] = useState<AuthTenant[]>(FALLBACK_TENANTS);
  const [tenantId, setTenantId] = useState(DEFAULT_LOGIN_TENANT_ID);
  const [isLoading, setIsLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (!enabled || fetched.current) return;
    fetched.current = true;

    const fetchTenants = async () => {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5073/api';

      try {
        const response = await axios.get(`${API_BASE_URL}/tenants/debug/codes/db`, {
          timeout: TENANT_FETCH_TIMEOUT_MS,
        });

        let tenantsList: AuthTenant[] = [];
        if (response.data && Array.isArray(response.data.tenants)) {
          tenantsList = normalizeTenants(response.data.tenants);
        } else if (response.data && Array.isArray(response.data)) {
          tenantsList = normalizeTenants(response.data);
        }

        const merged = mergeLoginTenants(tenantsList);
        setTenants(merged);
        setTenantId(pickDefaultTenantId(merged));
      } catch (err) {
        console.warn(
          'Tenant list unavailable from auth service; using India Eye Hospital Network fallback.',
          err,
        );
        setTenants(FALLBACK_TENANTS);
        setTenantId(DEFAULT_LOGIN_TENANT_ID);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchTenants();
  }, [enabled]);

  const selectedTenant = tenants.find((t) => t.id === tenantId) ?? null;

  const selectTenant = useCallback((id: string) => {
    setTenantId(id);
  }, []);

  return {
    tenants,
    tenantId,
    setTenantId: selectTenant,
    selectedTenant,
    isLoading,
  };
}
