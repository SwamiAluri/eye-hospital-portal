/**
 * UAT defect: counsellor can open Finalize Surgery list but row click → Access Denied.
 * Root cause: FinalizeOtModal Promise.all loads anesthetists via user.view endpoint.
 * Contract: all modal bootstrap lookups must use counseling_sessions.read paths.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COUNSELLING_SESSIONS_READ_PERMISSION } from './counselling-auth';

const COUNSELLOR_BASELINE = [
  'dashboard.view',
  'master_data.lookup',
  'counseling_sessions.read',
  'counseling_sessions.create',
  'counseling_sessions.update',
  'counsellor.outpatient_checklist.edit',
  'patient.view',
] as const;

describe('Finalize Surgery row-open authorization contract', () => {
  it('list page is gated on counseling_sessions.read', () => {
    const src = readFileSync(
      resolve(__dirname, '../../app/dashboard/counsellors-desk/finalize-surgery/page.tsx'),
      'utf8',
    );
    expect(src).toContain('ProtectedRoute');
    expect(src).toContain('COUNSELLING_SESSIONS_READ_PERMISSION');
    expect(COUNSELLING_SESSIONS_READ_PERMISSION).toBe('counseling_sessions.read');
  });

  it('row open opens FinalizeOtModal (not patient-details route)', () => {
    const page = readFileSync(
      resolve(__dirname, '../../app/dashboard/counsellors-desk/finalize-surgery/page.tsx'),
      'utf8',
    );
    expect(page).toContain('FinalizeOtModal');
    expect(page).toContain('openRow');
    expect(page).toContain('setModalOpen(true)');
    expect(page).not.toMatch(/openRow[\s\S]{0,200}router\.push/);
  });

  it('FinalizeOtModal bootstrap uses counselling least-privilege lookups only', () => {
    const modal = readFileSync(
      resolve(__dirname, '../../components/counsellors-desk/FinalizeOtModal.tsx'),
      'utf8',
    );
    expect(modal).toContain('getOtScheduleDetail');
    expect(modal).toContain('getSurgeons');
    expect(modal).toContain('getOtTheaters');
    expect(modal).toContain('getAnesthetists');
    expect(modal).not.toContain('/users/anesthetists');
    expect(modal).not.toContain('/users/surgeons');
    expect(modal).not.toContain('/users/with-details');
  });

  it('authorized counsellor baseline includes list+detail permission and excludes user.view', () => {
    expect(COUNSELLOR_BASELINE).toContain('counseling_sessions.read');
    expect(COUNSELLOR_BASELINE).not.toContain('user.view');
  });

  it('api client maps anesthetists to Counseling path (not UsersController)', () => {
    const api = readFileSync(resolve(__dirname, '../api/counsellors-desk.api.ts'), 'utf8');
    const start = api.indexOf('async getAnesthetists');
    const end = api.indexOf('async getOtTheaters', start);
    const fn = api.slice(start, end);
    expect(fn).toContain("/Counseling/anesthetists");
    expect(fn).not.toMatch(/get\(['"`]\/users\/anesthetists/);
    expect(fn).toContain('counseling_sessions.read');
  });
});
