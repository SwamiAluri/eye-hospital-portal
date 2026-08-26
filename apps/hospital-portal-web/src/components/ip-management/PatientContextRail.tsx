'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type {
  JourneyAuditLogDto,
  PatientJourneyRowDto,
  PreauthStatusDto,
} from '@/lib/api/ip-management.api';
import { getOpdBill, type OpdBillPayment } from '@/lib/api/opd-billing.api';
import { PatientIdentificationBanner } from '@/components/ip-management/PatientIdentificationBanner';
import { WristbandPrintControl } from '@/components/ip-management/WristbandPrintControl';
import { CoverageContextBlock } from '@/components/ip-management/CoverageContextBlock';
import { IP_CENSUS_TEST_IDS } from '@/lib/ip-management/ip-census-test-ids';
import { UNWIRED_CLINICAL_ALERTS } from '@/lib/ip-management/clinical-alerts';
import {
  personaHidesAlertStrip,
  railSectionsForPersona,
  type IpPersona,
  type RailSection,
} from '@/lib/ip-management/ip-persona';
import { StatusChip } from '@/components/ip-management/preop/primitives/StatusChip';
import { censusClinicalChip, censusOtChip } from '@/lib/ip-management/ip-census-display';
import type { IpRowSituation } from '@/lib/ip-management/ip-row-situation';
import type { IpRoleActions } from '@/lib/ip-management/ip-role-actions';
import { blockersForPersona, buildRailBlockers } from '@/lib/ip-management/rail-blockers';
import { canUnmarkReady } from '@/lib/ip-management/unmark-ready';
import { resolveRailPrimary } from '@/lib/ip-management/rail-primary';
import type { CensusPresentation } from '@/lib/ip-management/ip-census-layout';
import type { MarkReadyGateResult } from '@/lib/ip-management/preop-mark-ready-gates';
import type { PreOpStepKey } from '@/lib/ip-management/preop-steps';
import {
  MarkReadyHardBlockList,
  MarkReadySoftWarningList,
} from '@/components/ip-management/preop/PreOpMarkReadyFooter';

type FinSummary = {
  opdBillId?: string | null;
  billNumber?: string | null;
  billedAmount?: number;
  totalCollected: number;
  balanceDue: number;
  patientResponsibility?: number;
  insuranceResponsibility?: number;
  patientBalance?: number;
  packageEstimate?: number;
  isFinalized?: boolean;
} | null;

const CLINICAL_LABEL: Record<string, string> = {
  Expected: 'Expected',
  Admitted: 'Admitted',
  ReadyForSurgery: 'Ready for surgery',
  SentToOT: 'Sent to OT',
  InOT: 'In OT',
  SurgeryCompleted: 'Surgery done',
  PostOp: 'Post-op',
  ReadyForDischarge: 'Ready for discharge',
  Discharged: 'Discharged',
  CancelledSurgery: 'Cancelled',
  AdmissionCancelled: 'Admission cancelled',
};

const FINANCIAL_LABEL: Record<string, string> = {
  NotCreated: 'No bill',
  Draft: 'Bill draft',
  Estimated: 'Estimated',
  Confirmed: 'Confirmed',
  PartiallyPaid: 'Partially paid',
  Paid: 'Paid',
  Settled: 'Settled',
};

function fmtINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n);
}

function fmtTime(dt: string | null | undefined): string {
  if (!dt) return '';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function isFinancialAudit(log: JourneyAuditLogDto): boolean {
  const blob = `${log.action ?? ''} ${log.fieldChanged ?? ''} ${log.newValue ?? ''}`.toLowerCase();
  return /payment|bill|advance|refund|collect|receipt|billing/.test(blob);
}

function activityForPersona(persona: IpPersona, logs: JourneyAuditLogDto[]): JourneyAuditLogDto[] {
  if (persona === 'cashier') return logs.filter(isFinancialAudit);
  if (persona === 'clinical') return logs.filter(l => !isFinancialAudit(l));
  return logs;
}

export interface PatientContextRailProps {
  journey: PatientJourneyRowDto;
  presentation?: Exclude<CensusPresentation, 'cards'>;
  persona: IpPersona;
  actions: IpRoleActions;
  situation: IpRowSituation;
  finSummary: FinSummary;
  preauth: PreauthStatusDto | null;
  auditLogs: JourneyAuditLogDto[];
  auditLoading: boolean;
  actionBusy: boolean;
  actionError: string;
  canApplyEmergencyFc: boolean;
  showEmergencyFc: boolean;
  emergencyReason: string;
  emergencySaving: boolean;
  onClose: () => void;
  onPrimary: () => void;
  onOpenBilling: () => void;
  onOpenRecord: () => void;
  onOpenWard: () => void;
  onOpenOt: () => void;
  onTransferBed: () => void;
  onToggleEmergencyFc: (open: boolean) => void;
  onEmergencyReasonChange: (value: string) => void;
  onEmergencyFcSubmit: (e: FormEvent) => void;
  onDischargeOverride: () => void;
  onUnmarkReady?: () => void;
  markReadyGates?: MarkReadyGateResult | null;
  markReadyGatesLoading?: boolean;
  markReadyGatesError?: boolean;
  onOpenPreopStep?: (step: PreOpStepKey) => void;
}

export function PatientContextRail({
  journey,
  presentation = 'docked',
  persona,
  actions,
  situation,
  finSummary,
  preauth,
  auditLogs,
  auditLoading,
  actionBusy,
  actionError,
  canApplyEmergencyFc,
  showEmergencyFc,
  emergencyReason,
  emergencySaving,
  onClose,
  onPrimary,
  onOpenBilling,
  onOpenRecord,
  onOpenWard,
  onOpenOt,
  onTransferBed,
  onToggleEmergencyFc,
  onEmergencyReasonChange,
  onEmergencyFcSubmit,
  onDischargeOverride,
  onUnmarkReady,
  markReadyGates = null,
  markReadyGatesLoading = false,
  markReadyGatesError = false,
  onOpenPreopStep,
}: PatientContextRailProps) {
  const docked = presentation === 'docked';
  const sections = railSectionsForPersona(persona);
  const primary = resolveRailPrimary(
    persona, journey.clinicalState, journey.otState, actions, journey.financialState,
  );
  const blockers = blockersForPersona(persona, buildRailBlockers(situation, journey.eyeOperated));
  const activity = activityForPersona(persona, auditLogs).slice(0, 3);
  const collected = finSummary?.totalCollected ?? journey.totalPaid;
  const due = finSummary?.patientBalance != null
    ? Math.max(0, finSummary.patientBalance)
    : (finSummary?.patientResponsibility != null
      ? Math.max(0, finSummary.patientResponsibility - collected)
      : 0);
  const showBillingLink = persona !== 'cashier' && persona !== 'clinical' && actions.canBill;
  const primaryIsRecord = primary.kind === 'record';
  const isGatedPrimary = primary.kind === 'clinical'
    && Boolean(markReadyGates || markReadyGatesLoading || markReadyGatesError);
  const markReadyBlocked = Boolean(isGatedPrimary && markReadyGates && !markReadyGates.canMarkReady);
  const primaryDisabled =
    actionBusy
    || journey.isLocked
    || (isGatedPrimary && (markReadyGatesLoading || markReadyGatesError || markReadyBlocked));
  const showUnmarkReady = persona !== 'cashier' && Boolean(onUnmarkReady) && canUnmarkReady(journey, actions);

  const billId = finSummary?.opdBillId ?? null;
  const showReceipts = sections.includes('receipts');
  const [receipts, setReceipts] = useState<OpdBillPayment[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);

  useEffect(() => {
    if (!showReceipts || !billId) {
      setReceipts([]);
      return;
    }
    let cancelled = false;
    setReceiptsLoading(true);
    void getOpdBill(billId)
      .then(bill => {
        if (cancelled) return;
        const payments = (bill.payments ?? [])
          .filter(p => p.receiptNumber || p.status === 'completed')
          .sort((a, b) => new Date(b.paymentDate || b.createdAt).getTime() - new Date(a.paymentDate || a.createdAt).getTime());
        setReceipts(payments);
      })
      .catch(() => {
        if (!cancelled) setReceipts([]);
      })
      .finally(() => {
        if (!cancelled) setReceiptsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showReceipts, billId]);

  return (
    <div
      data-testid={IP_CENSUS_TEST_IDS.rail}
      data-persona={persona}
      className={`ip-target h-full w-full bg-white flex flex-col overflow-hidden ${docked ? '' : ''}`}
      {...(docked ? { role: 'region' as const, 'aria-label': 'Patient context' } : {})}
    >
      <span data-testid={IP_CENSUS_TEST_IDS.persona} className="sr-only">{persona}</span>
      <PatientIdentificationBanner
        journey={journey}
        onClose={onClose}
        showClose
        hideAlertStrip={personaHidesAlertStrip(persona)}
        clinicalAlerts={UNWIRED_CLINICAL_ALERTS}
      />

      <nav className="rail-nav" aria-label="Open in module">
        <button type="button" className="btn sm" onClick={onOpenWard}>Ward</button>
        <button type="button" className="btn sm" onClick={onOpenBilling}>Billing</button>
        <button type="button" className="btn sm" onClick={onOpenOt}>OT</button>
        <button type="button" className="btn sm" onClick={onOpenRecord}>Record</button>
      </nav>

      <div className="flex-1 overflow-y-auto">
        {sections.map(section => (
          <RailSectionView
            key={section}
            section={section}
            journey={journey}
            persona={persona}
            actions={actions}
            situation={situation}
            blockers={blockers}
            finSummary={finSummary}
            preauth={preauth}
            collected={collected}
            due={due}
            showBillingLink={showBillingLink}
            activity={activity}
            auditLoading={auditLoading}
            canApplyEmergencyFc={canApplyEmergencyFc}
            showEmergencyFc={showEmergencyFc}
            emergencyReason={emergencyReason}
            emergencySaving={emergencySaving}
            onOpenBilling={onOpenBilling}
            onOpenRecord={onOpenRecord}
            onTransferBed={onTransferBed}
            onToggleEmergencyFc={onToggleEmergencyFc}
            onEmergencyReasonChange={onEmergencyReasonChange}
            onEmergencyFcSubmit={onEmergencyFcSubmit}
            onDischargeOverride={onDischargeOverride}
            markReadyGates={isGatedPrimary ? markReadyGates : null}
            receipts={receipts}
            receiptsLoading={receiptsLoading}
          />
        ))}
      </div>

      <footer className="rail-foot">
        {actionError && (
          <div className="callout danger">{actionError}</div>
        )}
        {isGatedPrimary && markReadyGatesError && (
          <div className="callout danger">
            Could not verify readiness. Open the full record to continue.
          </div>
        )}
        {isGatedPrimary && markReadyGates && markReadyBlocked && (
          <MarkReadyHardBlockList gates={markReadyGates} onNavigateStep={onOpenPreopStep} />
        )}
        {isGatedPrimary && markReadyGates && markReadyGates.canMarkReady && (
          <MarkReadySoftWarningList gates={markReadyGates} onNavigateStep={onOpenPreopStep} />
        )}
        <div className="actionstack">
          <WristbandPrintControl
            journey={journey}
            canPrint={actions.canPrintSafetyToken}
            variant="rail"
          />
          <button
            type="button"
            data-testid={IP_CENSUS_TEST_IDS.primaryAction}
            disabled={primaryDisabled}
            onClick={onPrimary}
            className="btn primary"
          >
            {actionBusy ? 'Working…' : markReadyGatesLoading && isGatedPrimary ? 'Checking readiness…' : primary.label}
          </button>
          {showUnmarkReady && (
            <button
              type="button"
              data-testid={IP_CENSUS_TEST_IDS.unmarkReady}
              disabled={actionBusy || journey.isLocked}
              onClick={onUnmarkReady}
              className="btn ghost sm"
            >
              Revert ready for OT
            </button>
          )}
          {!primaryIsRecord && (
            <button
              type="button"
              data-testid={IP_CENSUS_TEST_IDS.openFullRecord}
              onClick={onOpenRecord}
              className="btn ghost sm"
            >
              Open full record
            </button>
          )}
        </div>
        {primaryIsRecord && (
          <span data-testid={IP_CENSUS_TEST_IDS.openFullRecord} className="sr-only">Open full record</span>
        )}
      </footer>
    </div>
  );
}

function RailSectionView(props: {
  section: RailSection;
  journey: PatientJourneyRowDto;
  persona: IpPersona;
  actions: IpRoleActions;
  situation: IpRowSituation;
  blockers: ReturnType<typeof blockersForPersona>;
  finSummary: FinSummary;
  preauth: PreauthStatusDto | null;
  collected: number;
  due: number;
  showBillingLink: boolean;
  activity: JourneyAuditLogDto[];
  auditLoading: boolean;
  canApplyEmergencyFc: boolean;
  showEmergencyFc: boolean;
  emergencyReason: string;
  emergencySaving: boolean;
  onOpenBilling: () => void;
  onOpenRecord: () => void;
  onTransferBed: () => void;
  onToggleEmergencyFc: (open: boolean) => void;
  onEmergencyReasonChange: (value: string) => void;
  onEmergencyFcSubmit: (e: FormEvent) => void;
  onDischargeOverride: () => void;
  markReadyGates?: MarkReadyGateResult | null;
  receipts?: OpdBillPayment[];
  receiptsLoading?: boolean;
}) {
  const { section, journey, persona, actions, situation } = props;

  switch (section) {
    case 'status':
      return (
        <div className="rail-sec">
          <div className="row">
            <StatusChip
              status={censusClinicalChip(journey.clinicalState).status}
              label={censusClinicalChip(journey.clinicalState).label}
              size="sm"
            />
            {persona !== 'cashier' && (
              <StatusChip
                status={censusOtChip(journey.otState).status}
                label={censusOtChip(journey.otState).label}
                size="sm"
              />
            )}
            {persona !== 'clinical' && (
              <span className="badge info">{FINANCIAL_LABEL[journey.financialState] ?? journey.financialState}</span>
            )}
            {journey.isEmergencyFc && (
              <span className="badge efc">Emergency FC</span>
            )}
            {journey.admissionType === 'DayCare' && (
              <span className="badge info">Day care</span>
            )}
          </div>
        </div>
      );

    case 'location':
      return (
        <section className="rail-sec">
          <p className="rail-h">Location</p>
          <div className="rail-line">
            <span className="k">Ward · bed</span>
            <span className="v">{situation.location}</span>
          </div>
          {journey.surgeryScheduledAt && (
            <div className="rail-line">
              <span className="k">Scheduled</span>
              <span className="v">{fmtTime(journey.surgeryScheduledAt)}</span>
            </div>
          )}
          <div data-testid={IP_CENSUS_TEST_IDS.railSlot} className="rail-line">
            <span className="k">Slot</span>
            <span className="v">{journey.slotLabel || 'Unassigned'}</span>
          </div>
          {journey.plannedArrivalAt && (
            <div data-testid={IP_CENSUS_TEST_IDS.railArrive} className="rail-line">
              <span className="k">Arrive</span>
              <span className="v">{fmtTime(journey.plannedArrivalAt)}</span>
            </div>
          )}
          {persona !== 'cashier' && (
            <div className="rail-line">
              <span className="k">Next</span>
              <span className="v">{situation.nextAction} ({situation.nextActionOwner})</span>
            </div>
          )}
          {persona === 'cashier' && (
            <div className="rail-line">
              <span className="k">Clinical state</span>
              <span className="v">{CLINICAL_LABEL[journey.clinicalState] ?? journey.clinicalState}</span>
            </div>
          )}
        </section>
      );

    case 'blockers': {
      const gateBlocked = Boolean(props.markReadyGates && !props.markReadyGates.canMarkReady);
      return (
        <section className="rail-sec">
          <p className="rail-h">Blockers</p>
          {props.blockers.length === 0 && !gateBlocked ? (
            <p className="muted">No listed blockers</p>
          ) : props.blockers.length > 0 ? (
            <ul className="blockers">
              {props.blockers.map(item => {
                const hard = item.category === 'Clinical' || item.category === 'Operational';
                return (
                  <li key={`${item.category}-${item.text}`} className={hard ? 'hard' : 'soft'}>
                    <span className="icon">{hard ? '⛔' : '⚠'}</span>
                    <span className="body">
                      {item.category}: {item.text}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {actions.canTransfer && !['Discharged', 'AdmissionCancelled'].includes(journey.clinicalState) && persona !== 'clinical' && (
            <button
              type="button"
              onClick={props.onTransferBed}
              className="btn ghost sm"
              style={{ marginTop: 8 }}
            >
              Transfer bed
            </button>
          )}
        </section>
      );
    }

    case 'money':
      return (
        <section className="rail-sec">
          <p className="rail-h">Payments</p>
          {persona === 'cashier' && props.finSummary?.billNumber && (
            <div className="rail-line">
              <span className="k">Bill</span>
              <span className="v mono">{props.finSummary.billNumber}</span>
            </div>
          )}
          {persona === 'cashier' && props.finSummary?.billedAmount != null && (
            <div className="rail-line">
              <span className="k">Billed</span>
              <span className="v num">{fmtINR(props.finSummary.billedAmount)}</span>
            </div>
          )}
          <div className="rail-line">
            <span className="k">Collected</span>
            <span className="v num">{fmtINR(props.collected)}</span>
          </div>
          <div className={`rail-line ${props.due > 0 ? 'total' : ''}`}>
            <span className="k">Patient due</span>
            <span className="v num">{fmtINR(props.due)}</span>
          </div>
          {props.showBillingLink && (
            <button
              type="button"
              data-testid={IP_CENSUS_TEST_IDS.openBilling}
              onClick={props.onOpenBilling}
              className="btn sm"
              style={{ marginTop: 10 }}
            >
              Open billing
            </button>
          )}
        </section>
      );

    case 'coverage':
      return (
        <CoverageContextBlock
          preauth={props.preauth}
          paymentMode={journey.paymentMode}
          showPayerShare={persona === 'cashier' || persona === 'coordinator' || persona === 'admin'}
          allowRemind={false}
        />
      );

    case 'receipts':
      return (
        <section className="rail-sec" data-testid="ip-rail-receipts">
          <p className="rail-h">Receipts</p>
          {props.receiptsLoading ? (
            <p className="muted">Loading…</p>
          ) : !props.finSummary?.opdBillId ? (
            <p className="muted">No bill yet — collect to issue a receipt.</p>
          ) : (props.receipts ?? []).length === 0 ? (
            <p className="muted">No receipts on this bill.</p>
          ) : (
            <ul className="blockers">
              {(props.receipts ?? []).slice(0, 8).map(p => (
                <li key={p.id}>
                  <span className="body">
                    <span className="mono">{p.receiptNumber || p.paymentReference || 'Payment'}</span>
                    <span className="muted"> · {fmtINR(p.amount)} {(p.paymentMode || '').replace('_', ' ')}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      );

    case 'activity':
      return (
        <section className="rail-sec">
          <p className="rail-h">
            {persona === 'cashier' ? 'Financial activity' : persona === 'clinical' ? 'Clinical activity' : 'Activity'}
          </p>
          {props.auditLoading ? (
            <p className="muted">Loading…</p>
          ) : props.activity.length === 0 ? (
            <p className="muted">No recent activity</p>
          ) : (
            <ul className="blockers">
              {props.activity.map(log => (
                <li key={log.id}>
                  <span className="body">
                    <b>{log.action || log.fieldChanged}</b>
                    {fmtTime(log.performedAt || log.changedAt) && (
                      <span className="muted"> · {fmtTime(log.performedAt || log.changedAt)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={props.onOpenRecord}
            className="btn ghost sm"
            style={{ marginTop: 8 }}
          >
            View all
          </button>
        </section>
      );

    case 'overrides':
      if (!props.canApplyEmergencyFc && !actions.canDischargeOverride) return null;
      return (
        <section className="rail-sec" style={{ background: 'var(--ip-efc-weak)' }}>
          <p className="rail-h">Supervisor overrides</p>
          <p className="muted" style={{ marginBottom: 8 }}>These require a reason and are recorded.</p>
          {props.showEmergencyFc ? (
            <form onSubmit={props.onEmergencyFcSubmit} className="actionstack">
              <textarea
                rows={2}
                value={props.emergencyReason}
                onChange={e => props.onEmergencyReasonChange(e.target.value)}
                placeholder="Reason for emergency financial clearance"
                className="input"
                required
              />
              <div className="row">
                <button
                  type="submit"
                  disabled={props.emergencySaving || !props.emergencyReason.trim()}
                  className="btn sm primary"
                >
                  {props.emergencySaving ? 'Applying…' : 'Apply override'}
                </button>
                <button type="button" onClick={() => props.onToggleEmergencyFc(false)} className="btn sm ghost">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="actionstack">
              {props.canApplyEmergencyFc && !journey.isEmergencyFc && (
                <button
                  type="button"
                  onClick={() => props.onToggleEmergencyFc(true)}
                  className="btn sm"
                >
                  Apply emergency financial clearance
                </button>
              )}
              {actions.canDischargeOverride && journey.clinicalState === 'ReadyForDischarge' && (
                <button
                  type="button"
                  onClick={props.onDischargeOverride}
                  className="btn sm danger"
                >
                  Override discharge block
                </button>
              )}
            </div>
          )}
        </section>
      );

    default:
      return null;
  }
}
