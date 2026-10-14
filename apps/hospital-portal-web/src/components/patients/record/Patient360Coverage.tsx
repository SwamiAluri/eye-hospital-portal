'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  financialEmptyMessage,
  financialUnauthorizedMessage,
  financialUnavailableMessage,
  loadPatient360Bills,
  type FinancialListResult,
} from '@/lib/patients/patient-360-financial';
import {
  claimEmptyMessage,
  claimUnauthorizedMessage,
  claimUnavailableMessage,
  loadPatient360Claims,
  type ClaimListResult,
} from '@/lib/patients/patient-360-claims';
import {
  settlementEmptyMessage,
  settlementUnauthorizedMessage,
  settlementUnavailableMessage,
  loadPatient360Settlements,
  type SettlementListResult,
} from '@/lib/patients/patient-360-settlements';
import {
  eligibilityEmptyMessage,
  eligibilityUnauthorizedMessage,
  eligibilityUnavailableMessage,
  loadPatient360Eligibility,
  type EligibilityListResult,
} from '@/lib/patients/patient-360-eligibility';
import {
  authorizationEmptyMessage,
  authorizationUnauthorizedMessage,
  authorizationUnavailableMessage,
  loadPatient360Authorizations,
  type AuthorizationListResult,
} from '@/lib/patients/patient-360-authorizations';
import {
  coverageCaseEmptyMessage,
  coverageCaseUnauthorizedMessage,
  coverageCaseUnavailableMessage,
  loadPatient360CoverageCases,
  type CoverageCaseListResult,
} from '@/lib/patients/patient-360-coverage-cases';
import {
  insuranceProfileEmptyMessage,
  insuranceProfileUnauthorizedMessage,
  insuranceProfileUnavailableMessage,
  loadPatient360InsuranceProfiles,
  type InsuranceProfileListResult,
} from '@/lib/patients/patient-360-insurance-profile';
import { patientLookupTestIds } from '@/lib/patients/patient-lookup-test-ids';
import { usePatientRecord } from './PatientRecordProvider';
import { Patient360ListPagination } from './Patient360ListPagination';
import {
  Patient360RecordTable,
  Patient360Section,
  patient360Honesty,
} from './Patient360RecordTable';

export function Patient360CoverageView({
  insurance,
  financial,
  coverageCases = null,
  authorizations = null,
  eligibility = null,
  claims = null,
  settlements = null,
  onCoverageCasesPageChange,
  onAuthorizationsPageChange,
  onEligibilityPageChange,
  onClaimsPageChange,
  onSettlementsPageChange,
  patientId = null,
}: {
  insurance: InsuranceProfileListResult | null;
  financial: FinancialListResult | null;
  coverageCases?: CoverageCaseListResult | null;
  authorizations?: AuthorizationListResult | null;
  eligibility?: EligibilityListResult | null;
  claims?: ClaimListResult | null;
  settlements?: SettlementListResult | null;
  onCoverageCasesPageChange?: (page: number) => void;
  onAuthorizationsPageChange?: (page: number) => void;
  onEligibilityPageChange?: (page: number) => void;
  onClaimsPageChange?: (page: number) => void;
  onSettlementsPageChange?: (page: number) => void;
  patientId?: string | null;
}) {
  return (
    <>
      {patientId ? (
        <p className="mb-3 flex flex-wrap gap-3 text-sm">
          <Link
            href={`/dashboard/billing/opd?patientId=${patientId}`}
            className="font-medium text-emerald-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            Open Billing
          </Link>
        </p>
      ) : null}
      <div className="space-y-4">
        <Patient360Section title="Insurance">
          <h4 className="sr-only">Insurance Profile</h4>
          <p className="sr-only">Source: Patient Insurance Profile</p>
          <Patient360RecordTable
            caption="Insurance"
            columns={[
              { header: 'Payer' },
              { header: 'Plan' },
              { header: 'Member ID' },
              { header: 'Policy number' },
              { header: 'Status' },
              { header: 'Valid Through' },
              { header: 'Policy copay', align: 'right' },
              { header: 'Policy deductible', align: 'right' },
              { header: 'Out-of-pocket maximum', align: 'right' },
            ]}
            emptyState={patient360Honesty(insurance, {
              empty: insuranceProfileEmptyMessage(),
              unauthorized: insuranceProfileUnauthorizedMessage(),
              unavailable: insuranceProfileUnavailableMessage(),
              loading: 'Loading insurance profile.',
            })}
            rows={insurance?.state === 'ready' ? insurance.rows.map((row) => ({
              id: row.id,
              cells: [
                row.providerName ?? '—',
                row.planName ?? '—',
                row.subscriberId ?? '—',
                row.policyNumber ?? '—',
                row.deletedAt ? `${row.status ?? '—'} · Deleted at ${row.deletedAt}` : row.status ?? '—',
                row.endDate ?? '—',
                row.copayAmount ?? '—',
                row.deductibleAmount ?? '—',
                row.outOfPocketMax ?? '—',
              ],
            })) : []}
          />
        </Patient360Section>

        <Patient360Section title="Authorizations">
          <p className="sr-only">Source: CCMS Authorization</p>
          <Patient360RecordTable
            caption="Authorizations"
            columns={[
              { header: 'Service' },
              { header: 'Requested' },
              { header: 'Approved' },
              { header: 'Status' },
              { header: 'Valid Through' },
              { header: 'TPA reference' },
            ]}
            emptyState={patient360Honesty(authorizations, {
              empty: authorizationEmptyMessage(),
              unauthorized: authorizationUnauthorizedMessage(),
              unavailable: authorizationUnavailableMessage(),
              loading: 'Loading authorizations.',
            })}
            rows={authorizations?.state === 'ready' ? authorizations.rows.map((row) => ({
              id: row.id,
              cells: [
                [row.authorizationType, row.preAuthNumber].filter(Boolean).join(' · ') || '—',
                row.requestedAmount ?? '—',
                row.approvedAmount ?? '—',
                row.processStatus ?? '—',
                row.validTo ?? '—',
                row.tpaReferenceNumber ?? '—',
              ],
            })) : []}
          />
          {authorizations && onAuthorizationsPageChange ? (
            <Patient360ListPagination
              label="Authorizations"
              currentPage={authorizations.pageNumber ?? 1}
              pageSize={authorizations.pageSize ?? 20}
              totalCount={authorizations.totalCount ?? 0}
              onPageChange={onAuthorizationsPageChange}
            />
          ) : null}
        </Patient360Section>

        <Patient360Section title="Claims">
          <p className="sr-only">Source: CCMS Claims</p>
          <Patient360RecordTable
            caption="Claims"
            columns={[
              { header: 'Claim' },
              { header: 'Service' },
              { header: 'Submitted' },
              { header: 'Claimed amount', align: 'right' },
              { header: 'Status' },
              { header: 'Query status' },
            ]}
            emptyState={patient360Honesty(claims, {
              empty: claimEmptyMessage(),
              unauthorized: claimUnauthorizedMessage(),
              unavailable: claimUnavailableMessage(),
              loading: 'Loading claims.',
            })}
            rows={claims?.state === 'ready' ? claims.rows.map((row) => ({
              id: row.id,
              cells: [
                row.claimNumber ?? '—',
                row.claimType ?? '—',
                row.submittedAt ?? '—',
                row.claimedAmount ?? '—',
                row.status ?? '—',
                row.queryStatus ?? '—',
              ],
            })) : []}
          />
          {claims && onClaimsPageChange ? (
            <Patient360ListPagination
              label="Claims"
              currentPage={claims.pageNumber ?? 1}
              pageSize={claims.pageSize ?? 20}
              totalCount={claims.totalCount ?? 0}
              onPageChange={onClaimsPageChange}
            />
          ) : null}
        </Patient360Section>

        <Patient360Section title="OPD billing">
          <h3 className="sr-only">Financial</h3>
          <p className="sr-only">Source: OPD bills</p>
          <Patient360RecordTable
            caption="OPD billing"
            columns={[
              { header: 'Date' },
              { header: 'Encounter' },
              { header: 'Bill' },
              { header: 'Net amount', align: 'right' },
              { header: 'Balance due', align: 'right' },
              { header: 'Status' },
              { header: 'Action' },
            ]}
            emptyState={patient360Honesty(financial, {
              empty: financialEmptyMessage(),
              unauthorized: financialUnauthorizedMessage(),
              unavailable: financialUnavailableMessage(),
              loading: 'Loading financial.',
            })}
            rows={financial?.state === 'ready' ? financial.rows.map((row) => ({
              id: row.id,
              cells: [
                row.billDate ?? '—',
                '—',
                row.billNumber ?? '—',
                row.netAmount ?? '—',
                row.balanceDue ?? '—',
                row.status ?? '—',
                patientId ? (
                  <Link
                    href={`/dashboard/billing/opd?patientId=${patientId}`}
                    className="font-medium text-emerald-700 underline-offset-2 hover:underline"
                  >
                    Open Billing
                  </Link>
                ) : '—',
              ],
            })) : []}
          />
        </Patient360Section>

        <Patient360Section title="Coverage Cases">
          <p className="sr-only">Source: CCMS Coverage Cases</p>
          <Patient360RecordTable
            caption="Coverage cases"
            columns={[
              { header: 'Case' },
              { header: 'Payer' },
              { header: 'Payer type' },
              { header: 'Status' },
              { header: 'Approved amount', align: 'right' },
              { header: 'Pre-auth number' },
            ]}
            emptyState={patient360Honesty(coverageCases, {
              empty: coverageCaseEmptyMessage(),
              unauthorized: coverageCaseUnauthorizedMessage(),
              unavailable: coverageCaseUnavailableMessage(),
              loading: 'Loading coverage cases.',
            })}
            rows={coverageCases?.state === 'ready' ? coverageCases.rows.map((row) => ({
              id: row.id,
              cells: [
                row.caseNumber ?? '—',
                row.insurerName ?? '—',
                row.payerType ?? '—',
                row.currentState ?? '—',
                row.approvedAmount ?? '—',
                row.preAuthNumber ?? '—',
              ],
            })) : []}
          />
          {coverageCases && onCoverageCasesPageChange ? (
            <Patient360ListPagination
              label="Coverage cases"
              currentPage={coverageCases.pageNumber ?? 1}
              pageSize={coverageCases.pageSize ?? 20}
              totalCount={coverageCases.totalCount ?? 0}
              onPageChange={onCoverageCasesPageChange}
            />
          ) : null}
        </Patient360Section>

        <Patient360Section title="Eligibility">
          <p className="sr-only">Source: CCMS Eligibility</p>
          <Patient360RecordTable
            caption="Eligibility"
            columns={[
              { header: 'Policy' },
              { header: 'Member ID' },
              { header: 'Method' },
              { header: 'Status' },
              { header: 'Checked at' },
            ]}
            emptyState={patient360Honesty(eligibility, {
              empty: eligibilityEmptyMessage(),
              unauthorized: eligibilityUnauthorizedMessage(),
              unavailable: eligibilityUnavailableMessage(),
              loading: 'Loading eligibility.',
            })}
            rows={eligibility?.state === 'ready' ? eligibility.rows.map((row) => ({
              id: row.id,
              cells: [row.policyNumber ?? '—', row.membershipId ?? '—', row.checkMethod ?? '—', row.eligible ?? '—', row.checkedAt ?? '—'],
            })) : []}
          />
          {eligibility && onEligibilityPageChange ? (
            <Patient360ListPagination
              label="Eligibility"
              currentPage={eligibility.pageNumber ?? 1}
              pageSize={eligibility.pageSize ?? 20}
              totalCount={eligibility.totalCount ?? 0}
              onPageChange={onEligibilityPageChange}
            />
          ) : null}
        </Patient360Section>

        <Patient360Section title="Settlement">
          <p className="sr-only">Source: CCMS Settlement</p>
          <Patient360RecordTable
            caption="Settlement"
            columns={[
              { header: 'Settlement' },
              { header: 'Claim' },
              { header: 'Amount', align: 'right' },
              { header: 'Status' },
              { header: 'Date' },
              { header: 'Type' },
            ]}
            emptyState={patient360Honesty(settlements, {
              empty: settlementEmptyMessage(),
              unauthorized: settlementUnauthorizedMessage(),
              unavailable: settlementUnavailableMessage(),
              loading: 'Loading settlements.',
            })}
            rows={settlements?.state === 'ready' ? settlements.rows.map((row) => ({
              id: row.id,
              cells: [
                row.settlementNumber ?? '—',
                row.claimNumber ?? '—',
                row.settledAmount ?? '—',
                row.reconciliationStatus ?? '—',
                row.settledAt ?? row.paymentDate ?? '—',
                [row.settlementType, row.caseNumber, row.claimAmount].filter(Boolean).join(' · ') || '—',
              ],
            })) : []}
          />
          {settlements?.state === 'ready' && onSettlementsPageChange ? (
            <Patient360ListPagination
              label="Settlements"
              currentPage={settlements.pageNumber ?? 1}
              pageSize={settlements.pageSize ?? 20}
              totalCount={settlements.totalCount ?? 0}
              onPageChange={onSettlementsPageChange}
            />
          ) : null}
        </Patient360Section>
      </div>
    </>
  );
}

export function Patient360CoveragePanel() {
  const { patientId } = usePatientRecord();
  const [insurance, setInsurance] = useState<InsuranceProfileListResult | null>(null);
  const [financial, setFinancial] = useState<FinancialListResult | null>(null);
  const [coverageCases, setCoverageCases] = useState<CoverageCaseListResult | null>(null);
  const [authorizations, setAuthorizations] = useState<AuthorizationListResult | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityListResult | null>(null);
  const [claims, setClaims] = useState<ClaimListResult | null>(null);
  const [settlements, setSettlements] = useState<SettlementListResult | null>(null);
  const [coveragePage, setCoveragePage] = useState(1);
  const [authorizationPage, setAuthorizationPage] = useState(1);
  const [eligibilityPage, setEligibilityPage] = useState(1);
  const [claimsPage, setClaimsPage] = useState(1);
  const [settlementsPage, setSettlementsPage] = useState(1);

  useEffect(() => {
    setCoveragePage(1);
    setAuthorizationPage(1);
    setEligibilityPage(1);
    setClaimsPage(1);
    setSettlementsPage(1);
  }, [patientId]);

  useEffect(() => {
    let cancelled = false;
    setInsurance(null);
    setFinancial(null);
    void loadPatient360InsuranceProfiles(patientId).then((next) => {
      if (!cancelled) setInsurance(next);
    });
    void loadPatient360Bills(patientId).then((next) => {
      if (!cancelled) setFinancial(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  useEffect(() => {
    let cancelled = false;
    setCoverageCases(null);
    void loadPatient360CoverageCases(patientId, coveragePage).then((next) => {
      if (!cancelled) setCoverageCases(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, coveragePage]);

  useEffect(() => {
    let cancelled = false;
    setAuthorizations(null);
    void loadPatient360Authorizations(patientId, authorizationPage).then((next) => {
      if (!cancelled) setAuthorizations(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, authorizationPage]);

  useEffect(() => {
    let cancelled = false;
    setEligibility(null);
    void loadPatient360Eligibility(patientId, eligibilityPage).then((next) => {
      if (!cancelled) setEligibility(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, eligibilityPage]);

  useEffect(() => {
    let cancelled = false;
    setClaims(null);
    void loadPatient360Claims(patientId, claimsPage).then((next) => {
      if (!cancelled) setClaims(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, claimsPage]);

  useEffect(() => {
    let cancelled = false;
    setSettlements(null);
    void loadPatient360Settlements(patientId, settlementsPage).then((next) => {
      if (!cancelled) setSettlements(next);
    });
    return () => {
      cancelled = true;
    };
  }, [patientId, settlementsPage]);

  return (
    <section
      id="patient-360-panel-coverage"
      role="tabpanel"
      aria-labelledby="patient-360-tab-coverage"
      className="p-4"
      data-testid={patientLookupTestIds.recordSectionPanel('coverage')}
    >
      <Patient360CoverageView
        insurance={insurance}
        financial={financial}
        coverageCases={coverageCases}
        authorizations={authorizations}
        eligibility={eligibility}
        claims={claims}
        settlements={settlements}
        onCoverageCasesPageChange={setCoveragePage}
        onAuthorizationsPageChange={setAuthorizationPage}
        onEligibilityPageChange={setEligibilityPage}
        onClaimsPageChange={setClaimsPage}
        onSettlementsPageChange={setSettlementsPage}
        patientId={patientId}
      />
    </section>
  );
}
