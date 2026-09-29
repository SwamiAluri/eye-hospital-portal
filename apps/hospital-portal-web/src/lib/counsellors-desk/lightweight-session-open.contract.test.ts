import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const controller = readFileSync(
  resolve(__dirname, '../../hooks/use-counselling-session-controller.ts'),
  'utf8',
);
const page = readFileSync(
  resolve(__dirname, '../../components/counsellors-desk/session/CounsellingSessionPageContent.tsx'),
  'utf8',
);

describe('lightweight counselling session open', () => {
  it('loads the procedure catalog independently of the session payload', () => {
    expect(controller).toContain('useCounsellorProcedureVariants(true)');
    expect(controller).not.toContain('useCounsellorProcedureVariants(!!session)');
    expect(controller).toContain('const isLoading = !session && !sessionQuery.isError');
  });

  it('keeps Start Counseling as session GET, start, then session verification', () => {
    const start = controller.indexOf('const startedOp = await counsellorsDeskApi.startSession');
    const verify = controller.indexOf('const started = await counsellorsDeskApi.getSession', start);
    expect(start).toBeGreaterThan(-1);
    expect(verify).toBeGreaterThan(start);
  });

  it('does not fetch recordings or AI summary on the session page module', () => {
    expect(page).toContain("contextualDestination === 'conversations'");
    expect(page).not.toContain('counsellingRecordingApi');
    expect(page).not.toMatch(/AI Summary|aiSummary|AiSummary/);
  });
});
