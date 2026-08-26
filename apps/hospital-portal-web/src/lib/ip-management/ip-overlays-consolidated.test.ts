import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = join(__dirname, '../..');

function read(rel: string): string {
  return readFileSync(join(src, rel), 'utf8');
}

const OVERLAY_FILES = [
  'components/ip-management/WardPostOpWorkspaceModal.tsx',
  'components/ip-management/WardDischargeWorkspaceModal.tsx',
  'components/ip-management/JourneyModal.tsx',
  'components/ip-management/WardPreOpWorkspaceModal.tsx',
  'components/ip-management/WardPatientDrawer.tsx',
  'components/ip-management/WardUpdationModal.tsx',
  'components/ip-management/PacAssessmentForm.tsx',
  'components/ip-management/department-clearance/DepartmentClearancePanel.tsx',
  'components/ip-management/preop/ConsentCaptureModal.tsx',
  'components/ip-management/preop/ConsentAuthorizationPanel.tsx',
  'components/ip-management/preop/PreOpAuditDrawer.tsx',
  'components/ip-management/investigations/InvestigationDocumentModal.tsx',
  'components/common/ConfirmationDialog.tsx',
  'app/dashboard/ip-management/ward/page.tsx',
  'app/dashboard/ip-management/operation-theatre/page.tsx',
];

describe('UX-090: IP overlays use Dialog/Sheet', () => {
  it.each(OVERLAY_FILES)('%s has no hand-rolled fixed inset-0 overlay', (rel) => {
    const text = read(rel);
    expect(text).not.toContain('fixed inset-0');
    expect(text).not.toContain('backdrop-blur');
  });

  it('named overlays adopt IpOverlayDialog, Dialog, or Sheet', () => {
    expect(read('components/ip-management/WardPostOpWorkspaceModal.tsx')).toContain('IpOverlayDialog');
    expect(read('components/ip-management/WardDischargeWorkspaceModal.tsx')).toContain('IpOverlayDialog');
    expect(read('components/ip-management/JourneyModal.tsx')).toContain('testId="journey-modal"');
    expect(read('components/ip-management/WardPreOpWorkspaceModal.tsx')).toContain('IpOverlayDialog');
    expect(read('components/ip-management/WardPatientDrawer.tsx')).toContain('<Sheet');
    expect(read('app/dashboard/ip-management/operation-theatre/page.tsx')).toContain('IpOverlayDialog');
    expect(read('components/common/ConfirmationDialog.tsx')).toContain('<Dialog');
  });

  it('preserves e2e test ids on converted overlays', () => {
    const ward = read('app/dashboard/ip-management/ward/page.tsx');
    expect(ward).toContain('WARD_PREOP_TEST_IDS.cancelTodayModal');
    expect(ward).toContain('WARD_PREOP_TEST_IDS.sendToOtModal');
    expect(read('components/ip-management/JourneyModal.tsx')).toContain('testId="journey-modal"');
  });
});

describe('UX-090: ward board react-query + toast gate', () => {
  it('dashboard layout mounts one react-hot-toast Toaster', () => {
    const layout = read('app/dashboard/layout.tsx');
    expect(layout).toContain("from 'react-hot-toast'");
    expect(layout).toContain('<Toaster');
    expect(layout).not.toContain("from 'sonner'");
  });

  it('IP / ward / OT / architecture billing screens do not import sonner', () => {
    const files = [
      'app/dashboard/ip-management/ward/page.tsx',
      'app/dashboard/ip-management/operation-theatre/page.tsx',
      'app/dashboard/billing/opd/page.tsx',
      'app/dashboard/admin/charge-mapping/page.tsx',
      'components/ip-management/WardPreOpWorkspaceModal.tsx',
      'components/ip-management/PacAssessmentForm.tsx',
    ];
    for (const rel of files) {
      expect(read(rel)).not.toContain("from 'sonner'");
    }
  });

  it('ward page uses useWardBoardQuery and pauses refresh while overlays are open', () => {
    const page = read('app/dashboard/ip-management/ward/page.tsx');
    expect(page).toContain('useWardBoardQuery');
    expect(page).toContain('pauseRefresh');
    expect(page).toContain('patchWardJourney');
    expect(page).not.toContain('useWardRealtime');
  });

  it('does not keep the dead useWardRealtime hook', () => {
    expect(() => read('hooks/use-ward-realtime.ts')).toThrow();
  });
});
