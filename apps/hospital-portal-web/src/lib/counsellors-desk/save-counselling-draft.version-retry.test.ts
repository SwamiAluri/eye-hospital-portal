import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/counsellors-desk.api', () => ({
  counsellorsDeskApi: {
    saveSession: vi.fn(),
    getSession: vi.fn(),
    saveInvestigations: vi.fn(),
  },
}));

vi.mock('@/lib/api/counselling-azure.api', () => ({
  counsellingAzureApi: { save: vi.fn() },
}));

import { counsellorsDeskApi } from '@/lib/api/counsellors-desk.api';
import { saveCounsellingDraft } from '@/lib/counsellors-desk/save-counselling-draft';
import { EMPTY_COUNSELLING_ESTIMATE } from '@/types/counselling-estimate';
import type { CounsellingSession } from '@/types/counsellors-desk';

function axios409(message = 'This session was updated by another user. Refresh to continue.') {
  return {
    message: 'Request failed with status code 409',
    response: { status: 409, data: { message } },
  };
}

function baseSession(version: number): CounsellingSession {
  return {
    id: 'sess-1',
    patientId: 'p1',
    version,
  } as CounsellingSession;
}

function draftParams(overrides: {
  version: number;
  onSuccess?: ReturnType<typeof vi.fn>;
  onConcurrencyVersionSync?: ReturnType<typeof vi.fn>;
  invalidateSession?: ReturnType<typeof vi.fn>;
}) {
  return {
    sessionId: 'sess-1',
    session: baseSession(overrides.version),
    selectedSurgeryId: null,
    selectedVariantId: null,
    selectedEye: 'RE' as const,
    selectedIolId: null,
    variantSubOption: null,
    packageName: '',
    packageRate: '' as const,
    paymentType: 'Insurance' as const,
    insuranceCompany: 'United India Insurance',
    insuranceProviderId: undefined,
    freeSurgeryReason: '',
    decision: 'InterestedInSurgery' as const,
    followUpReason: '',
    followUpDate: '',
    counsellorNotes: '',
    patientRemarks: '',
    doctorNotes: '',
    wantToSeeDoctor: false,
    interestedToUpgrade: false,
    notRequiredPreAuth: false,
    schedule: null,
    selectedInvestigations: new Map(),
    mergedEstimate: EMPTY_COUNSELLING_ESTIMATE,
    savedSnapshot: {},
    isDoneState: false,
    onSuccess: overrides.onSuccess ?? vi.fn(),
    onConcurrencyVersionSync: overrides.onConcurrencyVersionSync ?? vi.fn(),
    invalidateSession: overrides.invalidateSession ?? vi.fn(),
  };
}

describe('saveCounsellingDraft — Version authority retry after coverage/system bump', () => {
  beforeEach(() => {
    vi.mocked(counsellorsDeskApi.saveSession).mockReset();
    vi.mocked(counsellorsDeskApi.getSession).mockReset();
    vi.mocked(counsellorsDeskApi.saveInvestigations).mockReset();
  });

  it('on 409, syncs Version and retries once when server Version advanced — no user-facing failure', async () => {
    const onSuccess = vi.fn();
    const onConcurrencyVersionSync = vi.fn();
    vi.mocked(counsellorsDeskApi.saveSession)
      .mockRejectedValueOnce(axios409())
      .mockResolvedValueOnce({ version: 5 });
    vi.mocked(counsellorsDeskApi.getSession).mockResolvedValue({
      ...baseSession(4),
      version: 4,
    } as CounsellingSession);

    await saveCounsellingDraft(draftParams({ version: 3, onSuccess, onConcurrencyVersionSync }));

    expect(counsellorsDeskApi.saveSession).toHaveBeenCalledTimes(2);
    expect(counsellorsDeskApi.saveSession.mock.calls[0][1]).toEqual(
      expect.objectContaining({ version: 3 }),
    );
    expect(counsellorsDeskApi.saveSession.mock.calls[1][1]).toEqual(
      expect.objectContaining({ version: 4 }),
    );
    expect(onConcurrencyVersionSync).toHaveBeenCalledWith(4);
    expect(onSuccess).toHaveBeenCalledWith(expect.any(Object), 5);
  });

  it('on 409, does not retry when Version did not advance — still surfaces concurrency message', async () => {
    const onConcurrencyVersionSync = vi.fn();
    vi.mocked(counsellorsDeskApi.saveSession).mockRejectedValue(axios409());
    vi.mocked(counsellorsDeskApi.getSession).mockResolvedValue({
      ...baseSession(3),
      version: 3,
    } as CounsellingSession);

    await expect(
      saveCounsellingDraft(draftParams({ version: 3, onConcurrencyVersionSync })),
    ).rejects.toThrow(/updated by another user/i);

    expect(counsellorsDeskApi.saveSession).toHaveBeenCalledTimes(1);
    expect(onConcurrencyVersionSync).toHaveBeenCalledWith(3);
  });
});
