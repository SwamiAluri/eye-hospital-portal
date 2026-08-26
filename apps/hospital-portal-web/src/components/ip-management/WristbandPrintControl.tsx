'use client';

import { useEffect, useState } from 'react';
import {
  formatApiError,
  ipManagementApi,
  type JourneySafetyTokenDto,
  type PatientJourneyRowDto,
} from '@/lib/api/ip-management.api';
import { WristbandPrintDialog } from '@/components/ip-management/WristbandPrintDialog';
import { IP_CENSUS_TEST_IDS } from '@/lib/ip-management/ip-census-test-ids';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import { canIssueWristband } from '@/lib/ip-management/wristband-print';

export function WristbandPrintControl({
  journey,
  canPrint,
  variant,
}: {
  journey: PatientJourneyRowDto;
  canPrint: boolean;
  variant: 'admit' | 'rail';
}) {
  const [issued, setIssued] = useState<JourneySafetyTokenDto | null>(null);
  const [token, setToken] = useState<JourneySafetyTokenDto | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const printable = canPrint && canIssueWristband(journey.clinicalState);

  useEffect(() => {
    if (!printable || variant !== 'admit') return;
    let cancelled = false;
    void ipManagementApi.getSafetyToken(journey.id).then(row => {
      if (!cancelled) setIssued(row);
    }).catch(() => {
      if (!cancelled) setIssued(null);
    });
    return () => {
      cancelled = true;
    };
  }, [printable, variant, journey.id]);

  if (!printable) return null;

  async function handlePrint() {
    setBusy(true);
    setError('');
    try {
      const current = issued ?? await ipManagementApi.getSafetyToken(journey.id);
      const next = current
        ? await ipManagementApi.reprintSafetyToken(journey.id)
        : await ipManagementApi.issueSafetyToken(journey.id);
      setIssued(next);
      setToken(next);
      setOpen(true);
    } catch (err: unknown) {
      setError(formatApiError(err, 'Could not print wristband.'));
    } finally {
      setBusy(false);
    }
  }

  const label = issued ? 'Reprint wristband' : 'Print wristband';
  const testId = variant === 'rail'
    ? IP_CENSUS_TEST_IDS.printWristband
    : WARD_PREOP_TEST_IDS.printWristband;

  const actions = (
    <>
      {variant === 'admit' && issued && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
          <b>Wristband already issued</b>
          {' · '}token <span className="font-mono">{issued.tokenCode}</span>.
          Reprint uses the same token. Do not mint a second band unless the first is revoked.
        </div>
      )}
      {error && (
        <p className="text-xs text-rose-700 bg-rose-50 rounded-lg px-3 py-2">{error}</p>
      )}
      <button
        type="button"
        data-testid={testId}
        disabled={busy}
        onClick={() => void handlePrint()}
        className={variant === 'rail'
          ? 'btn ghost sm'
          : 'inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60'}
      >
        {busy ? 'Preparing…' : label}
      </button>
    </>
  );

  return (
    <>
      {variant === 'admit' ? <div className="space-y-2">{actions}</div> : actions}
      {open && token && (
        <WristbandPrintDialog
          journey={journey}
          token={token}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
