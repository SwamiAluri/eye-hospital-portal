'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  ipManagementApi,
  type CounsellorPreOpInvestigationChecklistDto,
  type CounsellorPreOpInvestigationItemDto,
} from '@/lib/api/ip-management.api';
import { COUNSELLING_PREOP_TEST_IDS } from '@/lib/counsellors-desk/counselling-preop-test-ids';
import {
  CounsellingAccordion,
  CounsellingAccordionContent,
  CounsellingAccordionItem,
  CounsellingAccordionTrigger,
  CounsellingBadge,
  CounsellingButton,
  CounsellingInfoAlert,
} from '@/components/counsellors-desk/session/primitives';
import {
  CounsellingInvestigationValueRow,
  type InvestigationDraftState,
} from '@/components/counsellors-desk/session/CounsellingInvestigationValueRow';

function draftFromItem(item: CounsellorPreOpInvestigationItemDto): InvestigationDraftState {
  return {
    resultValue: item.resultValue ?? '',
    resultUnit: item.resultUnit ?? item.defaultUnit ?? '',
    notes: item.notes ?? '',
  };
}

export interface CounsellingPreOpInvestigationsPanelProps {
  counselingSessionId: string;
  readOnly?: boolean;
}

export function CounsellingPreOpInvestigationsPanel({
  counselingSessionId,
  readOnly = false,
}: CounsellingPreOpInvestigationsPanelProps) {
  const [checklist, setChecklist] = useState<CounsellorPreOpInvestigationChecklistDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, InvestigationDraftState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const data = await ipManagementApi.getCounsellorPreOpInvestigations(counselingSessionId);
    setChecklist(data);
    if (data) {
      setDrafts(Object.fromEntries(data.items.map((item) => [item.itemId, draftFromItem(item)])));
    }
    setLoading(false);
  }, [counselingSessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const dirtyItemIds = useMemo(() => {
    if (!checklist) return [];
    return checklist.items.filter((item) => {
      const draft = drafts[item.itemId];
      if (!draft) return false;
      const saved = draftFromItem(item);
      return (
        draft.resultValue.trim() !== (saved.resultValue.trim()) ||
        draft.resultUnit.trim() !== (saved.resultUnit.trim()) ||
        draft.notes.trim() !== (saved.notes.trim())
      );
    }).map((item) => item.itemId);
  }, [checklist, drafts]);

  function handleDraftChange(itemId: string, patch: Partial<InvestigationDraftState>) {
    setDrafts((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...patch },
    }));
  }

  async function handleSave() {
    if (readOnly || !checklist || dirtyItemIds.length === 0) return;

    const itemsToSave = checklist.items.filter((item) => dirtyItemIds.includes(item.itemId));
    const invalid = itemsToSave.find((item) => !drafts[item.itemId]?.resultValue.trim());
    if (invalid) {
      toast.error(`Enter a value for ${invalid.itemLabel} or revert changes`);
      return;
    }

    setSaving(true);
    let latest = checklist;
    let saved = 0;

    for (const item of itemsToSave) {
      const draft = drafts[item.itemId];
      const updated = await ipManagementApi.saveCounsellorPreOpInvestigationResult(
        counselingSessionId,
        item.itemId,
        {
          resultValue: draft.resultValue.trim(),
          resultUnit: draft.resultUnit.trim() || undefined,
          notes: draft.notes.trim() || undefined,
        },
      );
      if (updated) {
        latest = updated;
        saved++;
      }
    }

    if (saved > 0 && latest) {
      setChecklist(latest);
      setDrafts(Object.fromEntries(latest.items.map((item) => [item.itemId, draftFromItem(item)])));
      toast.success(`Saved ${saved} draft investigation value${saved === 1 ? '' : 's'}`);
    } else if (saved === 0) {
      toast.error('Failed to save investigation values');
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-counselling-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading pre-admission labs…
      </div>
    );
  }

  if (!checklist || checklist.items.length === 0) {
    return null;
  }

  return (
    <CounsellingAccordion
      type="single"
      collapsible
      defaultValue="preop-investigations"
      className="w-full"
      data-testid={COUNSELLING_PREOP_TEST_IDS.panel}
    >
      <CounsellingAccordionItem value="preop-investigations" className="border-counselling-border">
        <CounsellingAccordionTrigger className="min-h-11 px-1 py-3 text-sm font-medium hover:no-underline sm:px-2">
          <span className="flex items-center gap-2">
            Pre-admission lab values
            <CounsellingBadge
              variant="outline"
              className="border-counselling-border text-[10px] text-counselling-muted-foreground"
            >
              Optional
            </CounsellingBadge>
            {checklist.draftItems > 0 ? (
              <CounsellingBadge className="bg-blue-100 text-[10px] text-blue-800 hover:bg-blue-100">
                {checklist.draftItems} draft{checklist.draftItems === 1 ? '' : 's'}
              </CounsellingBadge>
            ) : null}
          </span>
        </CounsellingAccordionTrigger>
        <CounsellingAccordionContent className="space-y-3 px-1 pb-4 sm:px-2">
          <CounsellingInfoAlert>
            Optional values from external labs copy to the ward as unverified drafts. Ward nursing must
            verify before PAC.
          </CounsellingInfoAlert>

          <div className="space-y-3">
            {checklist.items.map((item) => (
              <CounsellingInvestigationValueRow
                key={item.itemId}
                item={item}
                draft={drafts[item.itemId] ?? draftFromItem(item)}
                readOnly={readOnly}
                onDraftChange={handleDraftChange}
              />
            ))}
          </div>

          {!readOnly ? (
            <CounsellingButton
              type="button"
              data-testid={COUNSELLING_PREOP_TEST_IDS.save}
              disabled={saving || dirtyItemIds.length === 0}
              onClick={handleSave}
              className="w-full sm:w-auto"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save draft values
              {dirtyItemIds.length > 0 ? ` (${dirtyItemIds.length})` : ''}
            </CounsellingButton>
          ) : null}
        </CounsellingAccordionContent>
      </CounsellingAccordionItem>
    </CounsellingAccordion>
  );
}
