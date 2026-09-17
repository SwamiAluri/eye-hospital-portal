import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Phase 3G — Visit Policies refresh contract:
 * SoT = React Query ccmsKeys.policies via invalidateQueries only (no local append,
 * no redundant second refetch after invalidate).
 */
describe('VisitPolicyList refresh contract', () => {
  const listSource = readFileSync(join(__dirname, 'VisitPolicyList.tsx'), 'utf8');
  const panelSource = readFileSync(
    join(__dirname, '../counsellors-desk/coverage/CoveragePreauthPanel.tsx'),
    'utf8',
  );

  it('uses selectVisitPoliciesForDisplay for rail rendering', () => {
    expect(listSource).toContain('selectVisitPoliciesForDisplay');
  });

  it('invalidates ccmsKeys.policies after save as the single refresh path', () => {
    expect(listSource).toContain('invalidateQueries');
    expect(listSource).toContain('ccmsKeys.policies');
    expect(listSource).toContain('void reload().then(() => onChanged?.())');
  });

  it('does not optimistically append created policies into the display list', () => {
    expect(listSource).not.toMatch(/\[\s*\.\.\.(?:policies|rawPolicies)\s*,/);
    expect(listSource).not.toMatch(/setSessionPolicies\(\s*\[\s*\.\.\./);
  });

  it('parent onPoliciesChanged hydrates from query cache without a second refetch', () => {
    expect(panelSource).toContain('getQueryData<VisitPolicy[]>(ccmsKeys.policies');
    expect(panelSource).toMatch(/handlePoliciesChanged[\s\S]*?getQueryData/);
    // Must not refetch inside handlePoliciesChanged
    const handler = panelSource.match(
      /const handlePoliciesChanged = useCallback\(\(\) => \{[\s\S]*?\}, \[case_\?\.id, queryClient\]\);/,
    );
    expect(handler?.[0] ?? '').not.toContain('refetch');
  });
});
