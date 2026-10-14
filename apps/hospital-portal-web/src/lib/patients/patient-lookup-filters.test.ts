import { describe, expect, it } from 'vitest';

import { buildPatientLookupQueryParams } from '@/lib/api/patient-lookup.api';
import {
  buildLookupUrlParams,
  CARE_PROGRAM_OPTIONS,
  countActiveFilters,
  ENGAGEMENT_TYPE_OPTIONS,
  parseListParam,
  parseLookupUrlParams,
  serializeList,
  toPatientLookupFilters,
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

  it('sends URL filters on the existing lookup request and drops a cleared filter', () => {
    const params = new URLSearchParams(
      [
        'q=sam',
        'tab=current',
        'favorites=1',
        'assigned=1',
        'gender=female',
        'mrn=MRN-2026-02-CE412',
        'phone=9876543210',
        'name=Sam',
        'diagnosis=cataract',
        'providerId=11111111-1111-1111-1111-111111111111',
        'departmentId=22222222-2222-2222-2222-222222222222',
        'wardName=Ward A',
        'dobFrom=1990-01-01',
        'dobTo=1990-12-31',
        'appointmentFrom=2026-06-01',
        'appointmentTo=2026-06-30',
        'admissionFrom=2026-05-01',
        'admissionTo=2026-05-31',
        'programCodes=CATARACT',
        'engagementTypes=opd',
        'patientTypes=Cash',
        'preview=patient-1',
      ].join('&'),
    );
    const state = parseLookupUrlParams(params);
    const filters = toPatientLookupFilters(state, {
      branchId: 'branch-1',
      pageSize: 25,
      q: state.q,
    });
    const request = buildPatientLookupQueryParams(filters);

    expect(filters.tab).toBe('current');
    expect(filters.favoritesOnly).toBe(true);
    expect(filters.assignedToMe).toBe(true);
    expect(filters.pageSize).toBe(25);
    expect(request.q).toBe('sam');
    expect(request.tab).toBe('current');
    expect(request.gender).toBe('female');
    expect(request.mrn).toBe('MRN-2026-02-CE412');
    expect(request.phone).toBe('9876543210');
    expect(request.name).toBe('Sam');
    expect(request.diagnosis).toBe('cataract');
    expect(request.providerId).toBe('11111111-1111-1111-1111-111111111111');
    expect(request.departmentId).toBe('22222222-2222-2222-2222-222222222222');
    expect(request.wardName).toBe('Ward A');
    expect(request.dobFrom).toBe('1990-01-01');
    expect(request.dobTo).toBe('1990-12-31');
    expect(request.appointmentFrom).toBe('2026-06-01');
    expect(request.appointmentTo).toBe('2026-06-30');
    expect(request.admissionFrom).toBe('2026-05-01');
    expect(request.admissionTo).toBe('2026-05-31');
    expect(request.programCodes).toBe('CATARACT');
    expect(request.engagementTypes).toBe('opd');
    expect(request.patientTypes).toBe('Cash');
    expect(request.favoritesOnly).toBe(true);
    expect(request.assignedToMe).toBe(true);
    expect(request.pageSize).toBe(25);
    expect(request).not.toHaveProperty('preview');

    const cleared = toPatientLookupFilters(
      { ...state, providerId: undefined, gender: undefined },
      { branchId: 'branch-1', pageSize: 25, q: 'sam' },
    );
    const clearedRequest = buildPatientLookupQueryParams(cleared);
    expect(clearedRequest.providerId).toBeUndefined();
    expect(clearedRequest.gender).toBeUndefined();
    expect(clearedRequest.dobFrom).toBe('1990-01-01');
    expect(clearedRequest.mrn).toBe('MRN-2026-02-CE412');
    expect(clearedRequest.phone).toBe('9876543210');
    expect(clearedRequest.name).toBe('Sam');
  });

  it('keeps census tab, favorites, and assigned-to-me values unchanged', () => {
    for (const tab of ['all', 'current', 'new', 'discharged', 'high_priority'] as const) {
      const state = parseLookupUrlParams(new URLSearchParams(`tab=${tab}&favorites=1&assigned=1`));
      const filters = toPatientLookupFilters(state, { branchId: 'b', pageSize: 25, q: '' });
      expect(filters.tab).toBe(tab);
      expect(filters.favoritesOnly).toBe(true);
      expect(filters.assignedToMe).toBe(true);
    }
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

  it('countActiveFilters counts only Gen-1 Gender + DOB range', () => {
    expect(countActiveFilters({})).toBe(0);
    expect(countActiveFilters({ q: 'x', tab: 'current' })).toBe(0);
    expect(countActiveFilters({ gender: 'female' })).toBe(1);
    expect(countActiveFilters({ dobFrom: '1990-01-01', dobTo: '1995-12-31' })).toBe(1);
    expect(
      countActiveFilters({ gender: 'male', dobFrom: '1990-01-01', dobTo: '1995-12-31' }),
    ).toBe(2);
    expect(
      countActiveFilters({
        diagnosis: 'cataract',
        favoritesOnly: true,
        engagementTypes: ['opd'],
        name: 'legacy',
      }),
    ).toBe(0);
  });
});

