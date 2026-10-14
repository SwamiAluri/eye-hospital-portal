import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcRoot = join(__dirname, '../../..');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

/**
 * L0 honesty was superseded by L1 workbench. Keep a thin regression that L0 mock
 * KPIs/rows never return, and that the orphan lab.api SoT is still rejected.
 */
describe('L0 Laboratory honesty — preserved after L1 workbench', () => {
  const page = read('app/dashboard/laboratory/page.tsx');
  const workbench = read('components/laboratory/LaboratoryWorkbench.tsx');
  const router = read('app/dashboard/DashboardRouter.tsx');

  it('keeps Lab Technician / Lab Manager on the laboratory App Router page', () => {
    expect(router).toContain("'Lab Technician': '/dashboard/laboratory'");
    expect(router).toContain("'Lab Manager': '/dashboard/laboratory'");
    expect(page).toContain('data-testid="laboratory-l1-workbench-page"');
  });

  it('gates the mounted page with existing laboratory.view (no new permission codes)', () => {
    expect(page).toContain('ProtectedRoute');
    expect(page).toContain('requiredPermission="laboratory.view"');
    expect(page).not.toMatch(/laboratory\.order|laboratory\.result/);
  });

  it('does not restore fabricated operational KPIs or mock test rows', () => {
    const surface = `${page}\n${workbench}`;
    expect(surface).not.toContain('Simulated data');
    expect(surface).not.toContain('pendingTests: 5');
    expect(surface).not.toContain('completedToday: 12');
    expect(surface).not.toContain('abnormalResults: 2');
    expect(surface).not.toContain("averageTurnaround: '4.5h'");
    expect(surface).not.toContain('Visual Field Test');
    expect(surface).not.toContain('Dr. Sarah Johnson');
    expect(surface).not.toContain('Pending Tests');
    expect(surface).not.toContain('Completed Today');
    expect(surface).not.toContain('Abnormal Results Detected');
    expect(surface).not.toContain("status: 'pending'");
  });

  it('does not adopt orphan lab.api.ts /lab/* as Laboratory SoT', () => {
    expect(page).not.toContain("from '@/lib/api/lab.api");
    expect(workbench).not.toContain("from '@/lib/api/lab.api");
    expect(page).not.toContain('/lab/orders');
    expect(workbench).not.toContain('/lab/orders');
  });
});

describe('L0 Laboratory API surface — contract preserved (no second API)', () => {
  const api = read('lib/api/lab-reports.api.ts');
  const orphan = read('lib/api/lab.api.ts');

  it('keeps labReportsApi as the Laboratory LabReport client', () => {
    expect(api).toContain("'/lab-reports'");
    expect(api).toContain('/lab-reports/${id}/complete');
    expect(api).toContain('/lab-reports/${id}/attach-report');
    expect(api).toContain('export const labReportsApi');
  });

  it('does not adopt orphan lab.api.ts /lab/* as Laboratory SoT', () => {
    expect(orphan).toContain('/lab/orders');
    const page = read('app/dashboard/laboratory/page.tsx');
    expect(page).not.toContain("from '@/lib/api/lab.api");
    expect(page).not.toContain('/lab/orders');
  });
});

describe('L0 permission finding — nav vs LabReport API (documented, not “fixed”)', () => {
  it('sidebar continues to require laboratory.view for Laboratory nav item', () => {
    const nav = read('lib/navigation/sidebar-menu-sections.tsx');
    expect(nav).toContain("href: '/dashboard/laboratory'");
    expect(nav).toContain("requiredPermission: 'laboratory.view'");
  });

  it('LabReportsController FE client still targets lab-reports only', () => {
    const api = read('lib/api/lab-reports.api.ts');
    expect(api).toContain('/lab-reports/patient/');
    expect(api).toContain('async list(');
    expect(api).not.toContain('/lab/orders');
  });
});
