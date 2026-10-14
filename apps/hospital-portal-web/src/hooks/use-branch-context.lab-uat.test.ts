import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('useBranchContext Lab UAT access-denied loop', () => {
  const src = readFileSync(join(__dirname, 'use-branch-context.ts'), 'utf8');

  it('does not call privileged GET /branches/{id} that triggers unauthorized redirect', () => {
    expect(src).toContain("userBranchesApi.getMyBranches");
    expect(src).not.toMatch(/getApi\(\)\.get\(`\/branches\/\$\{/);
    expect(src).not.toMatch(/get\(['`]\/branches\//);
  });
});
