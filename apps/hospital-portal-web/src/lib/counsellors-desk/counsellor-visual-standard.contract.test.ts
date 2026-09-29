import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { analyticsCategoryColorClass } from '@/components/counselor/CounselorAnalyticsTab';

const finalizePage = readFileSync(
  resolve(__dirname, '../../app/dashboard/counsellors-desk/finalize-surgery/page.tsx'),
  'utf8',
);
const followupPage = readFileSync(
  resolve(__dirname, '../../app/dashboard/counsellors-desk/surgery-followup/page.tsx'),
  'utf8',
);
const analyticsTab = readFileSync(
  resolve(__dirname, '../../components/counselor/CounselorAnalyticsTab.tsx'),
  'utf8',
);
const analyticsPage = readFileSync(
  resolve(__dirname, '../../app/dashboard/counselor/analytics/page.tsx'),
  'utf8',
);
const waitingListPage = readFileSync(
  resolve(__dirname, '../../app/dashboard/counsellors-desk/waiting-list/page.tsx'),
  'utf8',
);
const sessionsPage = readFileSync(
  resolve(__dirname, '../../app/dashboard/counsellors-desk/sessions/page.tsx'),
  'utf8',
);

function pageRootClasses(source: string): string {
  const lines = source.split('\n');
  const index = lines.findIndex((line) => line.includes('staff-page-fit'));
  return `${lines[index] ?? ''}\n${lines[index + 1] ?? ''}`;
}
const topNav = readFileSync(resolve(__dirname, '../../components/TopNav.tsx'), 'utf8');
const funnel = readFileSync(
  resolve(__dirname, '../../components/counselor/ConversionFunnelChart.tsx'),
  'utf8',
);
const titleResolver = readFileSync(
  resolve(__dirname, '../navigation/resolve-staff-page-title.ts'),
  'utf8',
);

describe('Counsellor visual standard wave 2', () => {
  it('keeps Finalize identity on the staff title and the three existing metrics', () => {
    expect(finalizePage).toContain("'Finalize Surgery'");
    expect(finalizePage).toContain("'OT Preparation'");
    expect(finalizePage).toContain('hp-finalize-visible-title');
    expect(finalizePage).not.toContain('staff-page-title');
    expect(finalizePage).not.toContain('finalize-surgery-page-title');
    expect(finalizePage).not.toContain('Prepare Finalised surgeries for OT.');
    expect(finalizePage).toContain('Surgery Finalization');
    expect(finalizePage).toContain('Scheduled');
    expect(finalizePage).toContain('NEEDS_ATTENTION_KPI_LABEL');
    expect(finalizePage).toContain('Surgery Done');
    expect(finalizePage).toContain('Finalised');
    expect(finalizePage).toContain('Selected');
    expect(finalizePage).toContain('border-l-[3px] border-l-counselling-primary');
    expect(finalizePage).toContain('otPrepFiltered.length');
    expect(finalizePage).toContain('otPrepSelectedCount');
    expect(finalizePage).toContain('countNeedsAttention');
  });

  it('limits the workspace title override to the Finalize route', () => {
    expect(topNav).toContain("'/dashboard/counsellors-desk/finalize-surgery'");
    expect(topNav).toContain('pathname !== FINALIZE_SURGERY_PATH');
    expect(topNav).toContain('pathname === FINALIZE_SURGERY_PATH && finalizeWorkspaceTitle');
    expect(topNav).toContain('hp-finalize-visible-title');
    expect(topNav).toContain('resolveStaffPageTitle');
    expect(titleResolver).not.toContain('OT Preparation');
    expect(titleResolver).not.toContain('hp-finalize-visible-title');
  });

  it('keeps Follow-up stats and removes only the grey row edge', () => {
    expect(followupPage).toContain('Active');
    expect(followupPage).toContain('Never Contacted');
    expect(followupPage).toContain('Avg Attempts');
    expect(followupPage).toContain('Cold Leads');
    expect(followupPage).toContain('Post-Surgery');
    expect(followupPage).toContain('border-l-[3px] border-l-counselling-primary');
    expect(followupPage).not.toContain('border-l-counselling-border');
    expect(followupPage).toContain('border-l-4 border-l-red-400');
    expect(followupPage).toContain('Stats unavailable');
  });

  it('maps analytics categories stably without recoloring the funnel', () => {
    const allowed = [
      'bg-counselling-primary/90',
      'bg-counselling-primary/70',
      'bg-counselling-primary/50',
      'bg-counselling-primary/40',
    ];
    expect(analyticsCategoryColorClass('Phaco')).toBe(analyticsCategoryColorClass('Phaco'));
    expect(analyticsCategoryColorClass('  Phaco  ')).toBe(analyticsCategoryColorClass('Phaco'));
    const firstThenSecond = [
      analyticsCategoryColorClass('Cataract'),
      analyticsCategoryColorClass('Phaco'),
    ];
    const secondThenFirst = [
      analyticsCategoryColorClass('Phaco'),
      analyticsCategoryColorClass('Cataract'),
    ];
    expect(firstThenSecond[0]).toBe(secondThenFirst[1]);
    expect(firstThenSecond[1]).toBe(secondThenFirst[0]);
    for (const key of ['Cataract', 'Phaco', 'LASIK']) {
      expect(allowed).toContain(analyticsCategoryColorClass(key));
    }
    expect(analyticsTab).toContain('categoryKey={st.sessionType}');
    expect(analyticsTab).toContain('categoryKey={item.surgeryType}');
    expect(analyticsTab).not.toContain('analyticsCategoryColorClass(t.date)');
    expect(analyticsTab).toContain('bg-counselling-primary/70');
    expect(analyticsTab).not.toContain('#059669');
    expect(analyticsTab).not.toContain('#b91c1c');
    expect(analyticsTab).not.toContain('#d97706');
    expect(analyticsTab).not.toContain('#7c3aed');
    expect(analyticsTab).not.toContain('#6b7280');
    expect(funnel).toContain("color: '#059669'");
    expect(funnel).toContain("color: '#b91c1c'");
    expect(funnel).toContain("color: '#d97706'");
    expect(funnel).toContain("color: '#7c3aed'");
    expect(funnel).toContain("color: '#6b7280'");
    expect(analyticsTab).toContain('text-emerald-700');
    expect(analyticsTab).toContain('text-amber-800');
    expect(analyticsTab).toContain('text-red-800');
  });
});

describe('Counsellor visual polish page-root inset', () => {
  const roots = [
    pageRootClasses(waitingListPage),
    pageRootClasses(sessionsPage),
    pageRootClasses(finalizePage),
    pageRootClasses(followupPage),
    pageRootClasses(analyticsPage),
  ];

  it('removes the page-root top inset and keeps other page-root spacing', () => {
    for (const root of roots) {
      expect(root).toContain('pt-0');
      expect(root).not.toContain('pt-0.5');
      expect(root).not.toContain('min-[1600px]:pt-2');
      expect(root).toContain('px-2.5');
      expect(root).toContain('min-[1600px]:px-4');
      expect(root).toContain('pb-1');
      expect(root).toContain('min-[1600px]:pb-4');
    }
    expect(pageRootClasses(waitingListPage)).toContain('gap-2.5');
    expect(pageRootClasses(sessionsPage)).toContain('gap-0.5');
    expect(pageRootClasses(sessionsPage)).toContain('min-[1600px]:gap-2.5');
    expect(pageRootClasses(finalizePage)).toContain('gap-0.5');
    expect(pageRootClasses(finalizePage)).toContain('min-[1600px]:gap-2.5');
    expect(pageRootClasses(followupPage)).toContain('gap-0.5');
    expect(pageRootClasses(followupPage)).toContain('min-[1600px]:gap-2.5');
    expect(pageRootClasses(analyticsPage)).toContain('gap-0.5');
    expect(pageRootClasses(analyticsPage)).toContain('min-[1600px]:gap-2.5');
  });
});
