import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const srcRoot = join(__dirname, '../../..');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  getApi: () => ({
    get: getMock,
    post: postMock,
  }),
}));

import { labReportsApi } from '@/lib/api/lab-reports.api';
import {
  LAB_REPORT_STATUSES,
  labStatusLabel,
} from '@/components/laboratory/laboratory-constants';

describe('L1 Laboratory Management — route & honesty', () => {
  const page = read('app/dashboard/laboratory/page.tsx');
  const workbench = read('components/laboratory/LaboratoryWorkbench.tsx');
  const orderDialog = read('components/laboratory/LaboratoryOrderDialog.tsx');
  const router = read('app/dashboard/DashboardRouter.tsx');
  const api = read('lib/api/lab-reports.api.ts');

  it('1. Laboratory workbench mounts on /dashboard/laboratory', () => {
    expect(page).toContain('LaboratoryWorkbench');
    expect(page).toContain('data-testid="laboratory-l1-workbench-page"');
    expect(workbench).toContain('data-testid="laboratory-workbench"');
    expect(router).toContain("'Lab Technician': '/dashboard/laboratory'");
    expect(router).toContain("'Lab Manager': '/dashboard/laboratory'");
  });

  it('2. No mock patient/test rows or fabricated KPI cards', () => {
    const surface = `${page}\n${workbench}\n${orderDialog}`;
    expect(surface).not.toContain('Simulated data');
    expect(surface).not.toContain('Visual Field Test');
    expect(surface).not.toContain('Dr. Sarah Johnson');
    expect(surface).not.toContain('pendingTests');
    expect(surface).not.toContain('completedToday');
    expect(surface).not.toContain('abnormalResults');
    expect(surface).not.toContain("status: 'pending'");
    expect(workbench).toContain('labReportsApi.list');
  });

  it('3. Loading state uses skeleton pattern without fake rows', () => {
    expect(workbench).toContain('WorklistSkeleton');
    expect(workbench).toContain('data-testid="laboratory-worklist-loading"');
    expect(workbench).toContain('Loading laboratory orders');
    expect(workbench).not.toContain('fake-row');
  });

  it('4. Empty state is honest and offers Order New Test when permitted', () => {
    expect(workbench).toContain('data-testid="laboratory-worklist-empty"');
    expect(workbench).toContain('No laboratory orders found');
    expect(workbench).toContain("label: 'Order New Test'");
  });

  it('5. API error state is honest with no mock fallback', () => {
    expect(workbench).toContain('data-testid="laboratory-worklist-error"');
    expect(workbench).toContain('Unable to load laboratory orders');
    expect(workbench).toContain('getApiErrorMessage');
  });

  it('6. Permission / unauthorized states respect existing model', () => {
    expect(page).toContain('requiredPermission="laboratory.view"');
    expect(workbench).toContain("useHasPermission('patient.view')");
    expect(workbench).toContain("useHasPermission('patient.update')");
    expect(workbench).toContain('data-testid="laboratory-permission-denied"');
    expect(page).not.toMatch(/laboratory\.order|laboratory\.result/);
  });

  it('7. Real LabReport fields are rendered from API response', () => {
    expect(workbench).toContain('patientDisplayName');
    expect(workbench).toContain('medicalRecordNumber');
    expect(workbench).toContain('testName');
    expect(workbench).toContain('testCategory');
    expect(workbench).toContain('priority');
    expect(workbench).toContain('status');
    expect(workbench).toContain('orderedByName');
    expect(workbench).toContain('specimenType');
  });

  it('8. Status filter uses API vocabulary (no pending lifecycle)', () => {
    expect(LAB_REPORT_STATUSES).toEqual([
      'ordered',
      'sample_collected',
      'in_progress',
      'completed',
      'cancelled',
      'on_hold',
    ]);
    expect(LAB_REPORT_STATUSES).not.toContain('pending');
    expect(workbench).toContain('LAB_REPORT_STATUSES');
    expect(workbench).toContain('data-testid="laboratory-status-filter"');
    expect(labStatusLabel('ordered')).toBe('Ordered');
  });

  it('9. Search uses real list API contract', () => {
    expect(workbench).toContain('data-testid="laboratory-search"');
    expect(workbench).toContain('search: debouncedSearch.trim() || undefined');
    expect(api).toContain('async list(');
    expect(api).toContain('search=${encodeURIComponent(params.search)}');
  });

  it('10. Order New Test opens via dialog', () => {
    expect(workbench).toContain('data-testid="laboratory-order-new-test"');
    expect(workbench).toContain('LaboratoryOrderDialog');
    expect(orderDialog).toContain('data-testid="laboratory-order-dialog"');
    expect(orderDialog).toContain('Order New Laboratory Tests');
  });

  it('11. Patient selection reuses PatientSearchAutosuggest', () => {
    expect(orderDialog).toContain('PatientSearchAutosuggest');
    expect(orderDialog).toContain('onSelectPatient');
    expect(orderDialog).toContain('data-testid="laboratory-order-patient-context"');
    expect(orderDialog).not.toContain('searchPatientsUnified(');
  });

  it('12. Create calls labReportsApi.createFromCatalog (L2 catalog path)', () => {
    expect(orderDialog).toContain('labReportsApi.createFromCatalog');
    expect(orderDialog).toContain('data-testid="laboratory-order-submit"');
    expect(orderDialog).not.toMatch(/labReportsApi\.create\(/);
  });

  it('13. Successful create refreshes worklist via reload (no local insert)', () => {
    expect(workbench).toContain('onCreated={onCreated}');
    expect(workbench).toContain('const onCreated = () =>');
    expect(workbench).toContain('void load()');
    expect(workbench).not.toContain('setRows((prev)');
    expect(workbench).not.toContain('setRows([...rows');
  });

  it('14. Failed create displays honest error', () => {
    expect(orderDialog).toContain('data-testid="laboratory-order-error"');
    expect(orderDialog).toContain('getApiErrorMessage');
  });

  it('15. No fake local row after create; no result workflow controls', () => {
    expect(workbench).not.toContain('labReportsApi.complete');
    expect(workbench).not.toContain('attach-report');
    expect(workbench).not.toMatch(/\bProcess\b/);
    expect(workbench).not.toMatch(/\bVerify\b/);
    expect(workbench).not.toMatch(/\bRelease\b/);
    expect(orderDialog).not.toContain('setRows');
  });

  it('16. Admin / Lab Technician / Lab Manager auth model preserved', () => {
    expect(page).toContain('laboratory.view');
    expect(workbench).toContain('patient.view');
    expect(workbench).toContain('patient.update');
    expect(api).not.toContain('/lab/orders');
    expect(page).not.toContain("from '@/lib/api/lab.api");
  });
});

describe('L1 labReportsApi.list / create contract', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    getMock.mockResolvedValue({ data: [] });
    postMock.mockResolvedValue({ data: { id: 'x', status: 'ordered' } });
  });

  it('list uses GET /lab-reports (405 regression — not POST collection)', async () => {
    await labReportsApi.list({ take: 100 });
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('/lab-reports?take=100');
    expect(postMock).not.toHaveBeenCalled();
  });

  it('list treats empty array as successful empty worklist payload', async () => {
    getMock.mockResolvedValue({ data: [] });
    const response = await labReportsApi.list();
    expect(response.data).toEqual([]);
    expect(Array.isArray(response.data)).toBe(true);
  });

  it('list builds server-side query from status/priority/search', async () => {
    await labReportsApi.list({
      status: 'ordered',
      priority: 'stat',
      search: 'CBC',
      take: 50,
    });
    expect(getMock).toHaveBeenCalledWith(
      '/lab-reports?status=ordered&priority=stat&search=CBC&take=50',
    );
  });

  it('create posts to /lab-reports and returns server payload', async () => {
    postMock.mockResolvedValue({
      data: {
        id: 'lab-1',
        patientId: 'p1',
        testName: 'CBC',
        status: 'ordered',
        priority: 'routine',
      },
    });
    const result = await labReportsApi.create({
      patientId: 'p1',
      testName: 'CBC',
      testCategory: 'hematology',
      status: 'ordered',
    });
    expect(postMock).toHaveBeenCalledWith('/lab-reports', {
      patientId: 'p1',
      testName: 'CBC',
      testCategory: 'hematology',
      status: 'ordered',
    });
    expect(result.data.status).toBe('ordered');
    expect(result.data.id).toBe('lab-1');
  });
});
