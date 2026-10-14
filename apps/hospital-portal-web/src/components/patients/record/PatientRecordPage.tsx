'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Calendar, ChevronDown, LogIn } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PatientAvatar } from '@/components/patients/PatientAvatar';
import { PatientDataQualityBanner } from '@/components/patients/lookup/PatientDataQualityBanner';
import { IpAdmittedBadge } from '@/components/patients/lookup/IpAdmittedBadge';
import { PatientDirectoryAppointmentDialog } from '@/components/patients/lookup/PatientDirectoryAppointmentDialog';
import { PatientRecordShellHeader } from '@/components/patients/lookup/PatientRecordShellHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { patientLookupApi } from '@/lib/api/patient-lookup.api';
import { useHasAnyPermission, useHasPermission } from '@/hooks/use-permissions';
import { BILLING_DESK_VIEW_PERMISSIONS } from '@/lib/ip-management/collect-payment';
import { calcPatientAge, formatPatientSex } from '@/lib/patients/patient-display-utils';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { mapLegacyRecordTabToPatient360Section } from '@/lib/patients/patient-360-legacy-tab';
import { resolvePatient360PrimaryActions } from '@/lib/patients/patient-360-primary-actions';
import {
  isPatient360SectionKey,
  parsePatient360Section,
  type Patient360SectionKey,
} from '@/lib/patients/patient-360-sections';
import { buildFrontDeskCheckInHref } from '@/lib/patients/patient-handoff';
import { patientEncounterUrl, patientPrintSummaryUrl } from '@/lib/patients/patient-routes';
import { usePatientRecord } from './PatientRecordProvider';
import { Patient360SectionNav } from './Patient360SectionNav';
import { Patient360SectionBody } from './Patient360SectionBody';
import { Patient360OverviewPanel } from './Patient360Overview';
import { Patient360ClinicalPanel } from './Patient360Clinical';
import { Patient360AdministrationPanel } from './Patient360Administration';
import { Patient360CarePanel } from './Patient360Care';
import { Patient360CoveragePanel } from './Patient360Coverage';
import { Patient360DocumentsPanel } from './Patient360Documents';
import { Patient360TimelinePanel } from './Patient360Timeline';
import { PatientDuplicateHintBanner } from './PatientDuplicateHintBanner';

function acuityBadgeVariant(acuity: string): 'destructive' | 'secondary' | 'outline' {
  if (acuity === 'critical' || acuity === 'high') return 'destructive';
  if (acuity === 'medium') return 'outline';
  return 'secondary';
}

function SummaryHeader({ onExportPdf, exporting }: { onExportPdf: () => void; exporting: boolean }) {
  const { summary } = usePatientRecord();
  const canBookAppointment = useHasPermission('appointment.view');
  const canExportPdf = useHasPermission('patient.export');
  const canViewBilling = useHasAnyPermission([...BILLING_DESK_VIEW_PERMISSIONS]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  if (!summary) return null;

  const name = `${summary.firstName} ${summary.lastName}`;
  const age = calcPatientAge(summary.dateOfBirth);
  const sex = formatPatientSex(summary.gender);
  const { canContinueEncounter, canOfferCheckIn } = resolvePatient360PrimaryActions({
    assignedVisitId: summary.assignedVisitId,
    scheduledAt: summary.scheduledAt,
  });
  const contextLine = [summary.currentStation, summary.assignedProviderName, summary.assignedProviderRole]
    .filter(Boolean)
    .join(' · ');
  const engagement = summary.activeEngagements
    .map((item) => [item.label, item.status].filter(Boolean).join(' · '))
    .filter(Boolean)
    .join('; ');
  const printHref = patientPrintSummaryUrl(summary.id);
  const billingHref = `/dashboard/billing/opd?patientId=${summary.id}`;

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <PatientAvatar
            size="md"
            firstName={summary.firstName}
            lastName={summary.lastName}
            photoUrl={summary.photoThumbnailUrl}
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-gray-900">{name}</h1>
            <p className="mt-0.5 text-sm text-gray-600">
              <span className="font-mono text-xs text-gray-500">MRN {summary.mrn}</span>
              {' · '}
              {age != null ? `${age}y` : '—'}
              {' · '}
              {sex ?? '—'}
            </p>
            {summary.reasonForVisit ? (
              <p className="mt-1 truncate text-sm text-gray-700">
                <span className="text-gray-500">Visit:</span> {summary.reasonForVisit}
              </p>
            ) : null}
            {contextLine ? <p className="mt-0.5 text-sm text-gray-700">{contextLine}</p> : null}
            {engagement ? (
              <p className="mt-0.5 text-sm text-gray-700">
                <span className="text-gray-500">Engagement:</span> {engagement}
              </p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <IpAdmittedBadge admission={summary.ipAdmission} />
              {summary.clinicalAcuity ? (
                <Badge variant={acuityBadgeVariant(summary.clinicalAcuity)} className="capitalize">
                  {summary.clinicalAcuity} acuity
                </Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end" aria-label="Patient actions">
          {canContinueEncounter && summary.assignedVisitId ? (
            <Button asChild size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Link href={patientEncounterUrl(summary.id, summary.assignedVisitId)}>
                Continue encounter
              </Link>
            </Button>
          ) : null}
          {canOfferCheckIn ? (
            <Button
              asChild
              size="sm"
              variant={canContinueEncounter ? 'outline' : 'default'}
              className={canContinueEncounter ? undefined : 'bg-emerald-600 text-white hover:bg-emerald-700'}
            >
              <Link href={buildFrontDeskCheckInHref(summary.id)} aria-label="Check-in">
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Check-in</span>
              </Link>
            </Button>
          ) : null}
          {canBookAppointment ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label="Schedule"
              data-testid={patientLookupTestIds.recordSchedule}
              onClick={() => setScheduleOpen(true)}
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              Schedule
            </Button>
          ) : null}
          {canViewBilling ? (
            <Button asChild size="sm" variant="outline">
              <Link href={billingHref} aria-label="Billing" data-testid={patientLookupTestIds.recordBilling}>
                Billing
              </Link>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <Link href={printHref} target="_blank" data-testid={patientLookupTestIds.recordPrint}>
              Print
            </Link>
          </Button>
          {canExportPdf ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="hidden sm:inline-flex"
              onClick={onExportPdf}
              disabled={exporting}
              data-testid={patientLookupTestIds.recordExportPdf}
            >
              {exporting ? 'Exporting…' : 'Export PDF'}
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="sm:hidden"
                aria-label="Summary"
                data-testid={patientLookupTestIds.recordSummaryOverflow}
              >
                Summary
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link href={printHref} target="_blank">
                  Print
                </Link>
              </DropdownMenuItem>
              {canExportPdf ? (
                <DropdownMenuItem onClick={onExportPdf} disabled={exporting}>
                  {exporting ? 'Exporting…' : 'Export PDF'}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {canBookAppointment ? (
        <PatientDirectoryAppointmentDialog
          patientId={summary.id}
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
        />
      ) : null}
    </div>
  );
}

export function PatientRecordPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { summaryQuery, summary, branchId } = usePatientRecord();
  const [exporting, setExporting] = useState(false);

  const tabFromUrl = searchParams.get('tab');
  const sectionFromUrl = searchParams.get('section');
  const mappedSection = mapLegacyRecordTabToPatient360Section(tabFromUrl);
  const section = parsePatient360Section(
    mappedSection && !sectionFromUrl ? mappedSection : sectionFromUrl,
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;

    if (tabFromUrl) {
      const mapped = mapLegacyRecordTabToPatient360Section(tabFromUrl);
      params.delete('tab');
      if (mapped && !isPatient360SectionKey(sectionFromUrl)) {
        if (mapped === 'overview') params.delete('section');
        else params.set('section', mapped);
      }
      changed = true;
    }

    if (sectionFromUrl && !isPatient360SectionKey(sectionFromUrl)) {
      params.delete('section');
      changed = true;
    }

    if (!changed) return;
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [tabFromUrl, sectionFromUrl, pathname, router, searchParams]);

  const setSectionWithUrl = useCallback(
    (next: Patient360SectionKey) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('tab');
      if (next === 'overview') params.delete('section');
      else params.set('section', next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const patientName = summary ? `${summary.firstName} ${summary.lastName}` : 'Patient';

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

  if (summaryQuery.isLoading) {
    return (
      <div className="p-6" data-testid={patientLookupTestIds.recordShell}>
        <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 h-40 animate-pulse rounded-xl bg-gray-100" />
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
    <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 md:px-6" data-testid={patientLookupTestIds.recordShell}>
      <div className="mb-3">
        <PatientRecordShellHeader patientName={patientName} mrn={summary.mrn} omitIdentity />
      </div>

      <SummaryHeader onExportPdf={handleExportPdf} exporting={exporting} />

      <div className="mt-3 space-y-2" aria-label="Patient alerts">
        <PatientDuplicateHintBanner
          patientId={summary.id}
          firstName={summary.firstName}
          lastName={summary.lastName}
          dateOfBirth={summary.dateOfBirth}
          phone={summary.phone}
          email={summary.email}
        />
        {summary.dataQuality && (
          <PatientDataQualityBanner dataQuality={summary.dataQuality} />
        )}
        {summary.allergies?.trim() ? (
          <Alert variant="warning">
            <AlertTitle>Allergy</AlertTitle>
            <AlertDescription>{summary.allergies.trim()}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="mt-3 min-w-0 w-full">
        <div className="rounded-xl border border-gray-200 bg-white">
          <Patient360SectionNav active={section} onSelect={setSectionWithUrl} />
          {section === 'overview' ? (
            <Patient360OverviewPanel />
          ) : section === 'clinical' ? (
            <Patient360ClinicalPanel />
          ) : section === 'administration' ? (
            <Patient360AdministrationPanel />
          ) : section === 'care' ? (
            <Patient360CarePanel />
          ) : section === 'coverage' ? (
            <Patient360CoveragePanel />
          ) : section === 'documents' ? (
            <Patient360DocumentsPanel />
          ) : section === 'timeline' ? (
            <Patient360TimelinePanel />
          ) : (
            <Patient360SectionBody section={section} />
          )}
        </div>
      </div>
    </div>
  );
}
