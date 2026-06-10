'use client';

import { useCallback, useState } from 'react';
import { toast } from 'react-hot-toast';
import { counsellingAzureApi, type PriceOverrideRecord } from '@/lib/api/counselling-azure.api';

export interface UseCounsellingOverridesParams {
  sessionId: string;
  setSavedOverrides: React.Dispatch<React.SetStateAction<PriceOverrideRecord[]>>;
}

export function useCounsellingOverrides({
  sessionId,
  setSavedOverrides,
}: UseCounsellingOverridesParams) {
  const [overridePrice, setOverridePrice] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideRemarks, setOverrideRemarks] = useState('');
  const [overrideRequesterType, setOverrideRequesterType] = useState<'SELF' | 'STAFF'>('SELF');
  const [overrideStaffName, setOverrideStaffName] = useState('');
  const [overrideStaffContact, setOverrideStaffContact] = useState('');
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState('');
  const [editingOverrideId, setEditingOverrideId] = useState<string | null>(null);

  const handleRemoveOverride = useCallback(
    async (overrideId: string) => {
      try {
        await counsellingAzureApi.removePriceOverride(sessionId, overrideId);
        setSavedOverrides((prev) => prev.filter((o) => o.id !== overrideId));
      } catch {
        toast.error('Failed to remove override');
      }
    },
    [sessionId, setSavedOverrides],
  );

  const handleEditOverride = useCallback((ov: PriceOverrideRecord) => {
    setEditingOverrideId(ov.id);
    setOverridePrice(String(ov.overriddenPrice));
    setOverrideReason(ov.reason);
    setOverrideRemarks(ov.remarks ?? '');
    setOverrideError('');
  }, []);

  return {
    overridePrice,
    setOverridePrice,
    overrideReason,
    setOverrideReason,
    overrideRemarks,
    setOverrideRemarks,
    overrideRequesterType,
    setOverrideRequesterType,
    overrideStaffName,
    setOverrideStaffName,
    overrideStaffContact,
    setOverrideStaffContact,
    overrideSaving,
    setOverrideSaving,
    overrideError,
    setOverrideError,
    editingOverrideId,
    setEditingOverrideId,
    handleEditOverride,
    handleRemoveOverride,
  };
}
