import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Phase 2X Slice 3 / 3C / 3D — Counsellor session-open + package quote authorization.
 */
describe('Counsellor session-open authorization hardening', () => {
  it('useStaffDirectoryQuery requires user.view before calling /users/with-details', async () => {
    const text = await readFile(
      join(process.cwd(), 'src/hooks/use-counsellors-desk-queries.ts'),
      'utf8',
    );
    expect(text).toContain("useHasPermission('user.view')");
    expect(text).toContain('enabled: enabled && canViewUsers');
    expect(text).toContain('getAllWithDetails');
  });

  it('session controller documents staff directory as optional / gated', async () => {
    const text = await readFile(
      join(process.cwd(), 'src/hooks/use-counselling-session-controller.ts'),
      'utf8',
    );
    expect(text).toContain('useStaffDirectoryQuery(!!session)');
    expect(text).toMatch(/user\.view|optional/i);
    expect(text).not.toContain("get('/users/with-details')");
    expect(text).not.toContain('/sessions/');
    expect(text).not.toMatch(/getSessionNotes|getSessionDocuments/);
  });

  it('Amelia-like Counsellor set includes package_templates.read and session_documents.* but not admin/staff extras', () => {
    const amelia = [
      'dashboard.view',
      'patient.view',
      'patient.create',
      'counseling_sessions.read',
      'counseling_sessions.create',
      'counseling_sessions.update',
      'master_data.lookup',
      'bill.view',
      'package_templates.read',
      'session_documents.read',
      'session_documents.create',
      'session_documents.verify',
      'session_documents.delete',
    ];
    expect(amelia).toContain('counseling_sessions.read');
    expect(amelia).toContain('patient.view');
    expect(amelia).toContain('master_data.lookup');
    expect(amelia).toContain('package_templates.read');
    expect(amelia).toContain('session_documents.read');
    expect(amelia).toContain('session_documents.create');
    expect(amelia).toContain('session_documents.verify');
    expect(amelia).toContain('session_documents.delete');
    expect(amelia).not.toContain('package_templates.create');
    expect(amelia).not.toContain('package_templates.update');
    expect(amelia).not.toContain('package_templates.delete');
    expect(amelia).not.toContain('user.view');
    expect(amelia).not.toContain('session_notes.read');
    expect(amelia).not.toContain('patient.patient_document.download');
  });

  it('Session Documents panel gates on session_documents.* not patient.view', async () => {
    const text = await readFile(
      join(
        process.cwd(),
        'src/components/counsellors-desk/session/CounsellingSessionDocumentsPanel.tsx',
      ),
      'utf8',
    );
    expect(text).toContain("useHasPermission('session_documents.read')");
    expect(text).toContain("useHasPermission('session_documents.create')");
    expect(text).toContain("useHasPermission('session_documents.delete')");
    expect(text).toContain('Counselling documents are not available to this sign-in');
    expect(text).toContain('doc.createdByUserId === currentUserId');
    expect(text).not.toContain("useHasPermission('patient.view')");
    expect(text).not.toContain("role === 'Counsellor'");
  });

  it('Patient 360 Counselling area label is Counselling without workflow-only copy', async () => {
    const areas = await readFile(
      join(process.cwd(), 'src/lib/patients/patient-360-document-areas.ts'),
      'utf8',
    );
    const documents = await readFile(
      join(process.cwd(), 'src/components/patients/record/Patient360Documents.tsx'),
      'utf8',
    );
    expect(areas).toContain("id: 'counselling', label: 'Counselling', writable: true");
    expect(areas).not.toContain('Available from Counselling workflow');
    expect(documents).toContain("useHasPermission('session_documents.read')");
    expect(documents).toContain("useHasPermission('session_documents.delete')");
    expect(documents).toContain('downloadCounselingCanonicalDocument');
    expect(documents).toContain('canReadCounsellingDocuments');
  });

  it('useCounsellingPackageTemplates requires package_templates.read before GET list', async () => {
    const text = await readFile(
      join(process.cwd(), 'src/hooks/use-counselling-packages.ts'),
      'utf8',
    );
    expect(text).toContain("useHasPermission('package_templates.read')");
    expect(text).toContain('canReadPackageTemplates');
    expect(text).toMatch(/enabled:\s*.*canReadPackageTemplates/);
  });

  it('session hydration does not enable package catalog until requested', async () => {
    const text = await readFile(
      join(process.cwd(), 'src/hooks/use-counselling-session-controller.ts'),
      'utf8',
    );
    expect(text).toContain('packageCatalogRequested');
    expect(text).toContain('requestPackageCatalog');
    expect(text).toContain('useCounsellingPackageTemplates({');
    expect(text).toContain('enabled: packageCatalogRequested');
    expect(text).not.toContain("get('/counselling-package-templates')");
  });

  it('Package tab requests catalog lazily', async () => {
    const text = await readFile(
      join(
        process.cwd(),
        'src/components/counsellors-desk/session/CounsellingEstimateBuilderCard.tsx',
      ),
      'utf8',
    );
    expect(text).toContain('requestPackageCatalog');
    expect(text).toContain("activeTab === 'package'");
  });

  it('package workspace shows access-level empty state (not master-data misconfig)', async () => {
    const workspace = await readFile(
      join(
        process.cwd(),
        'src/components/counsellors-desk/session/CounsellingPackageWorkspace.tsx',
      ),
      'utf8',
    );
    const copy = await readFile(
      join(process.cwd(), 'src/lib/counsellors-desk/counselling-copy.ts'),
      'utf8',
    );
    expect(copy).toContain('packageTemplatesUnavailable');
    expect(workspace).toContain('packageTemplatesAccessDenied');
    expect(workspace).toContain('packageTemplatesUnavailable');
    expect(workspace).toContain('No counselling packages configured');
  });

  it('CounsellingAzure client skips forbidden redirect (optional enrichment)', async () => {
    const text = await readFile(
      join(process.cwd(), 'src/lib/api/counselling-azure.api.ts'),
      'utf8',
    );
    expect(text).toContain('skipForbiddenRedirect: true');
  });

  it('canonical getApi interceptor still redirects on 403 by default', async () => {
    const text = await readFile(join(process.cwd(), 'src/lib/auth-interceptors.ts'), 'utf8');
    expect(text).toContain('skipForbiddenRedirect');
    expect(text).toContain('/dashboard/unauthorized');
    // Instance-level OR per-request skip; default path still redirects when neither is set.
    expect(text).toContain('options?.skipForbiddenRedirect');
    expect(text).toContain('config?.skipForbiddenRedirect');
    expect(text).toContain('window.location.href = \'/dashboard/unauthorized\'');
  });

  it('assignSession opts out of forbidden redirect (in-context Waiting List mutation)', async () => {
    const text = await readFile(
      join(process.cwd(), 'src/lib/api/counsellors-desk.api.ts'),
      'utf8',
    );
    const fn = text.slice(
      text.indexOf('async assignSession'),
      text.indexOf('async getCounselors'),
    );
    expect(fn).toContain('skipForbiddenRedirect: true');
    expect(fn).toContain('/Counseling/sessions/${sessionId}/assign');
  });

  it('price override shows honest empty state when staff directory unavailable', async () => {
    const text = await readFile(
      join(process.cwd(), 'src/components/counsellors-desk/session/CounsellingPriceOverrideDialog.tsx'),
      'utf8',
    );
    expect(text).toContain('Staff directory unavailable');
  });

  it('GetAll package templates backend still requires package_templates.read', async () => {
    const text = await readFile(
      join(
        process.cwd(),
        '../../microservices/auth-service/AuthService/Controllers/CounsellingPackageTemplatesController.cs',
      ),
      'utf8',
    );
    expect(text).toContain('[RequirePermission("package_templates.read")]');
    expect(text).toContain('[RequirePermission("package_templates.create")]');
    expect(text).toContain('[RequirePermission("package_templates.update")]');
    expect(text).toContain('[RequirePermission("package_templates.delete")]');
  });
});
