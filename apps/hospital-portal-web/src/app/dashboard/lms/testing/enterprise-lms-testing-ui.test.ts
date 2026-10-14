import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { parseLmsTestingApiError } from '@/lib/lms/lms-testing.api';
import { LMS_RESULTS_PERMISSIONS, LMS_TESTING_PERMISSIONS } from '@/lib/lms/lms-permissions';
import { LMS_CAPABILITIES } from '@/lib/lms/lms-capability-registry';
import { testingWorkQueuePrimaryAction } from '@/lib/lms/testing-work-queue-actions';

const srcRoot = join(__dirname, '../../../..');
const read = (rel: string) => readFileSync(join(srcRoot, rel), 'utf8');

describe('L-TST-01A / L-VER-01 / L-AUTH-01 Testing UI foundations', () => {
  it('defines testing and authorize permission catalog codes', () => {
    expect(LMS_TESTING_PERMISSIONS.view).toBe('lms.testing.view');
    expect(LMS_TESTING_PERMISSIONS.manage).toBe('lms.testing.manage');
    expect(LMS_TESTING_PERMISSIONS.result).toBe('lms.testing.result');
    expect(LMS_TESTING_PERMISSIONS.verify).toBe('lms.testing.verify');
    expect(LMS_RESULTS_PERMISSIONS.authorize).toBe('lms.results.authorize');
    expect(LMS_RESULTS_PERMISSIONS.authorize).not.toBe(LMS_TESTING_PERMISSIONS.verify);
  });

  it('marks testing, verification, and authorization as implemented', () => {
    expect(LMS_CAPABILITIES.find((c) => c.id === 'testing')?.status).toBe('implemented');
    expect(LMS_CAPABILITIES.find((c) => c.id === 'testing-workbench')?.status).toBe('implemented');
    expect(LMS_CAPABILITIES.find((c) => c.id === 'testing-manual-results')?.status).toBe(
      'implemented',
    );
    expect(LMS_CAPABILITIES.find((c) => c.id === 'testing-runs')?.status).toBe('not_implemented');
    expect(LMS_CAPABILITIES.find((c) => c.id === 'results-verification')?.status).toBe(
      'implemented',
    );
    expect(LMS_CAPABILITIES.find((c) => c.id === 'results-authorization')?.status).toBe(
      'implemented',
    );
    expect(LMS_CAPABILITIES.find((c) => c.id === 'results-critical')?.status).toBe(
      'implemented',
    );
    expect(LMS_CAPABILITIES.find((c) => c.id === 'results-amendments')?.status).toBe(
      'not_implemented',
    );
  });

  it('parses concurrency, already-verified, already-authorized, and datatype errors honestly', () => {
    const concurrency = parseLmsTestingApiError({
      response: { status: 409, data: { code: 'concurrency_conflict', message: 'stale' } },
    });
    expect(concurrency.isConcurrencyConflict).toBe(true);
    expect(concurrency.message).toContain('stale');

    const already = parseLmsTestingApiError({
      response: { status: 409, data: { code: 'already_verified', message: 'done' } },
    });
    expect(already.isAlreadyVerified).toBe(true);

    const alreadyAuth = parseLmsTestingApiError({
      response: { status: 409, data: { code: 'already_authorized', message: 'authorized' } },
    });
    expect(alreadyAuth.isAlreadyAuthorized).toBe(true);

    const datatype = parseLmsTestingApiError({
      response: {
        status: 409,
        data: { code: 'unsupported_datatype', message: 'no datatype' },
      },
    });
    expect(datatype.isUnsupportedDatatype).toBe(true);

    const rejected = parseLmsTestingApiError({
      response: { status: 409, data: { code: 'specimen_rejected', message: 'rejected' } },
    });
    expect(rejected.isIneligible).toBe(true);
  });

  it('does not invent Final/Released vocabulary in error helper', () => {
    const err = parseLmsTestingApiError({ response: { status: 500, data: { message: 'boom' } } });
    expect(JSON.stringify(err)).not.toMatch(/Final|Released/i);
  });

  it('maps authorization capability without Final/Release/Critical claims', () => {
    const auth = LMS_CAPABILITIES.find((c) => c.id === 'results-authorization');
    expect(auth?.description).toMatch(/Clinical authorization/i);
    expect(auth?.description).toMatch(/Not Final/i);
    expect(auth?.description).not.toMatch(/Critical/i);
  });

  it('work queue primary action: Edit draft only for Draft; Open result for TV/CA', () => {
    expect(testingWorkQueuePrimaryAction({ resultId: null })).toEqual({
      kind: 'enter-draft',
      label: 'Enter draft',
    });
    expect(
      testingWorkQueuePrimaryAction({ resultId: 'r1', resultStatus: 'Draft' }),
    ).toEqual({ kind: 'edit-draft', label: 'Edit draft' });
    expect(
      testingWorkQueuePrimaryAction({
        resultId: 'r1',
        resultStatus: 'TechnicalVerified',
      }),
    ).toEqual({ kind: 'open-result', label: 'Open result' });
    expect(
      testingWorkQueuePrimaryAction({
        resultId: 'r1',
        resultStatus: 'ClinicallyAuthorized',
      }),
    ).toEqual({ kind: 'open-result', label: 'Open result' });

    const wb = read('components/lms/testing/TestingWorkbench.tsx');
    expect(wb).toContain('testingWorkQueuePrimaryAction');
    const authPage = read('app/dashboard/lms/results/authorization/page.tsx');
    expect(authPage).toContain('resultStatus="TechnicalVerified"');
    const testingPage = read('app/dashboard/lms/testing/page.tsx');
    expect(testingPage).toContain('<TestingWorkbench />');
    expect(testingPage).not.toContain('resultStatus=');
  });

  it('Clinical Authorization composes POST /api/lms/testing/results/{id}/authorize without double /api', () => {
    const detail = read('components/lms/testing/ResultDraftEntry.tsx');
    const api = read('lib/lms/lms-testing.api.ts');
    const labClient = read('lib/api/laboratory-service.api.ts');
    const backend = readFileSync(
      join(
        srcRoot,
        '../../../microservices/laboratory-service/LaboratoryApi/Functions/TestingFunctions.cs',
      ),
      'utf8',
    );
    const envLocal = readFileSync(join(srcRoot, '../.env.local'), 'utf8');

    expect(detail).toContain('authorizeLmsResult');
    expect(detail).toContain('Clinical Authorization');
    expect(detail).toContain('result-authorize-action');
    expect(api).toContain('export async function authorizeLmsResult');
    expect(api).toContain('getLaboratoryApi()');
    expect(api).toMatch(/api\.post<LmsResultDraftDto>\(\s*`\/lms\/testing\/results\/\$\{resultId\}\/authorize`/);
    expect(api).not.toMatch(/`\/api\/lms\/testing\/results\/\$\{resultId\}\/authorize`/);
    expect(labClient).toContain(
      "process.env.NEXT_PUBLIC_LABORATORY_API_URL ?? 'http://localhost:7076/api'",
    );
    expect(envLocal).toMatch(/NEXT_PUBLIC_LABORATORY_API_URL\s*=\s*http:\/\/localhost:7076\/api\b/);
    expect(backend).toContain('[Function("LmsResultAuthorize")]');
    expect(backend).toContain(
      'Route = "lms/testing/results/{id:guid}/authorize"',
    );
    expect(backend).toMatch(
      /\[HttpTrigger\(AuthorizationLevel\.Anonymous,\s*"post",\s*Route = "lms\/testing\/results\/\{id:guid\}\/authorize"\)\]/,
    );

    const base = 'http://localhost:7076/api';
    const path = '/lms/testing/results/{id}/authorize';
    expect(`${base}${path}`).toBe(
      'http://localhost:7076/api/lms/testing/results/{id}/authorize',
    );
    expect(`${base}${path}`).not.toContain('/api/api/');
  });
});
