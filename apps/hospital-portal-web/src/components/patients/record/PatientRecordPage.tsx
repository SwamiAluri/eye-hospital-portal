'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, Phone, Printer } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PatientAvatar } from '@/components/patients/PatientAvatar';
import { QuickActionsToolbar } from '@/components/patients/QuickActionsToolbar';
import { EmergencyOverrideDialog } from '@/components/patients/EmergencyOverrideDialog';
import { PatientDataQualityBanner } from '@/components/patients/lookup/PatientDataQualityBanner';
import { IpAdmittedBadge } from '@/components/patients/lookup/IpAdmittedBadge';
import { PatientRecordShellHeader } from '@/components/patients/lookup/PatientRecordShellHeader';
import { patientLookupApi } from '@/lib/api/patient-lookup.api';
import {
  calcPatientAge,
  formatCareProgramLabel,
} from '@/lib/patients/patient-display-utils';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import {
  isPatientRecordTabKey,
  type PatientRecordTabKey,
} from '@/lib/patients/patient-record-tabs';
import { patientEncounterUrl, patientPrintSummaryUrl } from '@/lib/patients/patient-routes';
import { cn } from '@/lib/utils';
import { PatientRecordNav } from './PatientRecordNav';
import { usePatientRecord } from './PatientRecordProvider';
import { PatientRecordTabGroups } from './PatientRecordTabGroups';
import { PatientRecordTabContent } from './PatientRecordTabContent';
import { PatientWorkspaceTabs } from './PatientWorkspaceTabs';
import { PatientSwitcherRail } from './PatientSwitcherRail';
import { ChartLayoutEditorButton } from './ChartLayoutEditor';
import { useOptionalPatientWorkspace } from './PatientWorkspaceProvider';
import { PatientDuplicateHintBanner } from './PatientDuplicateHintBanner';
import { usePatientCheckInGate } from '@/hooks/use-patient-check-in-gate';
import { checkInGateLabel } from '@/lib/patients/patient-record-gate';

function AcuityBadge({ acuity }: { acuity: string }) {
  const styles =
    acuity === 'critical'
      ? 'bg-red-100 text-red-800'
      : acuity === 'high'
        ? 'bg-orange-100 text-orange-800'
        : acuity === 'medium'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-slate-100 text-slate-700';
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-md capitalize', styles)}>
      {acuity} acuity
    </span>
  );
}

function SummaryHeader({ onExportPdf, exporting }: { onExportPdf: () => void; exporting: boolean }) {
  const { summary } = usePatientRecord();
  if (!summary) return null;

  const name = `${summary.firstName} ${summary.lastName}`;
  const age = calcPatientAge(summary.dateOfBirth);

  return (
    <div className="sticky top-0 z-10 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="px-4 py-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <PatientAvatar
            size="md"
            firstName={summary.firstName}
            lastName={summary.lastName}
            photoUrl={summary.photoThumbnailUrl}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{name}</h2>
              <span className="text-xs font-mono text-gray-500">MRN {summary.mrn}</span>
            </div>
            <p className="text-sm text-gray-600 mt-0.5">
              {age != null ? `${age}y` : '—'} · {summary.gender}
              {summary.phone ? (
                <>
                  {' '}
                  ·{' '}
                  <a href={`tel:${summary.phone}`} className="inline-flex items-center gap-1 text-emerald-700">
                    <Phone className="w-3.5 h-3.5" />
                    {summary.phone}
                  </a>
                </>
              ) : null}
            </p>
            {summary.reasonForVisit && (
              <p className="text-sm text-gray-700 mt-1 truncate max-w-[680px]">
                <span className="text-gray-500">Reason:</span> {summary.reasonForVisit}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <IpAdmittedBadge admission={summary.ipAdmission} />
              <AcuityBadge acuity={summary.clinicalAcuity} />
              {summary.careProgramCodes.map((code) => (
                <span
                  key={code}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-violet-50 text-violet-800 ring-1 ring-violet-100"
                >
                  {formatCareProgramLabel(code)}
                </span>
              ))}
              {summary.activeEngagements.map((e) => (
                <span
                  key={`${e.type}-${e.label}`}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
                >
                  {e.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PatientRecordNav patientId={summary.id} />
          <Link
            href={patientPrintSummaryUrl(summary.id)}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
            data-testid={patientLookupTestIds.recordPrint}
          >
            <Printer className="w-4 h-4" />
            Print
          </Link>
          <button
            type="button"
            onClick={onExportPdf}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
            data-testid={patientLookupTestIds.recordExportPdf}
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting…' : 'PDF'}
          </button>
          {summary.assignedVisitId && (
            <Link
              href={patientEncounterUrl(summary.id, summary.assignedVisitId)}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Continue encounter
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function RecentVisitsRail() {
  const { recentVisits, recentVisitsQuery } = usePatientRecord();

  return (
    <aside className="w-full lg:w-[300px] shrink-0">
      <div className="bg-white border border-gray-200 rounded-xl p-4 sticky top-4">
        <h3 className="text-sm font-semibold text-gray-900">Recent visits</h3>

        {recentVisitsQuery.isLoading && (
          <div className="mt-3 text-sm text-gray-500">Loading…</div>
        )}

        {!recentVisitsQuery.isLoading && (recentVisits?.length ?? 0) === 0 && (
          <div className="mt-3 text-sm text-gray-500">No recent visits found.</div>
        )}

        <div className="mt-3 space-y-2">
          {recentVisits?.map((v) => (
            <div key={v.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="text-xs text-gray-500">
                {v.checkedInAt ? new Date(v.checkedInAt).toLocaleString() : '—'}
              </div>
              <div className="text-sm font-medium text-gray-900">{v.status}</div>
              {v.tokenNumber && (
                <div className="text-xs text-gray-600 mt-0.5">Token {v.tokenNumber}</div>
              )}
              {v.currentStation && (
                <div className="text-xs text-gray-600 mt-0.5">{v.currentStation}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function PatientRecordPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { summaryQuery, summary, branchId } = usePatientRecord();
  const workspace = useOptionalPatientWorkspace();
  const touchPatient = workspace?.touchPatient;
  const [exporting, setExporting] = useState(false);
  const [overrideTab, setOverrideTab] = useState<PatientRecordTabKey | null>(null);
  const [isOverriding, setIsOverriding] = useState(false);

  const checkInGate = usePatientCheckInGate(summary?.id, summary?.assignedVisitId);

  const tabFromUrl = searchParams.get('tab');
  const initialTab: PatientRecordTabKey = isPatientRecordTabKey(tabFromUrl)
    ? tabFromUrl
    : 'overview';
  const [tab, setTab] = useState<PatientRecordTabKey>(initialTab);

  useEffect(() => {
    if (isPatientRecordTabKey(tabFromUrl) && tabFromUrl !== tab) {
      setTab(tabFromUrl);
    }
  }, [tabFromUrl, tab]);

  const setTabWithUrl = useCallback(
    (next: PatientRecordTabKey) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'overview') params.delete('tab');
      else params.set('tab', next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const patientName = summary
    ? `${summary.firstName} ${summary.lastName}`
    : 'Patient';

  useEffect(() => {
    if (!summary || !touchPatient) return;
    touchPatient({
      id: summary.id,
      firstName: summary.firstName,
      lastName: summary.lastName,
      mrn: summary.mrn,
    });
  }, [summary, touchPatient]);

  const handleExportPdf = async () => {
    if (!summary || !branchId) return;
    try {
      setExporting(true);
      const blob = await patientLookupApi.exportSummaryPdf(summary.id, branchId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patient-summary-${summary.mrn || summary.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch {
      toast.error('PDF export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleTabSelect = useCallback(
    (next: PatientRecordTabKey) => {
      setTabWithUrl(next);
    },
    [setTabWithUrl],
  );

  const handleRequestOverride = useCallback((tabKey: PatientRecordTabKey) => {
    setOverrideTab(tabKey);
  }, []);

  const handleOverride = async (reason: string) => {
    if (!summary || !overrideTab) return;
    setIsOverriding(true);
    try {
      console.log('EMERGENCY OVERRIDE LOGGED:', {
        patientId: summary.id,
        tab: overrideTab,
        reason,
        timestamp: new Date().toISOString(),
      });
      checkInGate.grantOverride(overrideTab);
      setTabWithUrl(overrideTab);
      setOverrideTab(null);
      toast.success('Override granted — this action was logged');
    } catch {
      toast.error('Override failed');
    } finally {
      setIsOverriding(false);
    }
  };

  if (summaryQuery.isLoading) {
    return (
      <div className="p-6" data-testid={patientLookupTestIds.recordShell}>
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="mt-4 h-40 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (summaryQuery.isError || !summary) {
    return (
      <div className="p-6" data-testid={patientLookupTestIds.recordShell}>
        <PatientRecordShellHeader patientName="Patient" mrn={null} />
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load patient summary.
        </div>
      </div>
    );
  }

  return (
    <>
      <PatientWorkspaceTabs />
      <div className="px-6 py-5" data-testid={patientLookupTestIds.recordShell}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <PatientRecordShellHeader patientName={patientName} mrn={summary.mrn} />
        <QuickActionsToolbar
          variant="compact"
          patientId={summary.id}
          patientName={patientName}
          onExportPdf={handleExportPdf}
          onOpenScheduling={() => setTabWithUrl('scheduling')}
          onOpenBilling={() => setTabWithUrl('billing')}
          onOpenCounseling={() => setTabWithUrl('counseling')}
          onOpenInsurance={() => setTabWithUrl('insurance')}
        />
      </div>

      <PatientDuplicateHintBanner
        patientId={summary.id}
        firstName={summary.firstName}
        lastName={summary.lastName}
        dateOfBirth={summary.dateOfBirth}
        phone={summary.phone}
        email={summary.email}
      />

      {summary.dataQuality && (
        <PatientDataQualityBanner dataQuality={summary.dataQuality} className="mb-4" />
      )}

      <SummaryHeader onExportPdf={handleExportPdf} exporting={exporting} />

      <div className="mt-4 flex flex-col lg:flex-row gap-4 items-start">
        <PatientSwitcherRail activePatientId={summary.id} />

        <div className="flex-1 min-w-0 space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <PatientRecordTabGroups
              activeTab={tab}
              onTabChange={handleTabSelect}
              trailing={tab === 'overview' ? <ChartLayoutEditorButton /> : undefined}
            />

            <div className="p-4">
              <PatientRecordTabContent
                tab={tab}
                patientId={summary.id}
                summary={summary}
                onOpenTab={handleTabSelect}
                isCheckedIn={checkInGate.isCheckedIn}
                canOverride={checkInGate.canOverride}
                isTabAccessible={checkInGate.isTabAccessible}
                onRequestOverride={handleRequestOverride}
              />
            </div>
          </div>
        </div>

        <RecentVisitsRail />
      </div>
      </div>

      <EmergencyOverrideDialog
        isOpen={overrideTab != null}
        onClose={() => setOverrideTab(null)}
        onOverride={handleOverride}
        patientName={patientName}
        tabName={overrideTab ? checkInGateLabel(overrideTab) : ''}
        isLoading={isOverriding}
      />
    </>
  );
}
