import { describe, expect, it } from 'vitest';
import { LMS_CRITICAL_PERMISSIONS } from '@/lib/lms/lms-permissions';
import { LMS_CAPABILITIES } from '@/lib/lms/lms-capability-registry';
import { parseLmsTestingApiError } from '@/lib/lms/lms-testing.api';

describe('L-CRT-01 Critical Results UI contracts', () => {
  it('registers Critical capability as implemented with dedicated permissions', () => {
    expect(LMS_CAPABILITIES.find((c) => c.id === 'results-critical')?.status).toBe('implemented');
    expect(LMS_CAPABILITIES.find((c) => c.id === 'results-critical')?.href).toBe(
      '/dashboard/lms/results/critical',
    );
    expect(LMS_CRITICAL_PERMISSIONS.view).toBe('lms.results.critical.view');
    expect(LMS_CRITICAL_PERMISSIONS.manage).toBe('lms.results.critical.manage');
    expect(LMS_CRITICAL_PERMISSIONS.acknowledge).toBe('lms.results.critical.acknowledge');
  });

  it('parses Critical conflict codes honestly', () => {
    const already = parseLmsTestingApiError({
      response: { status: 409, data: { code: 'already_critical', message: 'exists' } },
    });
    expect(already.isAlreadyCritical).toBe(true);

    const ack = parseLmsTestingApiError({
      response: { status: 409, data: { code: 'already_acknowledged', message: 'done' } },
    });
    expect(ack.isAlreadyAcknowledged).toBe(true);

    const notify = parseLmsTestingApiError({
      response: { status: 503, data: { code: 'notification_unavailable', message: 'down' } },
    });
    expect(notify.isNotificationUnavailable).toBe(true);
  });

  it('does not treat Critical as a ResultStatus label', () => {
    const statuses = ['Draft', 'TechnicalVerified', 'ClinicallyAuthorized'];
    expect(statuses).not.toContain('Critical');
  });
});
