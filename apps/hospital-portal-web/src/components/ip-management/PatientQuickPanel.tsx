'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  formatApiError,
  ipManagementApi,
  PatientJourneyRowDto,
  JourneyAuditLogDto,
  PreauthStatusDto,
} from '@/lib/api/ip-management.api';
import { useAuthStore } from '@/lib/auth-store';
import { useIpChecklistPermissions } from '@/hooks/use-ip-checklist-permissions';
import { useTransitionGatesQuery } from '@/hooks/use-transition-gates-query';
import { patchCensusJourney } from '@/hooks/use-ip-journeys-query';
import { ipRealtimeQueryKeys } from '@/lib/ip-management/ip-realtime-events';
import { buildIpRowSituation } from '@/lib/ip-management/ip-row-situation';
import { resolveIpRoleActions, nextPermittedClinicalAction } from '@/lib/ip-management/ip-role-actions';
import { resolveIpPersona } from '@/lib/ip-management/ip-persona';
import { resolveRailPrimary } from '@/lib/ip-management/rail-primary';
import { ipBillingHref, ipJourneyHref, ipCollectBillHref, ipOtHref, ipWardHref } from '@/lib/ip-management/ip-rail-links';
import { mapTransitionGatesToMarkReady } from '@/lib/ip-management/map-transition-gates-to-mark-ready';
import {
  censusOpensWorkspace,
  censusTargetState,
} from '@/lib/ip-management/census-clinical-target';
import {
  UNMARK_READY_MIN_REASON_LENGTH,
  canUnmarkReady,
} from '@/lib/ip-management/unmark-ready';
import type { PreOpStepKey } from '@/lib/ip-management/preop-steps';
import type { CensusPresentation } from '@/lib/ip-management/ip-census-layout';
import { PatientContextRail } from '@/components/ip-management/PatientContextRail';
import { ReasonConfirmDialog } from '@/components/ip-management/ReasonConfirmDialog';
import { CollectPaymentDrawer } from '@/components/ip-management/CollectPaymentDrawer';
import { canOpenCollectDrawer } from '@/lib/ip-management/collect-payment';

export type PatientQuickPanelPresentation = Exclude<CensusPresentation, 'cards'>;

export interface PatientQuickPanelProps {
  journey: PatientJourneyRowDto | null;
  onClose: () => void;
  onJourneyUpdated?: (updatedFields: Partial<PatientJourneyRowDto>) => void;
  presentation?: PatientQuickPanelPresentation;
  onOpenPreopStep?: (step: PreOpStepKey) => void;
}

export function PatientQuickPanel({
  journey,
  onClose,
  onJourneyUpdated,
  presentation = 'docked',
  onOpenPreopStep,
}: PatientQuickPanelProps) {
  const queryClient = useQueryClient();
  const { canApplyEmergencyFc } = useIpChecklistPermissions();
  const permissions = useAuthStore(s => s.permissions);
  const roles = useAuthStore(s => s.roles);
  const collectedBy = useAuthStore(s => [s.user?.firstName, s.user?.lastName].filter(Boolean).join(' ').trim());
  const actions = resolveIpRoleActions(permissions);
  const persona = resolveIpPersona(permissions, roles);
  const router = useRouter();
  const [showEmergencyFc, setShowEmergencyFc] = useState(false);
  const [auditLogs, setAuditLogs] = useState<JourneyAuditLogDto[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [emergencySaving, setEmergencySaving] = useState(false);
  const [finSummary, setFinSummary] = useState<Awaited<ReturnType<typeof ipManagementApi.getFinancialSummary>>>(null);
  const [preauth, setPreauth] = useState<PreauthStatusDto | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [unmarkOpen, setUnmarkOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);

  const nextClinical = journey
    ? nextPermittedClinicalAction(journey.clinicalState, journey.otState, actions)
    : null;
  const targetState = censusTargetState(nextClinical?.kind);
  const preflightClinical = Boolean(targetState) && !censusOpensWorkspace(nextClinical?.kind)
    && nextClinical?.kind !== 'accept' && nextClinical?.kind !== 'start';
  const gatesQuery = useTransitionGatesQuery(
    journey?.id,
    targetState,
    Boolean(journey) && preflightClinical,
  );
  const transitionGates = preflightClinical
    ? mapTransitionGatesToMarkReady(
        gatesQuery.data,
        nextClinical?.kind === 'ready'
          ? 'Cannot mark ready for surgery yet.'
          : `Cannot ${nextClinical?.label.toLowerCase() ?? 'continue'} yet.`,
      )
    : null;

  useEffect(() => {
    if (!journey) return;
    setAuditLoading(true);
    setShowEmergencyFc(false);
    setAuditLogs([]);
    setActionError('');
    setUnmarkOpen(false);
    setCollectOpen(false);
    ipManagementApi.getJourneyAudit(journey.id).then(logs => {
      setAuditLogs(Array.isArray(logs) ? logs : []);
      setAuditLoading(false);
    });
    void ipManagementApi.getFinancialSummary(journey.id).then(setFinSummary);
    void ipManagementApi.getPreauthStatus(journey.id).then(status => {
      setPreauth(status ?? {
        allowed: false,
        warningLevel: 'warning',
        warningMessage: null,
        blockReason: null,
        preAuthNumber: null,
        approvedAmount: null,
        ccmsUnavailable: true,
      });
    });
  }, [journey?.id]);

  const openBilling = () => {
    if (!journey) return;
    router.push(ipBillingHref(journey, finSummary?.opdBillId));
  };

  const openRecord = () => {
    if (!journey) return;
    router.push(ipJourneyHref(journey.id));
  };

  const handleEmergencyFc = async (e: FormEvent) => {
    e.preventDefault();
    if (!journey || !emergencyReason.trim()) return;
    setEmergencySaving(true);
    const result = await ipManagementApi.applyEmergencyFc(journey.id, { reason: emergencyReason.trim() });
    if (result) {
      onJourneyUpdated?.({ isEmergencyFc: true, emergencyFcReason: emergencyReason.trim() });
      setShowEmergencyFc(false);
    }
    setEmergencySaving(false);
  };

  const runClinicalAction = async () => {
    if (!journey) return;
    const next = nextPermittedClinicalAction(journey.clinicalState, journey.otState, actions);
    if (!next) return;
    if (censusOpensWorkspace(next.kind)) {
      onOpenPreopStep?.(next.kind === 'ready' ? 'consent' : 'admit');
      return;
    }
    if (next.kind === 'send' || next.kind === 'accept' || next.kind === 'start' || next.kind === 'complete') {
      router.push(ipOtHref(journey.id));
      return;
    }
    if (next.kind === 'postop') {
      router.push(ipWardHref(journey.id, 'postop'));
      return;
    }
    if (next.kind === 'readyDc' || next.kind === 'discharge') {
      router.push(ipWardHref(journey.id, 'discharge'));
      return;
    }
    if (preflightClinical && (gatesQuery.isLoading || gatesQuery.isError)) return;
    if (transitionGates && !transitionGates.canMarkReady) return;

    setActionBusy(true);
    setActionError('');
    const acknowledgeWarnings = Boolean(transitionGates && transitionGates.softWarnings.length > 0);
    try {
      if (next.kind === 'accept') {
        await ipManagementApi.acceptInOT(journey.id, acknowledgeWarnings);
      } else if (next.kind === 'start') {
        await ipManagementApi.startSurgery(journey.id, acknowledgeWarnings);
      } else {
        const stateMap = {
          send: 'SentToOT',
          complete: 'SurgeryCompleted',
          postop: 'PostOp',
          readyDc: 'ReadyForDischarge',
          discharge: 'Discharged',
        } as const;
        await ipManagementApi.transitionClinical(journey.id, {
          newState: stateMap[next.kind],
          expectedUpdatedAt: journey.updatedAt,
          ...(acknowledgeWarnings ? { acknowledgeWarnings: true } : {}),
        });
      }
      onJourneyUpdated?.({});
      void queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.transitionGatesAll });
      void queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.journeysAll });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : formatApiError(err, 'Action rejected by server.'));
    } finally {
      setActionBusy(false);
    }
  };

  const runUnmarkReady = async (reason: string) => {
    if (!journey || !canUnmarkReady(journey, actions)) return;
    const previous = {
      clinicalState: journey.clinicalState,
      updatedAt: journey.updatedAt,
    };
    setActionBusy(true);
    setActionError('');
    patchCensusJourney(queryClient, journey.id, { clinicalState: 'Admitted' });
    try {
      const detail = await ipManagementApi.transitionClinical(journey.id, {
        newState: 'Admitted',
        reason,
        expectedUpdatedAt: journey.updatedAt,
      });
      patchCensusJourney(queryClient, journey.id, {
        clinicalState: detail.clinicalState,
        otState: detail.otState,
        updatedAt: detail.updatedAt,
      });
      onJourneyUpdated?.({
        clinicalState: detail.clinicalState,
        otState: detail.otState,
        updatedAt: detail.updatedAt,
      });
      setUnmarkOpen(false);
      void queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.transitionGatesAll });
      void queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.journeysAll });
    } catch (err) {
      patchCensusJourney(queryClient, journey.id, previous);
      onJourneyUpdated?.(previous);
      setActionError(err instanceof Error ? err.message : formatApiError(err, 'Action rejected by server.'));
      void queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.journeysAll });
    } finally {
      setActionBusy(false);
    }
  };

  const openCollect = () => {
    if (!journey) return;
    if (!canOpenCollectDrawer(persona, actions)) {
      openBilling();
      return;
    }
    setCollectOpen(true);
  };

  const refreshCollectSummary = async () => {
    if (!journey) return null;
    const next = await ipManagementApi.getFinancialSummary(journey.id);
    setFinSummary(next);
    return next;
  };

  const onCollectSettled = () => {
    void refreshCollectSummary();
    void queryClient.invalidateQueries({ queryKey: ipRealtimeQueryKeys.journeysAll });
  };

  const onPrimary = () => {
    if (!journey) return;
    const primary = resolveRailPrimary(
      persona, journey.clinicalState, journey.otState, actions, journey.financialState,
    );
    if (primary.kind === 'clinical') void runClinicalAction();
    else if (primary.kind === 'billing') openCollect();
    else openRecord();
  };

  if (!journey) return null;

  return (
    <>
    <PatientContextRail
      journey={journey}
      presentation={presentation}
      persona={persona}
      actions={actions}
      situation={buildIpRowSituation(journey)}
      finSummary={finSummary}
      preauth={preauth}
      auditLogs={auditLogs}
      auditLoading={auditLoading}
      actionBusy={actionBusy}
      actionError={actionError}
      canApplyEmergencyFc={canApplyEmergencyFc}
      showEmergencyFc={showEmergencyFc}
      emergencyReason={emergencyReason}
      emergencySaving={emergencySaving}
      markReadyGates={transitionGates}
      markReadyGatesLoading={preflightClinical && gatesQuery.isLoading}
      markReadyGatesError={preflightClinical && gatesQuery.isError}
      onClose={onClose}
      onPrimary={onPrimary}
      onOpenBilling={openBilling}
      onOpenRecord={openRecord}
      onOpenWard={() => router.push(ipWardHref(journey.id))}
      onOpenOt={() => router.push(ipOtHref(journey.id))}
      onOpenPreopStep={onOpenPreopStep}
      onTransferBed={() => router.push(ipWardHref(journey.id, 'transfer'))}
      onToggleEmergencyFc={setShowEmergencyFc}
      onEmergencyReasonChange={setEmergencyReason}
      onEmergencyFcSubmit={e => void handleEmergencyFc(e)}
      onDischargeOverride={() => router.push(ipJourneyHref(journey.id, 'discharge'))}
      onUnmarkReady={() => setUnmarkOpen(true)}
    />
    <ReasonConfirmDialog
      open={unmarkOpen}
      onOpenChange={setUnmarkOpen}
      title={'Revert "Ready for OT"?'}
      patientName={journey.patientName ?? undefined}
      patientMeta={[journey.uhid, journey.wardName, journey.bedNumber].filter(Boolean).join(' · ')}
      consequence={
        <>
          The OT team will be notified and the patient returns to <b>Admitted</b>. The slot stays reserved.
        </>
      }
      confirmLabel="Revert to Admitted"
      minReasonLength={UNMARK_READY_MIN_REASON_LENGTH}
      busy={actionBusy}
      error={actionError || undefined}
      onConfirm={reason => void runUnmarkReady(reason)}
    />
    <CollectPaymentDrawer
      open={collectOpen}
      onOpenChange={setCollectOpen}
      journey={journey}
      finSummary={finSummary}
      canCreateBill={actions.canCreateBill}
      collectedBy={collectedBy}
      billingHref={finSummary?.opdBillId ? ipCollectBillHref(finSummary.opdBillId) : ipBillingHref(journey)}
      onCollected={onCollectSettled}
      onRefreshSummary={refreshCollectSummary}
    />
    </>
  );
}
