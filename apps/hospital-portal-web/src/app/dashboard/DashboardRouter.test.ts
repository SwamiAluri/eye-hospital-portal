import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcRoot = join(__dirname, '../..');

function read(rel: string): string {
  return readFileSync(join(srcRoot, rel), 'utf8');
}

describe('DashboardRouter landings (Step 4A P0)', () => {
  const router = read('app/dashboard/DashboardRouter.tsx');

  it('does not land roles on missing /dashboard/clinical|lab|billing|support paths', () => {
    expect(router).not.toMatch(/['"]\/dashboard\/clinical['"]/);
    expect(router).not.toMatch(/['"]\/dashboard\/lab['"]/);
    expect(router).not.toMatch(/['"]\/dashboard\/billing['"]/);
    expect(router).not.toMatch(/['"]\/dashboard\/support['"]/);
  });

  it('maps clinical, lab, billing, and support roles to existing canonical pages', () => {
    expect(router).toContain("Doctor: '/dashboard/doctors-desk'");
    expect(router).toContain("Consultant: '/dashboard/doctors-desk'");
    expect(router).toContain("'Junior Doctor': '/dashboard/doctors-desk'");
    expect(router).toContain("Nurse: '/dashboard/ip-management/ward'");
    expect(router).toContain("'Nurse Manager': '/dashboard/ip-management/ward'");
    expect(router).toContain("'Lab Technician': '/dashboard/laboratory'");
    expect(router).toContain("'Lab Manager': '/dashboard/laboratory'");
    expect(router).toContain("'Billing Clerk': '/dashboard/billing/opd'");
    expect(router).toContain("'Housekeeping Supervisor': '/dashboard/operations/cssd'");
    expect(router).toContain("'Maintenance Technician': '/dashboard/operations/biomedical'");
  });

  it('canonical landing pages exist as App Router page.tsx files', () => {
    const pages = [
      'app/dashboard/doctors-desk/page.tsx',
      'app/dashboard/ip-management/ward/page.tsx',
      'app/dashboard/laboratory/page.tsx',
      'app/dashboard/billing/opd/page.tsx',
      'app/dashboard/operations/cssd/page.tsx',
      'app/dashboard/operations/biomedical/page.tsx',
      'app/dashboard/frontdesk/page.tsx',
    ];
    for (const rel of pages) {
      expect(statSync(join(srcRoot, rel)).isFile()).toBe(true);
    }
  });
});

describe('canonical notification mechanism (Step 4A P0)', () => {
  it('dashboard and admin layouts mount react-hot-toast Toaster only', () => {
    for (const rel of ['app/dashboard/layout.tsx', 'app/admin/layout.tsx']) {
      const layout = read(rel);
      expect(layout).toContain("from 'react-hot-toast'");
      expect(layout).toContain('<Toaster');
      expect(layout).not.toContain("from 'sonner'");
      expect(layout).not.toContain('from "sonner"');
    }
  });

  it('production TS/TSX sources do not import sonner', () => {
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.next') continue;
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) continue;
        const text = readFileSync(full, 'utf8');
        if (/from ['"]sonner['"]/.test(text)) {
          offenders.push(full.slice(srcRoot.length + 1).replace(/\\/g, '/'));
        }
      }
    };

    walk(srcRoot);
    expect(offenders).toEqual([]);
  });

  it('toast helper wraps react-hot-toast without mounting a second Toaster', () => {
    const helper = read('lib/toast.ts');
    expect(helper).toContain("from 'react-hot-toast'");
    expect(helper).not.toContain('<Toaster');
    expect(helper).toContain('info:');
    expect(helper).toContain('warning:');
  });
});
