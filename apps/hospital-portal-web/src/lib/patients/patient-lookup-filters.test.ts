import { describe, expect, it } from 'vitest';

import {
  buildLookupUrlParams,
  CARE_PROGRAM_OPTIONS,
  ENGAGEMENT_TYPE_OPTIONS,
  parseListParam,
  parseLookupUrlParams,
  serializeList,
} from '@/lib/patients/patient-lookup-filters';

describe('patient-lookup-filters', () => {
  it('parseListParam splits comma values', () => {
    expect(parseListParam('CATARACT,RETINA')).toEqual(['CATARACT', 'RETINA']);
    expect(parseListParam(null)).toEqual([]);
  });

  it('serializeList joins values', () => {
    expect(serializeList(['opd', 'ip'])).toBe('opd,ip');
    expect(serializeList([])).toBeUndefined();
  });

  it('round-trips sort and filter params', () => {
    const params = new URLSearchParams(
      'q=alex&tab=current&page=2&sortBy=mrn&sortDir=desc&favorites=1&assigned=1&programCodes=CATARACT',
    );
    const state = parseLookupUrlParams(params);
    expect(state.q).toBe('alex');
    expect(state.tab).toBe('current');
    expect(state.page).toBe(2);
    expect(state.sortBy).toBe('mrn');
    expect(state.sortDir).toBe('desc');
    expect(state.favoritesOnly).toBe(true);
    expect(state.assignedToMe).toBe(true);
    expect(state.programCodes).toEqual(['CATARACT']);

    const rebuilt = buildLookupUrlParams({ ...state, branchId: 'branch-1' });
    expect(rebuilt.get('sortBy')).toBe('mrn');
    expect(rebuilt.get('sortDir')).toBe('desc');
    expect(rebuilt.get('programCodes')).toBe('CATARACT');
  });

  it('exposes five care programs including Cornea', () => {
    expect(CARE_PROGRAM_OPTIONS.map((o) => o.code)).toEqual([
      'CATARACT',
      'GLAUCOMA',
      'RETINA',
      'CORNEA',
      'REFRACTIVE',
    ]);
  });

  it('includes camp in engagement filter options', () => {
    expect(ENGAGEMENT_TYPE_OPTIONS.some((o) => o.value === 'camp')).toBe(true);
  });

  it('round-trips engagementTypes and previewPatientId', () => {
    const params = new URLSearchParams(
      'engagementTypes=opd,ip&preview=abc-123&programCodes=CORNEA,RETINA',
    );
    const state = parseLookupUrlParams(params);
    expect(state.engagementTypes).toEqual(['opd', 'ip']);
    expect(state.previewPatientId).toBe('abc-123');
    expect(state.programCodes).toEqual(['CORNEA', 'RETINA']);

    const rebuilt = buildLookupUrlParams(state);
    expect(rebuilt.get('engagementTypes')).toBe('opd,ip');
    expect(rebuilt.get('preview')).toBe('abc-123');
  });

  it('round-trips new sort keys', () => {
    const params = new URLSearchParams('sortBy=scheduledAt&sortDir=desc');
    const state = parseLookupUrlParams(params);
    expect(state.sortBy).toBe('scheduledAt');
    expect(state.sortDir).toBe('desc');

    const acuityState = parseLookupUrlParams(new URLSearchParams('sortBy=acuity'));
    expect(acuityState.sortBy).toBe('acuity');

    const waitState = parseLookupUrlParams(new URLSearchParams('sortBy=waitingMinutes'));
    expect(waitState.sortBy).toBe('waitingMinutes');
  });
});
