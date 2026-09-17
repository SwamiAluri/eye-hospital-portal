import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COVERAGE_WIZARD_STEPS_NO_POLICY_PERSIST,
  mayPersistVisitPolicy,
} from './coverage-visit-policy-persist-contract';

describe('mayPersistVisitPolicy — Phase 3G.2 explicit-only contract', () => {
  it('forbids wizard step changes (Policy → Estimate/Documents/Notes/Finish)', () => {
    expect(mayPersistVisitPolicy('wizard-step-change')).toBe(false);
    for (const step of COVERAGE_WIZARD_STEPS_NO_POLICY_PERSIST) {
      expect(step).toBeTruthy();
    }
  });

  it('forbids coverage panel draft save as an implicit policy mutation side effect', () => {
    expect(mayPersistVisitPolicy('coverage-panel-draft-save')).toBe(false);
  });

  it('allows explicit Add/Edit policy modal persistence', () => {
    expect(mayPersistVisitPolicy('explicit-add-edit')).toBe(true);
  });

  it('allows submit-to-claims primary ensure (existing claims prerequisite)', () => {
    expect(mayPersistVisitPolicy('submit-to-claims-ensure-primary')).toBe(true);
  });

  it('allows import-from-draft and set-primary explicit actions', () => {
    expect(mayPersistVisitPolicy('import-from-draft')).toBe(true);
    expect(mayPersistVisitPolicy('set-primary')).toBe(true);
  });
});

describe('CoveragePreauthPanel — no implicit policy save on navigation / draft', () => {
  const panelSource = readFileSync(
    join(__dirname, '../../components/counsellors-desk/coverage/CoveragePreauthPanel.tsx'),
    'utf8',
  );
  const formSource = readFileSync(
    join(__dirname, '../../components/ccms/VisitPolicyForm.tsx'),
    'utf8',
  );
  const listSource = readFileSync(
    join(__dirname, '../../components/ccms/VisitPolicyList.tsx'),
    'utf8',
  );
  const saveSessionSource = readFileSync(
    join(__dirname, '../counsellors-desk/save-counselling-session.ts'),
    'utf8',
  );
  const controllerSource = readFileSync(
    join(__dirname, '../../hooks/use-counselling-session-controller.ts'),
    'utf8',
  );

  it('A–G: does not sync visit policy when leaving the Policy wizard step', () => {
    // Forbidden leave-Policy auto-sync pattern
    expect(panelSource).not.toMatch(
      /prevStep\s*!==\s*['"]policy['"][\s\S]{0,200}trySyncVisitPolicy/,
    );
    expect(panelSource).not.toMatch(
      /activeStep\s*===\s*['"]policy['"][\s\S]{0,80}return;[\s\S]{0,200}trySyncVisitPolicy/,
    );
    expect(panelSource).not.toContain('prevActiveStepRef');
    // Hydration must remain read-only
    expect(panelSource).toContain('applyVisitPolicyHydrationToForm');
  });

  it('does not call trySyncVisitPolicy from persistDraft / Save Draft side effects', () => {
    expect(panelSource).not.toMatch(/persistDraft[\s\S]*?trySyncVisitPolicy/);
    expect(panelSource).not.toContain('trySyncVisitPolicy');
    expect(panelSource).not.toContain("toast.success('Primary visit policy saved')");
  });

  it('H–K: explicit Add/Edit still create/update; Cancel only closes', () => {
    expect(formSource).toContain('createPolicy');
    expect(formSource).toContain('updatePolicy');
    expect(formSource).toContain("toast.success('Policy added')");
    expect(formSource).toContain("toast.success('Policy updated')");
    // Cancel / close path — onClose without create/update in onOpenChange
    expect(formSource).toMatch(/onOpenChange=\{\(next\)\s*=>\s*\{\s*if\s*\(!next\)\s*onClose\(\);\s*\}\}/);
    expect(formSource).toContain('handleSubmit');
  });

  it('L: explicit Save Draft still persists counselling session', () => {
    expect(saveSessionSource).toContain('counsellorsDeskApi.saveSession');
    expect(controllerSource).toContain('saveCoveragePanelDraft');
    expect(controllerSource).toMatch(/force:\s*true/);
  });

  it('M–N: Phase 3G canonical display + single invalidate after explicit list save', () => {
    expect(listSource).toContain('selectVisitPoliciesForDisplay');
    expect(listSource).toContain('invalidateQueries');
    expect(listSource).toContain('ccmsKeys.policies');
    expect(listSource).toContain('void reload().then(() => onChanged?.())');
  });

  it('O: Primary visit policy saved toast is not used for navigation; Add/Edit use their own toasts', () => {
    expect(panelSource).not.toContain("toast.success('Primary visit policy saved')");
    expect(formSource).toContain("toast.success('Policy added')");
    expect(formSource).toContain("toast.success('Policy updated')");
  });

  it('network: createPolicy/updatePolicy in panel only serve ensurePrimary (not tab nav)', () => {
    // syncPrimaryVisitPolicy remains for submit-to-claims ensure only
    expect(panelSource).toContain('syncPrimaryVisitPolicy');
    expect(panelSource).toContain('ensurePrimaryVisitPolicySynced');
    // No leave-tab / draft side-effect caller
    expect(panelSource).not.toContain('trySyncVisitPolicy');
    expect(panelSource).not.toMatch(
      /useEffect\(\(\)\s*=>\s*\{[\s\S]*?activeStep[\s\S]*?(createPolicy|updatePolicy|syncPrimaryVisitPolicy)/,
    );
  });

  it('submit-to-claims may still ensure primary via ensurePrimaryVisitPolicySynced (no leave-tab toast)', () => {
    expect(panelSource).toContain('ensurePrimaryVisitPolicySynced');
    expect(panelSource).toContain('handleSubmitToClaims');
  });
});
