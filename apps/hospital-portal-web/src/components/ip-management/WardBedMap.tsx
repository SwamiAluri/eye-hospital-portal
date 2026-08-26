'use client';

import type { WardBedDto } from '@/lib/api/ip-management.api';
import { WARD_PREOP_TEST_IDS } from '@/lib/ip-management/ward-preop-test-ids';
import {
  isOccupiedPatientCell,
  wardBedMapKind,
  wardBedNumberLabel,
  wardBedStatusLabel,
  wardBedWhoLine,
} from '@/lib/ip-management/ward-bed-map';

export function WardBedMap({
  beds,
  loading,
  selectedJourneyId,
  onOccupiedClick,
}: {
  beds: WardBedDto[];
  loading?: boolean;
  selectedJourneyId?: string | null;
  onOccupiedClick: (journeyId: string) => void;
}) {
  if (loading) {
    return (
      <div data-testid={WARD_PREOP_TEST_IDS.wardBedMap} className="bed-map" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bed-cell available" aria-hidden="true">
            <div className="bn">…</div>
            <div className="st">Loading</div>
            <div className="who">Beds</div>
          </div>
        ))}
      </div>
    );
  }

  if (beds.length === 0) {
    return (
      <div data-testid={WARD_PREOP_TEST_IDS.wardBedMap} className="bed-map">
        <p className="small" style={{ gridColumn: '1 / -1', margin: 0 }}>
          No beds on this ward.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div data-testid={WARD_PREOP_TEST_IDS.wardBedMap} className="bed-map">
        {beds.map(bed => {
          const kind = wardBedMapKind(bed);
          const selected = Boolean(selectedJourneyId && bed.occupantJourneyId === selectedJourneyId);
          const patientClick = isOccupiedPatientCell(bed);
          const className = `bed-cell ${kind}${selected ? ' sel' : ''}`;
          const body = (
            <>
              <div className="bn">{wardBedNumberLabel(bed)}</div>
              <div className="st">{wardBedStatusLabel(bed)}</div>
              <div className="who">{wardBedWhoLine(bed)}</div>
            </>
          );
          if (patientClick) {
            return (
              <button
                key={bed.bedId}
                type="button"
                data-testid={WARD_PREOP_TEST_IDS.wardBedCell(bed.bedId)}
                data-occupied="true"
                className={className}
                onClick={() => onOccupiedClick(bed.occupantJourneyId!)}
              >
                {body}
              </button>
            );
          }
          return (
            <div
              key={bed.bedId}
              data-testid={WARD_PREOP_TEST_IDS.wardBedCell(bed.bedId)}
              data-occupied="false"
              className={className}
            >
              {body}
            </div>
          );
        })}
      </div>
      <div className="bed-legend">
        <span><i className="lg-available" /> Available</span>
        <span><i className="lg-occupied" /> Occupied</span>
        <span><i className="lg-cleaning" /> Cleaning</span>
        <span><i className="lg-reserved" /> Reserved</span>
        <span>Status is labelled on every chair — colour is not the only cue.</span>
      </div>
    </div>
  );
}
