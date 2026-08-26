'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { JourneySafetyTokenDto, PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import {
  formatWristbandDob,
  formatWristbandGender,
  wristbandEyeLine,
} from '@/lib/ip-management/wristband-print';

export function WristbandPrintDialog({
  journey,
  token,
  onClose,
}: {
  journey: PatientJourneyRowDto;
  token: JourneySafetyTokenDto;
  onClose: () => void;
}) {
  const [qrUrl, setQrUrl] = useState('');
  const eye = wristbandEyeLine(token.laterality ?? journey.eyeOperated);
  const printed = token.printedAt ? new Date(token.printedAt) : new Date();
  const printedLabel = printed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const ageBits = [
    journey.patientAge != null ? `${journey.patientAge} years` : null,
    formatWristbandGender(journey.patientGender) || null,
  ].filter(Boolean);

  useEffect(() => {
    void QRCode.toDataURL(token.barcodeValue, {
      width: 160,
      margin: 0,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(''));
  }, [token.barcodeValue]);

  return (
    <div
      data-testid={WARD_PREOP_TEST_IDS.wristbandDialog}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 wristband-print-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wristband-print-title"
    >
      <style>{`
        @media print {
          @page { size: landscape; margin: 8mm; }
          body * { visibility: hidden !important; }
          .wristband-print-sheet, .wristband-print-sheet * { visibility: visible !important; }
          .wristband-print-chrome { display: none !important; }
          .wristband-print-root { position: static !important; background: transparent !important; inset: auto !important; padding: 0 !important; }
          .wristband-print-sheet {
            position: absolute !important;
            left: 0; top: 0;
            box-shadow: none !important;
            border: 1px solid #0f172a !important;
          }
        }
      `}</style>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <div className="wristband-print-chrome mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="wristband-print-title" className="text-base font-semibold text-slate-900">
              Print wristband
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Same token until revoked. Laterality is spelled, never colour alone.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div
          data-testid={WARD_PREOP_TEST_IDS.wristbandSheet}
          className="wristband-print-sheet relative rounded-b-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-5 pb-4 pt-6"
        >
          <div
            aria-hidden="true"
            className="absolute left-4 right-4 top-2 h-1.5 rounded-full"
            style={{ background: 'repeating-linear-gradient(90deg, #0f172a 0 3px, transparent 3px 6px)' }}
          />
          <p className="text-xs text-slate-500">
            {journey.admissionType === 'DayCare' ? 'Day-care' : journey.admissionType || 'Inpatient'} · {printedLabel}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {journey.patientName || 'Patient'}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            UHID <span className="font-mono font-semibold">{journey.uhid || '—'}</span>
            {' · '}DOB {formatWristbandDob(journey.patientDob)}
            {ageBits.length ? ` · ${ageBits.join(' · ')}` : ''}
          </p>
          <div className="mt-3 rounded-lg border-2 border-slate-800 px-3 py-2 text-sm font-semibold tracking-wide text-slate-900">
            OPERATING EYE · {eye.word}{eye.abbr ? ` (${eye.abbr})` : ''}
          </div>
          <div className="mt-3 flex items-end gap-4">
            {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data-URL QR for print CSS
            <img src={qrUrl} alt="" width={96} height={96} className="h-24 w-24" />
            ) : (
              <div
                aria-hidden="true"
                className="h-10 flex-1 rounded"
                style={{ background: 'repeating-linear-gradient(90deg, #0f172a 0 2px, transparent 2px 5px)' }}
              />
            )}
            <div>
              <p className="font-mono text-sm font-semibold text-slate-900">{token.tokenCode}</p>
              <p className="mt-0.5 font-mono text-[10px] text-slate-500 break-all">{token.barcodeValue}</p>
            </div>
          </div>
        </div>

        <div className="wristband-print-chrome mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
