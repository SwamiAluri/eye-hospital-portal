import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '../../../../..');
const webRoot = join(__dirname, '../../..');

describe('Phase 5 E2E architecture residual checks', () => {
  it('CCMS consumer uses shared IntegrationIdempotencyGuard', () => {
    const guard = readFileSync(
      join(repoRoot, 'microservices/ccms-service/CcmsApi/Services/IntegrationIdempotencyGuard.cs'),
      'utf8',
    );
    const iface = readFileSync(
      join(repoRoot, 'microservices/ccms-service/CcmsApi/Services/IIntegrationIdempotencyGuard.cs'),
      'utf8',
    );
    const fn = readFileSync(
      join(repoRoot, 'microservices/ccms-service/CcmsApi/Functions/IntegrationFunctions.cs'),
      'utf8',
    );
    expect(iface).toContain('IsDuplicateAsync');
    expect(guard).toContain('ccms_integration_idempotency');
    expect(guard).toContain('ON CONFLICT');
    expect(fn).toContain('IIntegrationIdempotencyGuard');
    expect(fn).toContain('ICollectionSettlementService');
    expect(fn).toContain('JourneyAdmitted');
    expect(fn).toContain('SurgeryCompleted');
    expect(fn).toContain('PatientDischarged');
    expect(fn).toContain('BillFinalized');
    expect(fn).toContain('X-Idempotency-Key');
    expect(fn).not.toContain('AckLifecycleAsync(req, "PaymentReceived")');
  });

  it('admission fail-closed factory is shared with client UnavailableResult', () => {
    const src = readFileSync(
      join(repoRoot, 'microservices/ip-management-service/IpManagementService/Services/CcmsAdmissionClient.cs'),
      'utf8',
    );
    expect(src).toContain('ForCcmsUnavailable');
    expect(src).toContain('UnavailableResult');
    expect(src).toMatch(/ForCcmsUnavailable\(coverageBased\)/);
  });

  it('ward Coverage & Payment Status step and projection remain', () => {
    const terms = readFileSync(
      join(webRoot, 'src/lib/ip-management/coverage-payment-terminology.ts'),
      'utf8',
    );
    const steps = readFileSync(
      join(webRoot, 'src/lib/ip-management/preop-steps.ts'),
      'utf8',
    );
    expect(terms).toContain("coverageAndPaymentStatus: 'Coverage & Payment Status'");
    expect(steps).toContain('CoveragePaymentTerms.coverageAndPaymentStatus');
  });

  it('legacy insurance write freeze and finance→CCMS redirects remain', () => {
    expect(existsSync(join(webRoot, 'src/lib/api/insurance.api.phase2.test.ts'))).toBe(true);
    expect(existsSync(join(webRoot, 'src/lib/ip-management/legacy-insurance-routes.phase3.test.ts'))).toBe(true);
    expect(existsSync(join(webRoot, 'src/lib/ip-management/phase3-residuals.test.ts'))).toBe(true);
  });

  it('ward beds come from Auth inventory, not TotalBeds synthesis', () => {
    const ward = readFileSync(
      join(repoRoot, 'microservices/ip-management-service/IpManagementService/Services/WardService.cs'),
      'utf8',
    );
    expect(ward).not.toContain('Enumerable.Range');
    expect(ward).toContain('_beds.ListAsync');
  });

  it('clinical discharge hard-blocks unpaid patient obligation', () => {
    const gates = readFileSync(
      join(repoRoot, 'microservices/ip-management-service/IpManagementService/Services/ChecklistGateService.cs'),
      'utf8',
    );
    expect(gates).toContain('patient_obligation_outstanding');
    expect(gates).toContain('DischargeFinancialClearancePolicy');
  });

  it('approval snapshot is served by CCMS, not folded on the client', () => {
    const fe = readFileSync(join(webRoot, 'src/lib/api/ccms/ccms-approvals.api.ts'), 'utf8');
    const be = readFileSync(
      join(repoRoot, 'microservices/ccms-service/CcmsApi/Functions/ApprovalFunctions.cs'),
      'utf8',
    );
    expect(fe).toContain('/ccms/coverage-cases/${caseId}/approval-snapshot');
    expect(fe).not.toContain('backend snapshot endpoint not yet implemented');
    expect(be).toContain('approval-snapshot');
  });

  it('IP cannot set Paid or Settled via financial-transition', () => {
    const src = readFileSync(
      join(repoRoot, 'microservices/ip-management-service/IpManagementService/Services/PatientJourneyService.cs'),
      'utf8',
    );
    const fe = readFileSync(
      join(repoRoot, 'apps/hospital-portal-web/src/lib/api/ip-management.api.ts'),
      'utf8',
    );
    expect(src).toContain('Financial lifecycle is owned by Billing');
    expect(fe).toContain('Financial lifecycle is owned by Billing');
    expect(fe).not.toContain('/ip-management/journeys/${id}/financial-transition');
  });

  it('Phase 1–4 decision docs exist', () => {
    for (const f of [
      'ip-ccms-phase1-admission-gate.md',
      'ip-ccms-phase2-integration-outbox.md',
      'ip-ccms-phase3-legacy-retirement.md',
      'ip-ccms-phase4-advanced-capabilities.md',
      'ip-ccms-wave0-ops-checklist.md',
      'ip-ccms-waves-3-to-7.md',
      'ip-ccms-wave7-staging-smoke.md',
    ]) {
      expect(existsSync(join(webRoot, 'docs', f))).toBe(true);
    }
  });
});

