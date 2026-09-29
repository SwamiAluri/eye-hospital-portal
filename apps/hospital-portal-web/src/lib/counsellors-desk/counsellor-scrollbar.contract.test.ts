import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { counsellingSessionTokens } from './counselling-session-tokens';

const webRoot = resolve(__dirname, '../..');

function readWeb(relativePath: string): string {
  return readFileSync(resolve(webRoot, relativePath), 'utf8');
}

const theme = readWeb('components/counsellors-desk/session/counselling-session-theme.css');
const globals = readWeb('app/globals.css');
const scrollbarRules = theme.slice(theme.indexOf('Counsellor scrollbar chrome'));

describe('counsellor scrollbar contract', () => {
  it('uses the counsellor button green and hides the thumb until hover', () => {
    expect(scrollbarRules).toContain('scrollbar-color: transparent transparent');
    expect(scrollbarRules).toContain(
      'scrollbar-color: hsl(var(--counselling-primary, 173 58% 32%)) transparent',
    );
    expect(scrollbarRules).toContain('background: transparent');
    expect(scrollbarRules).toContain('background: hsl(var(--counselling-primary, 173 58% 32%))');
    expect(scrollbarRules).not.toContain('--primary-300');
    expect(scrollbarRules).toContain('width: 6px');
    expect(scrollbarRules).toContain('height: 6px');
    expect(scrollbarRules).not.toMatch(/scrollbar-color:\s*#/);
    expect(scrollbarRules).not.toContain('#94aee8');
    expect(scrollbarRules).not.toContain('width: 0');
  });

  it('scopes the override to counselling theme and portaled counsellor roots', () => {
    expect(scrollbarRules).toContain('.counselling-session.counselling-session');
    expect(scrollbarRules).toContain('.counsellor-scrollbar.counsellor-scrollbar');
    expect(scrollbarRules).not.toMatch(/^::-webkit-scrollbar/m);
  });

  it('leaves the application-wide navy scrollbar in place', () => {
    const globalBlock = globals.slice(globals.indexOf('/* Global scrollbar'));
    expect(globalBlock).toContain('#94aee8');
    expect(globalBlock).toContain('#1e3d8a');
    expect(globalBlock).toContain('::-webkit-scrollbar-thumb');
    expect(globalBlock).not.toContain('--primary-300');
    expect(globalBlock).not.toContain('counsellor-scrollbar');
  });

  it('keeps page shells inside the counselling theme so worklist scrollers inherit the rule', () => {
    expect(counsellingSessionTokens.shellPage).toContain('counselling-session');
    for (const page of [
      'app/dashboard/counsellors-desk/waiting-list/page.tsx',
      'app/dashboard/counsellors-desk/sessions/page.tsx',
      'app/dashboard/counsellors-desk/finalize-surgery/page.tsx',
      'app/dashboard/counsellors-desk/surgery-followup/page.tsx',
      'app/dashboard/counselor/analytics/page.tsx',
    ]) {
      const source = readWeb(page);
      expect(source, page).toContain('counsellingSessionTokens.shellPage');
    }
  });

  it('keeps waiting-list, finalize, follow-up, and analytics scroll containers functional', () => {
    expect(readWeb('components/counsellors-desk/waiting-list/WaitingListQueueWidget.tsx')).toContain(
      'overflow-y-auto',
    );
    expect(readWeb('components/counsellors-desk/waiting-list/WaitingListSummaryWidget.tsx')).toContain(
      'overflow-x-auto',
    );
    expect(readWeb('app/dashboard/counsellors-desk/finalize-surgery/page.tsx')).toContain(
      'overflow-y-auto',
    );
    expect(readWeb('app/dashboard/counsellors-desk/finalize-surgery/page.tsx')).toContain(
      'overflow-x-auto',
    );
    expect(readWeb('components/counsellors-desk/FinalizeOtModal.tsx')).toContain('overflow-y-auto');
    expect(readWeb('app/dashboard/counsellors-desk/surgery-followup/page.tsx')).toContain(
      'overflow-y-auto',
    );
    expect(readWeb('components/counselor/CounselorAnalyticsTab.tsx')).toContain('overflow-y-auto');
    expect(readWeb('components/counselor/FollowupAgingTable.tsx')).toContain('overflow-x-auto');
    expect(readWeb('components/counsellors-desk/session/CounsellingSessionLayout.tsx')).toContain(
      'overflow-y-auto',
    );
  });

  it('marks portaled counsellor sheets, dialogs, and selects with the scoped class', () => {
    const portaled = [
      'app/dashboard/counsellors-desk/sessions/page.tsx',
      'components/counsellors-desk/session/CounsellingRecordingDetailsSheet.tsx',
      'components/counsellors-desk/session/CounsellingQuoteBottomSheet.tsx',
      'components/counsellors-desk/session/CounsellingPriceOverrideDialog.tsx',
      'components/counsellors-desk/session/CounsellingEstimatePrintDialog.tsx',
      'components/counsellors-desk/AddPatientModal.tsx',
      'components/counsellors-desk/SessionHistoryModal.tsx',
      'components/counsellors-desk/session/primitives/CounsellingSelect.tsx',
    ];
    for (const file of portaled) {
      expect(readWeb(file), file).toContain('counsellor-scrollbar');
    }
  });

  it('does not attach the counsellor scrollbar class to shared primitives used by other modules', () => {
    expect(readWeb('components/ui/select.tsx')).not.toContain('counsellor-scrollbar');
    expect(readWeb('components/ui/scroll-area.tsx')).toContain('bg-slate-300/80');
    expect(readWeb('components/ui/dialog.tsx')).not.toContain('counsellor-scrollbar');
    expect(readWeb('components/ui/sheet.tsx')).not.toContain('counsellor-scrollbar');
    expect(readWeb('components/billing/OpdBillForm.tsx')).not.toContain('counsellor-scrollbar');
    expect(readWeb('components/Sidebar.tsx')).not.toContain('counsellor-scrollbar');
  });
});
