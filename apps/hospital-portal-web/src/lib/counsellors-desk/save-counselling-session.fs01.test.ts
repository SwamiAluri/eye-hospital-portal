import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_COUNSELLING_ESTIMATE } from '@/types/counselling-estimate';
import type { CounsellingSession, ScheduleData } from '@/types/counsellors-desk';
import {
  buildOtHandoffFailureMessage,
  isOtScheduleRequiredForSave,
  saveCounsellingSession,
  type SaveCounsellingSessionParams,
} from './save-counselling-session';

vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api/counselling-azure.api', () => ({
  mapDecision: (d: string) => d,
  counsellingAzureApi: {
    decision: vi.fn(),
    schedule: vi.fn(),
    addOnSurgery: vi.fn(),
    save: vi.fn(),
  },
}));

const upsertOtSchedule = vi.fn();
const editOtScheduleSlot = vi.fn();
const saveSession = vi.fn();
const saveInvestigations = vi.fn();
const completeSession = vi.fn();
const markAddOnSurgery = vi.fn();

vi.mock('@/lib/api/counsellors-desk.api', () => ({
  counsellorsDeskApi: {
    saveSession: (...args: unknown[]) => saveSession(...args),
    saveInvestigations: (...args: unknown[]) => saveInvestigations(...args),
    upsertOtSchedule: (...args: unknown[]) => upsertOtSchedule(...args),
    editOtScheduleSlot: (...args: unknown[]) => editOtScheduleSlot(...args),
    completeSession: (...args: unknown[]) => completeSession(...args),
    markAddOnSurgery: (...args: unknown[]) => markAddOnSurgery(...args),
  },
}));

import { toast } from 'react-hot-toast';

function axiosErr(status: number, message: string) {
  return {
    isAxiosError: true,
    message: `Request failed with status code ${status}`,
    response: { status, data: { message } },
  };
}

function baseSession(): CounsellingSession {
  return {
    id: 'sess-1',
    patientId: 'pat-1',
    patientName: 'Test Patient',
    age: 60,
    gender: 'M',
    uhid: 'UHID-1',
    visitDate: '2026-09-10',
    surgeries: [{ id: 'surg-1', surgeryName: 'Phaco', isRecommended: true }],
    selectedSurgeryId: 'surg-1',
    patientType: 'Cash',
    paymentMode: 'Cash',
    company: '',
    freeSurgeryReason: '',
    packageName: 'Standard',
    packageRate: 1000,
    decision: 'DateForSurgery',
    schedule: null,
    counsellorNotes: '',
    patientRemarks: '',
    doctorNotes: '',
    wantToSeeDoctor: false,
    interestedToUpgrade: false,
    notRequiredPreAuth: false,
  } as CounsellingSession;
}

function schedule(overrides: Partial<ScheduleData> = {}): ScheduleData {
  return {
    selectedDate: '2026-09-20',
    surgeryStartTime: '09:00',
    doctor: 'Dr. A',
    operationTheatre: 'OT-1',
    ...overrides,
  } as ScheduleData;
}

function buildParams(
  overrides: Partial<SaveCounsellingSessionParams> = {},
): SaveCounsellingSessionParams {
  const onSuccess = vi.fn();
  const invalidateWaitingList = vi.fn();
  const invalidateSession = vi.fn();
  return {
    sessionId: 'sess-1',
    session: baseSession(),
    selectedSurgeryId: 'surg-1',
    selectedVariantId: null,
    selectedEye: 'RE',
    selectedIolId: null,
    variantSubOption: null,
    packageName: 'Standard',
    packageRate: 1000,
    paymentType: 'Cash',
    insuranceCompany: '',
    freeSurgeryReason: '',
    decision: 'DateForSurgery',
    followUpReason: '',
    followUpDate: '',
    counsellorNotes: '',
    patientRemarks: '',
    doctorNotes: '',
    wantToSeeDoctor: false,
    interestedToUpgrade: false,
    notRequiredPreAuth: false,
    schedule: schedule(),
    selectedInvestigations: new Map(),
    mergedEstimate: { ...EMPTY_COUNSELLING_ESTIMATE },
    savedSnapshot: {},
    isDoneState: false,
    existingOtScheduleId: null,
    onSuccess,
    invalidateWaitingList,
    invalidateSession,
    ...overrides,
  };
}

describe('FS-01 counselling → OT handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveSession.mockResolvedValue(undefined);
    saveInvestigations.mockResolvedValue(undefined);
    upsertOtSchedule.mockResolvedValue({ id: 'ot-1' });
    editOtScheduleSlot.mockResolvedValue({ id: 'ot-1' });
    completeSession.mockResolvedValue(undefined);
    markAddOnSurgery.mockResolvedValue(undefined);
  });

  describe('isOtScheduleRequiredForSave', () => {
    it('requires OT for DateForSurgery with schedule date', () => {
      expect(
        isOtScheduleRequiredForSave({
          isPackageUpgrade: false,
          selectedDate: '2026-09-20',
          decision: 'DateForSurgery',
        }),
      ).toBe(true);
    });

    it('requires OT for Interested with schedule date', () => {
      expect(
        isOtScheduleRequiredForSave({
          isPackageUpgrade: false,
          selectedDate: '2026-09-20',
          decision: 'Interested',
        }),
      ).toBe(true);
    });

    it('does not require OT without schedule date', () => {
      expect(
        isOtScheduleRequiredForSave({
          isPackageUpgrade: false,
          selectedDate: null,
          decision: 'DateForSurgery',
        }),
      ).toBe(false);
    });

    it('does not require OT for NeedsTime', () => {
      expect(
        isOtScheduleRequiredForSave({
          isPackageUpgrade: false,
          selectedDate: '2026-09-20',
          decision: 'NeedsTime',
        }),
      ).toBe(false);
    });

    it('does not require OT for package upgrade path', () => {
      expect(
        isOtScheduleRequiredForSave({
          isPackageUpgrade: true,
          selectedDate: '2026-09-20',
          decision: 'DateForSurgery',
        }),
      ).toBe(false);
    });
  });

  describe('buildOtHandoffFailureMessage', () => {
    it('includes actionable base message', () => {
      const msg = buildOtHandoffFailureMessage(new Error('boom'));
      expect(msg).toContain('Counselling details were saved');
      expect(msg).toContain('OT schedule could not be saved');
      expect(msg).toContain('Finalize Surgery');
    });
  });

  it('Test 1 — OT success: overall save succeeds', async () => {
    const params = buildParams();
    await saveCounsellingSession(params);

    expect(saveSession).toHaveBeenCalledOnce();
    expect(upsertOtSchedule).toHaveBeenCalledOnce();
    expect(completeSession).toHaveBeenCalledWith('sess-1');
    expect(params.onSuccess).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith('Session completed successfully');
  });

  it('CS-01 — completeSession failure: no false success / Finish', async () => {
    completeSession.mockRejectedValue(axiosErr(500, 'Error completing session'));
    const params = buildParams({
      decision: 'NeedsTime',
      followUpReason: 'Needs time',
      followUpDate: '2026-09-25',
      schedule: null,
    });

    await expect(saveCounsellingSession(params)).rejects.toThrow(
      /session completion \/ waiting-list status/,
    );
    expect(saveSession).toHaveBeenCalledOnce();
    expect(completeSession).toHaveBeenCalledOnce();
    expect(params.onSuccess).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('CS-01 — markAddOnSurgery failure: no false success', async () => {
    markAddOnSurgery.mockRejectedValue(axiosErr(500, 'Error marking add-on'));
    const params = buildParams({
      isDoneState: true,
      schedule: null,
      decision: 'DateForSurgery',
      packageName: 'Premium',
      packageRate: 2000,
      savedSnapshot: {
        packageName: 'Standard',
        packageRate: '1000',
      },
    });

    await expect(saveCounsellingSession(params)).rejects.toThrow(/add-on surgery queue status/);
    expect(markAddOnSurgery).toHaveBeenCalledOnce();
    expect(completeSession).not.toHaveBeenCalled();
    expect(params.onSuccess).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('Test 2 — OT failure after session save: no false success', async () => {
    upsertOtSchedule.mockRejectedValue(axiosErr(500, 'Error saving OT schedule'));
    const params = buildParams();

    await expect(saveCounsellingSession(params)).rejects.toThrow(/Counselling details were saved/);

    expect(saveSession).toHaveBeenCalledOnce();
    expect(upsertOtSchedule).toHaveBeenCalledOnce();
    expect(completeSession).not.toHaveBeenCalled();
    expect(params.onSuccess).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('Test 3 — OT API 403: failure surfaced, no false success', async () => {
    upsertOtSchedule.mockRejectedValue(axiosErr(403, 'Forbidden'));
    const params = buildParams();

    await expect(saveCounsellingSession(params)).rejects.toThrow(/Counselling details were saved/);
    expect(params.onSuccess).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(completeSession).not.toHaveBeenCalled();
  });

  it('Test 4 — OT API 409: conflict surfaced, no false success', async () => {
    upsertOtSchedule.mockRejectedValue(axiosErr(409, 'Conflict'));
    const params = buildParams();

    await expect(saveCounsellingSession(params)).rejects.toThrow(/Counselling details were saved/);
    expect(params.onSuccess).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('Test 5 — network/API failure: failure surfaced', async () => {
    upsertOtSchedule.mockRejectedValue(new Error('Network Error'));
    const params = buildParams();

    await expect(saveCounsellingSession(params)).rejects.toThrow(/Counselling details were saved/);
    expect(params.onSuccess).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('Test 6 — OT not required (NeedsTime): save succeeds without OT', async () => {
    const params = buildParams({
      decision: 'NeedsTime',
      followUpReason: 'Needs time',
      followUpDate: '2026-09-25',
      schedule: null,
    });

    await saveCounsellingSession(params);

    expect(upsertOtSchedule).not.toHaveBeenCalled();
    expect(editOtScheduleSlot).not.toHaveBeenCalled();
    expect(params.onSuccess).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith('Session completed successfully');
  });

  it('Test 7 — retry after OT failure: upsert called again (idempotent client path)', async () => {
    upsertOtSchedule
      .mockRejectedValueOnce(axiosErr(500, 'Error saving OT schedule'))
      .mockResolvedValueOnce({ id: 'ot-1' });

    const params = buildParams();
    await expect(saveCounsellingSession(params)).rejects.toThrow(/OT schedule could not be saved/);

    const retryParams = buildParams({
      onSuccess: params.onSuccess,
      invalidateWaitingList: params.invalidateWaitingList,
      invalidateSession: params.invalidateSession,
    });
    await saveCounsellingSession(retryParams);

    expect(upsertOtSchedule).toHaveBeenCalledTimes(2);
    expect(retryParams.onSuccess).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith('Session completed successfully');
  });

  it('uses editOtScheduleSlot when Done + existing OT id', async () => {
    const params = buildParams({
      isDoneState: true,
      existingOtScheduleId: 'ot-existing',
      savedSnapshot: {
        packageName: 'Standard',
        packageRate: '1000',
      },
    });

    await saveCounsellingSession(params);

    expect(editOtScheduleSlot).toHaveBeenCalledWith(
      'ot-existing',
      expect.objectContaining({
        doctorName: 'Dr. A',
        theatreName: 'OT-1',
      }),
    );
    expect(upsertOtSchedule).not.toHaveBeenCalled();
    expect(params.onSuccess).toHaveBeenCalledOnce();
  });

  it('editOtScheduleSlot failure also blocks success', async () => {
    editOtScheduleSlot.mockRejectedValue(axiosErr(500, 'Error updating slot'));
    const params = buildParams({
      isDoneState: true,
      existingOtScheduleId: 'ot-existing',
      savedSnapshot: {
        packageName: 'Standard',
        packageRate: '1000',
      },
    });

    await expect(saveCounsellingSession(params)).rejects.toThrow(/Counselling details were saved/);
    expect(params.onSuccess).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
