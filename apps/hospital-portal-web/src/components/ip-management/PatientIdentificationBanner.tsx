'use client';

import { X } from 'lucide-react';
import type { PatientJourneyRowDto } from '@/lib/api/ip-management.api';
import { IP_CENSUS_TEST_IDS } from '@/lib/ip-management/ip-census-test-ids';
import { operativeEyeDisplay } from '@/lib/ip-management/operative-eye-display';
import {
  NO_KNOWN_ALLERGIES_LABEL,
  UNWIRED_CLINICAL_ALERTS,
  type ClinicalAlertSource,
} from '@/lib/ip-management/clinical-alerts';

function calcAge(dob: string | null, ageOverride: number | null): string {
  if (ageOverride !== null && ageOverride !== undefined) return `${ageOverride} y`;
  if (!dob) return '—';
  return `${Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365))} y`;
}

function fmtDob(dob: string | null): string {
  if (!dob) return '—';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtSex(gender: string | null): string {
  if (!gender) return '—';
  const g = gender.trim();
  if (/^m(ale)?$/i.test(g)) return 'Male';
  if (/^f(emale)?$/i.test(g)) return 'Female';
  return g;
}

export interface PatientIdentificationBannerProps {
  journey: Pick<
    PatientJourneyRowDto,
    'patientName' | 'uhid' | 'patientAge' | 'patientDob' | 'patientGender' | 'eyeOperated'
  > & {
    wardName?: string | null;
    bedNumber?: string | null;
    slotLabel?: string | null;
    surgeonName?: string | null;
  };
  onClose?: () => void;
  showClose?: boolean;
  /** Cashier persona omits the clinical alert strip. */
  hideAlertStrip?: boolean;
  /**
   * Default `unwired`: render nothing. Never show "no known allergies" unless a
   * real patient-level source has answered the question (`cleared` / `present`).
   */
  clinicalAlerts?: ClinicalAlertSource;
}

/**
 * Sticky census / rail identity header. No truncation.
 * Alert strip is omitted until a patient-level source exists (never "no known allergies").
 */
export function PatientIdentificationBanner({
  journey,
  onClose,
  showClose = false,
  hideAlertStrip = false,
  clinicalAlerts = UNWIRED_CLINICAL_ALERTS,
}: PatientIdentificationBannerProps) {
  const eye = operativeEyeDisplay(journey.eyeOperated);
  const age = calcAge(journey.patientDob, journey.patientAge);

  return (
    <header
      data-testid={IP_CENSUS_TEST_IDS.identBanner}
      className="pib shrink-0"
    >
      <div className="pib-main">
        <div className="pib-id">
          <h2 className="pib-name">
            {journey.patientName?.trim() || '—'}
          </h2>
          <div className="pib-nums">
            <span>
              UHID{' '}
              <b>{journey.uhid?.trim() || '—'}</b>
            </span>
            <span>
              {age} · {fmtSex(journey.patientGender)}
            </span>
            <span>
              DOB <b>{fmtDob(journey.patientDob)}</b>
            </span>
          </div>
        </div>

        {eye.kind === 'eye' ? (
          <div
            data-testid={IP_CENSUS_TEST_IDS.laterality}
            className={`eye ${eye.code === 'OS' ? 'left' : ''}`}
          >
            <span className="eye-k">Operating</span>
            <span className="eye-v">{eye.word}</span>
            <span className="eye-abbr">{eye.code}</span>
          </div>
        ) : (
          <div
            data-testid={IP_CENSUS_TEST_IDS.laterality}
            className="eye none"
          >
            <span className="eye-k">Operating</span>
            <span className="eye-v">Not set</span>
          </div>
        )}

        {showClose && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="btn sm ghost"
            aria-label="Close patient context"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {(journey.wardName || journey.bedNumber || journey.slotLabel || journey.surgeonName) && (
        <div className="pib-where">
          {journey.wardName && (
            <span><span className="k">Ward</span> <span className="v">{journey.wardName}</span></span>
          )}
          {journey.bedNumber && (
            <span><span className="k">Bed</span> <span className="v">{journey.bedNumber}</span></span>
          )}
          {journey.slotLabel && (
            <span><span className="k">Slot</span> <span className="v">{journey.slotLabel}</span></span>
          )}
          {journey.surgeonName && (
            <span><span className="k">Surgeon</span> <span className="v">{journey.surgeonName}</span></span>
          )}
        </div>
      )}

      {eye.kind === 'missing' && (
        <div className="px-4 pb-2.5">
          <span
            data-testid={IP_CENSUS_TEST_IDS.lateralityBlocker}
            className="inline-flex rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
          >
            {eye.message}
          </span>
        </div>
      )}

      {!hideAlertStrip && clinicalAlerts.status === 'present' && clinicalAlerts.items.length > 0 && (
        <div
          data-testid={IP_CENSUS_TEST_IDS.alertStrip}
          className="flex flex-wrap gap-1.5 px-4 pb-2.5"
        >
          {clinicalAlerts.items.map(item => (
            <span
              key={item}
              className="inline-flex rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
            >
              {item}
            </span>
          ))}
        </div>
      )}

      {!hideAlertStrip && clinicalAlerts.status === 'cleared' && (
        <div data-testid={IP_CENSUS_TEST_IDS.alertStrip} className="px-4 pb-2.5">
          <span className="inline-flex rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
            {NO_KNOWN_ALLERGIES_LABEL}
          </span>
        </div>
      )}
    </header>
  );
}
