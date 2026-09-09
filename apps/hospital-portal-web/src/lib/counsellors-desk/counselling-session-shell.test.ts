import { describe, expect, it } from 'vitest';
import { counsellingSessionTokens } from '@/lib/counsellors-desk/counselling-session-tokens';

describe('Counselling session shell tokens (Wave 2E-5RR-W widgets)', () => {
  it('defines plain page background with floating session widgets', () => {
    expect(counsellingSessionTokens.shellPage).toContain('overflow-hidden');
    expect(counsellingSessionTokens.shellPage).toContain('bg-gray-100');
    expect(counsellingSessionTokens.sessionWidget).toContain('rounded-xl');
    expect(counsellingSessionTokens.sessionWidget).toContain('shadow-sm');
    expect(counsellingSessionTokens.shellChromeStack).toContain('gap-3');
    expect(counsellingSessionTokens.shellWorkflow).toContain('bg-transparent');
    expect(counsellingSessionTokens.shellPageGrid).toContain('gap-3');
    expect(counsellingSessionTokens.shellActionBar).toContain('rounded-xl');
    expect(counsellingSessionTokens.shellActionBar).toContain('mx-4');
    expect(counsellingSessionTokens.actionBarLabel).toContain('font-semibold');
    expect(counsellingSessionTokens.actionBarLabel).toContain('text-sm');
    expect(counsellingSessionTokens.sessionStatusStrip).toContain('rounded-xl');
  });

  it('defines typography hierarchy tokens', () => {
    expect(counsellingSessionTokens.patientLabel).toContain('text-[12px]');
    expect(counsellingSessionTokens.patientLabel).toContain('leading-4');
    expect(counsellingSessionTokens.patientLabel).toContain('uppercase');
    expect(counsellingSessionTokens.patientName).toContain('font-semibold');
    expect(counsellingSessionTokens.patientName).toContain('text-[20px]');
    expect(counsellingSessionTokens.patientName).toContain('leading-6');
    expect(counsellingSessionTokens.shellMeta).toContain('text-sm');
    expect(counsellingSessionTokens.shellMeta).toContain('font-medium');
    expect(counsellingSessionTokens.shellMeta).toContain('leading-5');
    expect(counsellingSessionTokens.shellSecondaryMeta).toContain('text-[13px]');
    expect(counsellingSessionTokens.patientDetailsAction).toContain('text-sm');
    expect(counsellingSessionTokens.patientDetailsAction).toContain('font-semibold');
    expect(counsellingSessionTokens.patientStatusPill).toContain('text-[13px]');
    expect(counsellingSessionTokens.patientHeaderPhoto).toContain('h-14');
    expect(counsellingSessionTokens.patientHeaderPhoto).toContain('w-14');
    expect(counsellingSessionTokens.patientHeaderPhoto).toContain('ring-2');
    expect(counsellingSessionTokens.sessionStatusDetailValueSuccess).toContain('text-sm');
    expect(counsellingSessionTokens.sessionStatusDetailValueSuccess).toContain('font-semibold');
    expect(counsellingSessionTokens.sessionStatusDetails).not.toContain('mt-2');
  });

  it('defines distinct navigation family tokens (Wave 2E-2 / 2E-4R)', () => {
    expect(counsellingSessionTokens.moduleNavItem).toContain('border-b-2');
    expect(counsellingSessionTokens.workflowStepTrack).toContain('grid-cols-5');
    expect(counsellingSessionTokens.workflowStepButtonCurrent).toContain('ring-counselling-primary');
    expect(counsellingSessionTokens.sessionStatusDetails).toContain('grid');
    expect(counsellingSessionTokens.workspaceStepItemActive).toContain('border-counselling-primary');
    expect(counsellingSessionTokens.modeSegmented).toContain('rounded-lg');
    expect(counsellingSessionTokens.filterSegmented).not.toContain('border-counselling-border/70');
    expect(counsellingSessionTokens.pillTab).toContain('rounded-full');
    expect(counsellingSessionTokens.pillTabCurrent).toContain('bg-counselling-primary');
    expect(counsellingSessionTokens.statusPill).toContain('rounded-full');
    expect(counsellingSessionTokens.choiceRowSelected).toContain('border-l-counselling-primary');
    expect(counsellingSessionTokens.notesOptionRowSelected).toContain('bg-emerald-50');
    expect(counsellingSessionTokens.notesOptionRowSelected).not.toContain('border-l-');
    expect(counsellingSessionTokens.journeyTabTrack).toContain('gap-6');
    expect(counsellingSessionTokens.journeyTab).toContain('text-sm');
    expect(counsellingSessionTokens.journeyTab).toContain('font-bold');
    expect(counsellingSessionTokens.journeyTabComplete).toContain('border-transparent');
    expect(counsellingSessionTokens.journeyTabComplete).toContain('bg-counselling-primary/10');
    expect(counsellingSessionTokens.journeyTabCurrent).toContain('bg-counselling-primary');
    expect(counsellingSessionTokens.quoteSummaryInner).toContain('px-5');
    expect(counsellingSessionTokens.quoteSummaryPanel).toContain('counselling-estimate-scroll');
    expect(counsellingSessionTokens.quoteSummaryPanel).not.toContain('pr-5');
  });

});
