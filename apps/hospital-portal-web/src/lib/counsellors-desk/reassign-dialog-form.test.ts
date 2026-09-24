import { describe, expect, it } from 'vitest';
import type { CounselingCounselorOption } from '@/lib/api/counsellors-desk.api';
import {
  REASSIGN_OTHER_REASON,
  REASSIGN_REASON_OPTIONS,
  canSubmitReassignForm,
  excludeCurrentOwnerFromTargets,
  resolveReassignReasonPayload,
} from '@/lib/counsellors-desk/reassign-dialog-form';

const amelia: CounselingCounselorOption = {
  id: 'user-amelia',
  name: 'Amelia Martinez',
  firstName: 'Amelia',
  lastName: 'Martinez',
  email: 'amelia@example.com',
};
const olivia: CounselingCounselorOption = {
  id: 'user-olivia',
  name: 'Olivia Robinson',
  firstName: 'Olivia',
  lastName: 'Robinson',
  email: 'olivia@example.com',
};

describe('Phase 3I Slice 6 — Reassign dialog form helpers', () => {
  describe('eligible new owner', () => {
    it('loads peers and excludes current owner', () => {
      const eligible = excludeCurrentOwnerFromTargets(
        [amelia, olivia],
        'user-amelia',
      );
      expect(eligible).toHaveLength(1);
      expect(eligible[0]?.id).toBe('user-olivia');
      expect(eligible.some((c) => c.id === 'user-amelia')).toBe(false);
    });

    it('returns all when current owner id is null', () => {
      expect(excludeCurrentOwnerFromTargets([amelia, olivia], null)).toHaveLength(
        2,
      );
    });

    it('selecting Olivia updates selectedCounselorId for valid submission', () => {
      expect(
        canSubmitReassignForm({
          selectedCounselorId: 'user-olivia',
          reasonChoice: 'Workload balancing',
          additionalReason: '',
          submitting: false,
        }),
      ).toBe(true);
    });

    it('changing selection updates submit eligibility correctly', () => {
      expect(
        canSubmitReassignForm({
          selectedCounselorId: '',
          reasonChoice: 'Workload balancing',
          additionalReason: '',
          submitting: false,
        }),
      ).toBe(false);
      expect(
        canSubmitReassignForm({
          selectedCounselorId: 'user-olivia',
          reasonChoice: 'Workload balancing',
          additionalReason: '',
          submitting: false,
        }),
      ).toBe(true);
    });
  });

  describe('reason options', () => {
    it('exposes all nine approved reason labels', () => {
      expect(REASSIGN_REASON_OPTIONS).toEqual([
        'Workload balancing',
        'Counsellor unavailable',
        'Schedule or availability change',
        'Branch or coverage change',
        'Continuity of care',
        'Patient request',
        'Operational handoff',
        'Incorrect initial assignment',
        'Other',
      ]);
      expect(REASSIGN_OTHER_REASON).toBe('Other');
    });

    it('no reason → Reassign disabled', () => {
      expect(
        canSubmitReassignForm({
          selectedCounselorId: 'user-olivia',
          reasonChoice: '',
          additionalReason: '',
          submitting: false,
        }),
      ).toBe(false);
    });

    it('predefined reason does not require additional reason text', () => {
      expect(
        resolveReassignReasonPayload({
          reasonChoice: 'Workload balancing',
          additionalReason: 'ignored',
        }),
      ).toEqual({ ok: true, reason: 'Workload balancing' });
    });

    it('predefined reason + owner → enabled', () => {
      expect(
        canSubmitReassignForm({
          selectedCounselorId: 'user-olivia',
          reasonChoice: 'Patient request',
          additionalReason: '',
          submitting: false,
        }),
      ).toBe(true);
    });

    it('Other + empty additional → disabled', () => {
      expect(
        canSubmitReassignForm({
          selectedCounselorId: 'user-olivia',
          reasonChoice: REASSIGN_OTHER_REASON,
          additionalReason: '   ',
          submitting: false,
        }),
      ).toBe(false);
    });

    it('Other + text → enabled', () => {
      expect(
        canSubmitReassignForm({
          selectedCounselorId: 'user-olivia',
          reasonChoice: REASSIGN_OTHER_REASON,
          additionalReason: 'Coverage adjustment for counselling workload',
          submitting: false,
        }),
      ).toBe(true);
    });

    it('trims additional reason before payload', () => {
      expect(
        resolveReassignReasonPayload({
          reasonChoice: REASSIGN_OTHER_REASON,
          additionalReason: '  Coverage adjustment  ',
        }),
      ).toEqual({ ok: true, reason: 'Coverage adjustment' });
    });

    it('does not send Other alone as reason', () => {
      expect(
        resolveReassignReasonPayload({
          reasonChoice: REASSIGN_OTHER_REASON,
          additionalReason: '',
        }),
      ).toEqual({ ok: false });
    });
  });

  describe('submission payload contract', () => {
    it('predefined reason is sent as its selected label', () => {
      const resolved = resolveReassignReasonPayload({
        reasonChoice: 'Continuity of care',
        additionalReason: '',
      });
      expect(resolved).toEqual({ ok: true, reason: 'Continuity of care' });
      expect(JSON.stringify(resolved)).not.toContain('reasonCode');
      expect(JSON.stringify(resolved)).not.toContain('reasonId');
    });

    it('Other sends the entered additional reason string only', () => {
      expect(
        resolveReassignReasonPayload({
          reasonChoice: REASSIGN_OTHER_REASON,
          additionalReason: 'Coverage adjustment for counselling workload',
        }),
      ).toEqual({
        ok: true,
        reason: 'Coverage adjustment for counselling workload',
      });
    });

    it('submitting disables even when form is otherwise valid', () => {
      expect(
        canSubmitReassignForm({
          selectedCounselorId: 'user-olivia',
          reasonChoice: 'Workload balancing',
          additionalReason: '',
          submitting: true,
        }),
      ).toBe(false);
    });
  });
});
