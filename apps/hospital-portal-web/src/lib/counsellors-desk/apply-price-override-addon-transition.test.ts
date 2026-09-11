import { beforeEach, describe, expect, it, vi } from 'vitest';

const markAddOnSurgery = vi.fn();
const addOnSurgery = vi.fn();

vi.mock('@/lib/api/counsellors-desk.api', () => ({
  counsellorsDeskApi: {
    markAddOnSurgery: (...args: unknown[]) => markAddOnSurgery(...args),
  },
}));

vi.mock('@/lib/api/counselling-azure.api', () => ({
  counsellingAzureApi: {
    addOnSurgery: (...args: unknown[]) => addOnSurgery(...args),
  },
}));

import { applyPriceOverrideAddOnTransition } from './apply-price-override-addon-transition';

function axiosErr(status: number, message: string) {
  return {
    isAxiosError: true,
    response: { status, data: { message } },
    message,
  };
}

describe('PO-01 applyPriceOverrideAddOnTransition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markAddOnSurgery.mockResolvedValue(undefined);
    addOnSurgery.mockResolvedValue(undefined);
  });

  it('Auth Add-On succeeds → operation succeeds and Azure best-effort is invoked', async () => {
    await applyPriceOverrideAddOnTransition('session-1', 'Package upgrade');

    expect(markAddOnSurgery).toHaveBeenCalledOnce();
    expect(markAddOnSurgery).toHaveBeenCalledWith('session-1');
    expect(addOnSurgery).toHaveBeenCalledOnce();
    expect(addOnSurgery).toHaveBeenCalledWith('session-1', 'Package upgrade');
  });

  it('Auth Add-On fails → throws, no success path, Azure not treated as success', async () => {
    markAddOnSurgery.mockRejectedValue(axiosErr(500, 'Error marking add-on'));

    await expect(applyPriceOverrideAddOnTransition('session-1', 'reason')).rejects.toThrow(
      /add-on surgery queue status/,
    );
    expect(markAddOnSurgery).toHaveBeenCalledOnce();
    expect(addOnSurgery).not.toHaveBeenCalled();
  });

  it('Auth 403 → actionable failure, Azure not called', async () => {
    markAddOnSurgery.mockRejectedValue(axiosErr(403, 'Forbidden'));

    await expect(applyPriceOverrideAddOnTransition('session-1', 'reason')).rejects.toThrow(
      /add-on surgery queue status/,
    );
    expect(addOnSurgery).not.toHaveBeenCalled();
  });

  it('Auth succeeds + Azure invoked fire-and-forget → still succeeds (Azure best-effort)', async () => {
    // Production Azure wrapper swallows failures; helper must not await it as a success gate.
    addOnSurgery.mockReturnValue(undefined);

    await expect(
      applyPriceOverrideAddOnTransition('session-1', 'reason'),
    ).resolves.toBeUndefined();
    expect(markAddOnSurgery).toHaveBeenCalledOnce();
    expect(addOnSurgery).toHaveBeenCalledOnce();
  });

  it('Retry after Auth failure → second attempt can succeed without prior Azure call', async () => {
    markAddOnSurgery
      .mockRejectedValueOnce(axiosErr(500, 'Error marking add-on'))
      .mockResolvedValueOnce(undefined);

    await expect(applyPriceOverrideAddOnTransition('session-1', 'reason')).rejects.toThrow(
      /add-on surgery queue status/,
    );
    expect(addOnSurgery).not.toHaveBeenCalled();

    await applyPriceOverrideAddOnTransition('session-1', 'reason');
    expect(markAddOnSurgery).toHaveBeenCalledTimes(2);
    expect(addOnSurgery).toHaveBeenCalledOnce();
  });
});
