'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { counsellingAzureApi, type PriceOverrideRecord } from '@/lib/api/counselling-azure.api';
import type { CounsellorProcedureVariant } from '@/lib/master-data/clinical-catalog-master';
import type { WaitingListStatus } from '@/types/counsellors-desk';
import {
  packageOverrideVariantId,
} from '@/lib/counsellors-desk/package-preview';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import {
  CounsellingButton,
  CounsellingDialog,
  CounsellingDialogContent,
  CounsellingDialogFooter,
  CounsellingDialogHeader,
  CounsellingDialogTitle,
  CounsellingEmptyState,
  CounsellingInput,
  CounsellingLabel,
  CounsellingSelect,
  CounsellingSelectContent,
  CounsellingSelectItem,
  CounsellingSelectTrigger,
  CounsellingSelectValue,
  CounsellingTextarea,
} from '@/components/counsellors-desk/session/primitives';
import { toast } from 'react-hot-toast';

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  email?: string;
}

export type PackageOverrideTarget = {
  id: string;
  name: string;
  basePrice: number;
};

export interface CounsellingPriceOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  selectedVariant: CounsellorProcedureVariant | null;
  /** When set, dialog edits package amount instead of procedure price. */
  packageTarget?: PackageOverrideTarget | null;
  isReadOnly: boolean;
  isDoneState: boolean;
  savedOverrides: PriceOverrideRecord[];
  setSavedOverrides: (overrides: PriceOverrideRecord[]) => void;
  setQueueStatus: (status: WaitingListStatus) => void;
  overridePrice: string;
  setOverridePrice: (v: string) => void;
  overrideReason: string;
  setOverrideReason: (v: string) => void;
  overrideRemarks: string;
  setOverrideRemarks: (v: string) => void;
  overrideRequesterType: 'SELF' | 'STAFF';
  setOverrideRequesterType: (v: 'SELF' | 'STAFF') => void;
  overrideStaffName: string;
  setOverrideStaffName: (v: string) => void;
  overrideStaffContact: string;
  setOverrideStaffContact: (v: string) => void;
  overrideSaving: boolean;
  setOverrideSaving: (v: boolean) => void;
  overrideError: string;
  setOverrideError: (v: string) => void;
  editingOverrideId: string | null;
  setEditingOverrideId: (v: string | null) => void;
  staffList: StaffMember[];
  onEditOverride: (ov: PriceOverrideRecord) => void;
  onRemoveOverride: (id: string) => void;
}

export function CounsellingPriceOverrideDialog({
  open,
  onOpenChange,
  sessionId,
  selectedVariant,
  packageTarget = null,
  isReadOnly,
  isDoneState,
  savedOverrides,
  setSavedOverrides,
  setQueueStatus,
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
  staffList,
  onEditOverride,
  onRemoveOverride,
}: CounsellingPriceOverrideDialogProps) {
  const isPackage = !!packageTarget;

  const targetKey = isPackage
    ? packageOverrideVariantId(packageTarget.id)
    : selectedVariant?.id ?? null;

  const targetName = isPackage ? packageTarget.name : selectedVariant?.name ?? '';
  const basePrice = isPackage ? packageTarget.basePrice : selectedVariant?.price ?? 0;
  const priceType = isPackage ? 'PACKAGE' : selectedVariant?.priceType ?? 'PER_EYE';

  const targetOverrides = useMemo(
    () => (targetKey ? savedOverrides.filter((o) => o.variantId === targetKey) : []),
    [savedOverrides, targetKey],
  );

  if (!isPackage && !selectedVariant) return null;
  if (isPackage && !packageTarget) return null;

  const resetForm = () => {
    setEditingOverrideId(null);
    setOverridePrice('');
    setOverrideReason('');
    setOverrideRemarks('');
    setOverrideStaffName('');
    setOverrideStaffContact('');
    setOverrideRequesterType('SELF');
    setOverrideError('');
  };

  const handleSaveOverride = async () => {
    setOverrideError('');
    const parsed = parseFloat(overridePrice);
    if (!overridePrice || Number.isNaN(parsed) || parsed <= 0) {
      setOverrideError('Enter a valid price.');
      return;
    }
    if (!overrideReason.trim()) {
      setOverrideError('Reason is required.');
      return;
    }
    if (!targetKey) {
      setOverrideError('No price target selected.');
      return;
    }
    setOverrideSaving(true);
    try {
      if (editingOverrideId) {
        await counsellingAzureApi.updatePriceOverride(sessionId, editingOverrideId, {
          overriddenPrice: parsed,
          reason: overrideReason.trim(),
          remarks: overrideRemarks.trim() || undefined,
        });
        const refreshed = await counsellingAzureApi.getPriceOverrides(sessionId);
        setSavedOverrides(refreshed);
        resetForm();
      } else {
        await counsellingAzureApi.addPriceOverride(sessionId, {
          variantId: targetKey,
          variantName: targetName,
          basePrice,
          overriddenPrice: parsed,
          priceType,
          reason: overrideReason.trim(),
          remarks: overrideRemarks.trim() || undefined,
          requestedByType: overrideRequesterType,
          requestedByName: overrideRequesterType === 'STAFF' ? overrideStaffName : undefined,
          requestedByContact: overrideRequesterType === 'STAFF' ? overrideStaffContact : undefined,
          performedBy: 'counsellor',
          tenantId: useAuthStore.getState().tenantId ?? '',
        });
        const refreshed = await counsellingAzureApi.getPriceOverrides(sessionId);
        setSavedOverrides(refreshed);
        if (isDoneState && !isPackage) {
          counsellingAzureApi.addOnSurgery(sessionId, overrideReason.trim());
          setQueueStatus('AddOnSurgery');
          toast.success('Price override saved — session marked as Add-On Surgery');
        }
        resetForm();
      }
      onOpenChange(false);
    } catch {
      setOverrideError('Failed to save override. Please try again.');
    } finally {
      setOverrideSaving(false);
    }
  };

  return (
    <CounsellingDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <CounsellingDialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <CounsellingDialogHeader>
          <CounsellingDialogTitle>
            {isPackage ? counsellingCopy.modifyPackagePrice : counsellingCopy.modifyProcedurePrice}
          </CounsellingDialogTitle>
        </CounsellingDialogHeader>

        <div className="space-y-3 py-1 text-sm">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-800">
              Reference price for <strong>{targetName}</strong>
            </p>
            <p className="text-lg font-bold tabular-nums text-amber-900">
              ₹{basePrice.toLocaleString('en-IN')}
            </p>
          </div>

          {targetOverrides.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-counselling-muted-foreground">Saved overrides</p>
              {targetOverrides.map((ov) => (
                <div
                  key={ov.id}
                  className="flex items-start justify-between gap-2 rounded-lg bg-counselling-muted px-2.5 py-2 text-xs"
                >
                  <span>
                    <span className="font-semibold tabular-nums">
                      ₹{ov.overriddenPrice.toLocaleString('en-IN')}
                    </span>
                    {' — '}
                    {ov.reason}
                  </span>
                  {!isReadOnly && (
                    <div className="flex shrink-0 gap-2">
                      <CounsellingButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditOverride(ov)}
                        className="h-auto min-h-0 px-1 text-counselling-primary"
                      >
                        Edit
                      </CounsellingButton>
                      <CounsellingButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void onRemoveOverride(ov.id)}
                        className="h-auto min-h-0 px-1 text-red-600"
                      >
                        Remove
                      </CounsellingButton>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!isReadOnly && (
            <div className="space-y-3 border-t pt-3">
              {editingOverrideId && (
                <p className="rounded bg-counselling-accent px-2 py-1 text-xs font-medium text-counselling-primary">
                  Editing existing override
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <CounsellingLabel className="mb-1 block text-xs">
                    New price (₹) <span className="text-red-500">*</span>
                  </CounsellingLabel>
                  <CounsellingInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={overridePrice}
                    onChange={(e) => setOverridePrice(e.target.value)}
                    placeholder={String(basePrice)}
                    className="tabular-nums"
                  />
                </div>
                <div>
                  <CounsellingLabel className="mb-1 block text-xs">Requester</CounsellingLabel>
                  <CounsellingSelect
                    value={overrideRequesterType}
                    onValueChange={(v) => setOverrideRequesterType(v as 'SELF' | 'STAFF')}
                  >
                    <CounsellingSelectTrigger className="h-11 w-full">
                      <CounsellingSelectValue />
                    </CounsellingSelectTrigger>
                    <CounsellingSelectContent>
                      <CounsellingSelectItem value="SELF">Self (Counsellor)</CounsellingSelectItem>
                      <CounsellingSelectItem value="STAFF">Another staff member</CounsellingSelectItem>
                    </CounsellingSelectContent>
                  </CounsellingSelect>
                </div>
              </div>

              {overrideRequesterType === 'STAFF' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <CounsellingLabel className="mb-1 block text-xs">Staff member</CounsellingLabel>
                    <CounsellingSelect
                      value={
                        staffList.find(
                          (s) => `${s.firstName} ${s.lastName}`.trim() === overrideStaffName,
                        )?.id ?? ''
                      }
                      onValueChange={(staffId) => {
                        const staff = staffList.find((s) => s.id === staffId);
                        if (staff) {
                          setOverrideStaffName(`${staff.firstName} ${staff.lastName}`.trim());
                          setOverrideStaffContact(staff.phoneNumber || staff.email || '');
                        } else {
                          setOverrideStaffName('');
                          setOverrideStaffContact('');
                        }
                      }}
                    >
                      <CounsellingSelectTrigger className="h-11 w-full">
                        <CounsellingSelectValue placeholder="Select staff" />
                      </CounsellingSelectTrigger>
                      <CounsellingSelectContent>
                        {staffList.length === 0 ? (
                          <CounsellingEmptyState compact title="No staff loaded" />
                        ) : (
                          staffList.map((s) => (
                            <CounsellingSelectItem key={s.id} value={s.id}>
                              {`${s.firstName} ${s.lastName}`.trim()}
                            </CounsellingSelectItem>
                          ))
                        )}
                      </CounsellingSelectContent>
                    </CounsellingSelect>
                  </div>
                  <div>
                    <CounsellingLabel className="mb-1 block text-xs">Contact</CounsellingLabel>
                    <CounsellingInput
                      value={overrideStaffContact}
                      onChange={(e) => setOverrideStaffContact(e.target.value)}
                      placeholder="Phone or email"
                    />
                  </div>
                </div>
              )}

              <div>
                <CounsellingLabel className="mb-1 block text-xs">
                  Reason <span className="text-red-500">*</span>
                </CounsellingLabel>
                <CounsellingInput
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Why is this price being changed?"
                />
              </div>
              <div>
                <CounsellingLabel className="mb-1 block text-xs">Remarks</CounsellingLabel>
                <CounsellingTextarea
                  value={overrideRemarks}
                  onChange={(e) => setOverrideRemarks(e.target.value)}
                  placeholder="Additional context for this override"
                  rows={2}
                />
              </div>
              {overrideError && <p className="text-xs text-red-600">{overrideError}</p>}
            </div>
          )}
        </div>

        <CounsellingDialogFooter className="gap-2 sm:gap-0">
          <CounsellingButton type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </CounsellingButton>
          {!isReadOnly && (
            <CounsellingButton
              type="button"
              onClick={() => void handleSaveOverride()}
              disabled={overrideSaving}
            >
              {overrideSaving ? 'Saving…' : editingOverrideId ? 'Update override' : 'Save override'}
            </CounsellingButton>
          )}
        </CounsellingDialogFooter>
      </CounsellingDialogContent>
    </CounsellingDialog>
  );
}
