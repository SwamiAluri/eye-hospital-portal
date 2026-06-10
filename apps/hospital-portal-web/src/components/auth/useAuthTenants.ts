'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

export interface AuthTenant {
  id: string;
  name: string;
  tenantCode: string;
}

const FALLBACK_TENANTS: AuthTenant[] = [
  {
    id: '155fe198-6ae5-4a01-9254-ead5b427247e',
    name: 'India Eye Hospital Network',
    tenantCode: 'INDIA_EYE_NET',
  },
];

export function useAuthTenants(enabled = true) {
  const [tenants, setTenants] = useState<AuthTenant[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (!enabled || fetched.current) return;
    fetched.current = true;

    const fetchTenants = async () => {
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5073/api';

        let response;
        try {
          response = await axios.get(`${API_BASE_URL}/tenants/debug/codes/db`, { timeout: 3000 });
        } catch {
          response = await axios.get(`${API_BASE_URL}/tenants/debug/codes`, { timeout: 3000 });
        }

        let tenantsList: AuthTenant[] = [];
        if (response.data && Array.isArray(response.data.tenants)) {
          tenantsList = response.data.tenants;
        } else if (response.data && Array.isArray(response.data)) {
          tenantsList = response.data;
        }

        if (tenantsList.length > 0) {
          setTenants(tenantsList);
          setTenantId(tenantsList[0].id);
        } else {
          throw new Error('No tenants found');
        }
      } catch (err) {
        console.error('Error fetching tenants:', err);
        setTenants(FALLBACK_TENANTS);
        setTenantId(FALLBACK_TENANTS[0].id);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTenants();
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
