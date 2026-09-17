import { describe, expect, it } from 'vitest';
import { applyWaitingListClientFilters } from './waiting-list-client-filters';
import type { WaitingListPatient } from '@/types/counsellors-desk';

function row(partial: Partial<WaitingListPatient> & Pick<WaitingListPatient, 'id' | 'type' | 'status'>): WaitingListPatient {
  return {
    slNo: 1,
    uhid: 'U1',
    patientName: 'Pat',
    eye: 'RE',
    surgeryName: 'Phaco',
    patientType: 'Cash',
    age: 50,
    gender: 'Female',
    doctor: 'Dr X',
    time: '10:00 AM',
    remarks: '',
    ...partial,
  };
}

describe('applyWaitingListClientFilters', () => {
  const patients = [
    row({ id: '1', type: 'Surgery', status: 'Pending', patientName: 'Meena', uhid: 'A1', doctor: 'Dr A', surgeryName: 'Phaco' }),
    row({ id: '2', type: 'Procedure', status: 'Pending', patientName: 'Ravi', uhid: 'B2', doctor: 'Dr B', surgeryName: 'YAG' }),
    row({ id: '3', type: 'Surgery', status: 'Done', patientName: 'Meena Two', uhid: 'C3', doctor: 'Dr A', surgeryName: 'SICS' }),
  ];

  it('filters by type immediately without requiring Apply', () => {
    const surgery = applyWaitingListClientFilters({
      patients,
      type: 'Surgery',
      activeTab: 'All',
      quickSearch: '',
      patientName: '',
      mrd: '',
      isPreAuthQueueRow: () => false,
    });
    expect(surgery.map((p) => p.id)).toEqual(['1', '3']);

    const procedure = applyWaitingListClientFilters({
      patients,
      type: 'Procedure',
      activeTab: 'All',
      quickSearch: '',
      patientName: '',
      mrd: '',
      isPreAuthQueueRow: () => false,
    });
    expect(procedure.map((p) => p.id)).toEqual(['2']);
  });

  it('combines type with status tab and quick search', () => {
    const result = applyWaitingListClientFilters({
      patients,
      type: 'Surgery',
      activeTab: 'Pending',
      quickSearch: 'meena',
      patientName: '',
      mrd: '',
      isPreAuthQueueRow: () => false,
    });
    expect(result.map((p) => p.id)).toEqual(['1']);
  });

  it('uses Pre-Auth Queue predicate when that tab is active', () => {
    const result = applyWaitingListClientFilters({
      patients,
      type: 'All',
      activeTab: 'PreAuthQueue',
      quickSearch: '',
      patientName: '',
      mrd: '',
      isPreAuthQueueRow: (p) => p.id === '2',
    });
    expect(result.map((p) => p.id)).toEqual(['2']);
  });

  it('quick search matches counsellor/owner name', () => {
    const withOwner = [
      ...patients,
      row({
        id: '4',
        type: 'Surgery',
        status: 'Pending',
        patientName: 'Other',
        uhid: 'D4',
        doctor: 'Dr Z',
        surgeryName: 'LASIK',
        counselorId: 'c-1',
        counselorName: 'Amelia Martinez',
      }),
    ];
    const result = applyWaitingListClientFilters({
      patients: withOwner,
      type: 'All',
      activeTab: 'All',
      quickSearch: 'amelia',
      patientName: '',
      mrd: '',
      isPreAuthQueueRow: () => false,
    });
    expect(result.map((p) => p.id)).toEqual(['4']);
  });

  it('filters by owner convenience scope without counselorId API keys', () => {
    const owned = [
      row({
        id: 'mine',
        type: 'Surgery',
        status: 'Pending',
        counselorId: 'me',
        counselorName: 'Me',
      }),
      row({
        id: 'peer',
        type: 'Surgery',
        status: 'Pending',
        counselorId: 'peer',
        counselorName: 'Peer',
      }),
      row({
        id: 'free',
        type: 'Surgery',
        status: 'Pending',
        counselorId: null,
        counselorName: undefined,
      }),
    ];

    expect(
      applyWaitingListClientFilters({
        patients: owned,
        type: 'All',
        activeTab: 'All',
        quickSearch: '',
        patientName: '',
        mrd: '',
        ownerFilter: 'Mine',
        currentUserId: 'me',
        isPreAuthQueueRow: () => false,
      }).map((p) => p.id),
    ).toEqual(['mine']);

    expect(
      applyWaitingListClientFilters({
        patients: owned,
        type: 'All',
        activeTab: 'All',
        quickSearch: '',
        patientName: '',
        mrd: '',
        ownerFilter: 'Unassigned',
        currentUserId: 'me',
        isPreAuthQueueRow: () => false,
      }).map((p) => p.id),
    ).toEqual(['free']);

    expect(
      applyWaitingListClientFilters({
        patients: owned,
        type: 'All',
        activeTab: 'All',
        quickSearch: '',
        patientName: '',
        mrd: '',
        ownerFilter: 'Other',
        currentUserId: 'me',
        isPreAuthQueueRow: () => false,
      }).map((p) => p.id),
    ).toEqual(['peer']);
  });
});
