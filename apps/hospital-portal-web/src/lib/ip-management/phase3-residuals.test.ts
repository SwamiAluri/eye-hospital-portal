import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '../../../../..');
const webRoot = join(__dirname, '../../..');

describe('Phase 3 required residual checks', () => {
  it('InsuranceController CreatePreAuth freezes even when SessionId is empty', () => {
    const src = readFileSync(
      join(repoRoot, 'microservices/auth-service/AuthService/Controllers/InsuranceController.cs'),
      'utf8',
    );
    expect(src).toContain('CreatePreAuth');
    expect(src).not.toContain('!isBypass && request.SessionId != Guid.Empty');
    expect(src).toMatch(/if\s*\(\s*!isBypass\s*\)/);
    expect(src).toContain('LegacyFrozen');
  });

  it('Emergency FC no longer writes InsurancePreauthSubmitted', () => {
    const src = readFileSync(
      join(repoRoot, 'microservices/ip-management-service/IpManagementService/Services/PatientJourneyService.cs'),
      'utf8',
    );
    expect(src).toContain('ApplyEmergencyFcAsync');
    expect(src).not.toMatch(/j\.InsurancePreauthSubmitted\s*=\s*req\.InsurancePreauthSubmitted/);
  });

  it('legacy→CCMS bridge SQL defines live APPLY function and no-duplicate rule', () => {
    const sql = readFileSync(
      join(repoRoot, 'database_migrations/schema/ccms_legacy_insurance_bridge_phase3.sql'),
      'utf8',
    );
    expect(sql).toContain('apply_phase3_legacy_insurance_bridge');
    expect(sql).toContain('legacy_preauth_id');
    expect(sql).toContain('session_preauth_id');
    expect(sql).toContain('Does not create duplicate cases');
    expect(sql).toContain('rollback_phase3_legacy_insurance_bridge');
  });

  it('archive SQL renames insurance tables with compatibility views', () => {
    const sql = readFileSync(
      join(repoRoot, 'database_migrations/schema/auth_insurance_tables_archive_phase3.sql'),
      'utf8',
    );
    expect(sql).toContain('archived_insurance_pre_authorizations');
    expect(sql).toContain('CREATE VIEW insurance_pre_authorizations');
    expect(sql).toContain('app.phase3_archive_insurance');
  });

  it('finance page uses OPD Billing SoT (no mock invoices)', () => {
    const src = readFileSync(join(webRoot, 'src/app/dashboard/finance/page.tsx'), 'utf8');
    expect(src).not.toContain('mockInvoices');
    expect(src).not.toContain('Insurance Claim Filed');
    expect(src).toContain('opdBillingApi.getOpdBills');
    expect(src).toContain('/dashboard/ccms/claims');
  });

  it('deprecated insurance gallery widgets are removed from registry and disk', () => {
    const registry = readFileSync(join(webRoot, 'src/lib/widgets/widget-registry.ts'), 'utf8');
    expect(registry).not.toContain('INSURANCE_PREAUTH_WIDGET');
    expect(registry).not.toContain('INSURANCE_CLAIM_TRACKING_WIDGET');
    expect(registry).not.toContain('GOVERNMENT_SCHEME_AUTHORIZATION_WIDGET');
    expect(registry).not.toContain('InsurancePreAuthWidget');
    expect(
      existsSync(join(webRoot, 'src/components/widgets/InsurancePreAuthWidget.tsx')),
    ).toBe(false);
    expect(
      existsSync(join(webRoot, 'src/components/widgets/InsuranceClaimTrackingWidget.tsx')),
    ).toBe(false);
    expect(
      existsSync(join(webRoot, 'src/components/widgets/GovernmentSchemeAuthorizationWidget.tsx')),
    ).toBe(false);
  });

  it('ambiguous Financial Clearance label removed from department-clearance + SurgeryBooking', () => {
    const dept = readFileSync(
      join(webRoot, 'src/components/ip-management/department-clearance/constants.ts'),
      'utf8',
    );
    const booking = readFileSync(
      join(webRoot, 'src/components/module3/counselor/SurgeryBooking.tsx'),
      'utf8',
    );
    expect(dept).not.toMatch(/Financial:\s+'Financial Clearance'/);
    expect(booking).not.toContain('Financial Clearance Required');
    expect(booking).toContain('Patient Payment Status');
  });

  it('CoveragePaymentTerms is wired into ward financial panel and preop steps', () => {
    const panel = readFileSync(
      join(webRoot, 'src/components/ip-management/preop/FinancialClearancePanel.tsx'),
      'utf8',
    );
    const steps = readFileSync(join(webRoot, 'src/lib/ip-management/preop-steps.ts'), 'utf8');
    expect(panel).toContain('CoveragePaymentTerms');
    expect(steps).toContain('CoveragePaymentTerms.coverageAndPaymentStatus');
  });
});
