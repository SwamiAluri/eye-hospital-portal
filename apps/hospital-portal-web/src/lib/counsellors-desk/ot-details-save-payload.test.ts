import { describe, expect, it } from 'vitest';
import {
  buildOtDetailsSavePayload,
  mergeOtDetailsSaveIntoRecord,
} from '@/lib/counsellors-desk/ot-details-save-payload';
import type { FinalizeSurgeryRecord, UpdateOtDetailsPayload } from '@/types/counsellors-desk';

describe('buildOtDetailsSavePayload', () => {
  const baseForm: UpdateOtDetailsPayload = {
    doctorId: '',
    doctorName: 'Dr. Nair',
    theatreId: '',
    theatreName: 'OT-3',
    startTime: '09:00',
    endTime: '10:00',
    reportingTime: '08:30',
    anesthesiaType: 'Topical',
    anesthetistName: 'John Smith',
    iolPower: '',
    remarks: 'UAT anaesthesia persistence test',
    cancelReason: '',
    packageName: 'Phaco Standard',
    packageRate: 45000,
  };

  it('includes anesthesiaType, anesthetistName, and remarks in the PUT body', () => {
    const payload = buildOtDetailsSavePayload(baseForm, '2026-04-14');
    expect(payload.anesthesiaType).toBe('Topical');
    expect(payload.anesthetistName).toBe('John Smith');
    expect(payload.remarks).toBe('UAT anaesthesia persistence test');
  });

  it('omits empty anesthesia/remarks strings so partial updates do not wipe DB values', () => {
    const payload = buildOtDetailsSavePayload(
      { ...baseForm, anesthesiaType: '', anesthetistName: '', remarks: '   ' },
      '2026-04-14',
    );
    expect(payload.anesthesiaType).toBeUndefined();
    expect(payload.anesthetistName).toBeUndefined();
    expect(payload.remarks).toBeUndefined();
  });

  it('preserves Other / external anaesthetist name', () => {
    const payload = buildOtDetailsSavePayload(
      { ...baseForm, anesthetistName: 'External Anaesthetist UAT' },
      '2026-04-14',
    );
    expect(payload.anesthetistName).toBe('External Anaesthetist UAT');
  });
});

describe('mergeOtDetailsSaveIntoRecord', () => {
  it('copies anaesthesia fields from the save payload onto the PUT response', () => {
    const apiResponse = {
      id: 'sched-1',
      uhid: 'UHID',
      patientName: 'Pat',
      surgeryName: 'Phaco',
      eyes: 'RE',
      patientType: 'Cash',
      paymentMode: 'Cash',
      surgeon: 'Dr. Nair',
      startTime: '09:00',
      theaterName: 'OT-3',
      status: 'NotConfirmed',
      version: 2,
      isLocked: false,
    } as FinalizeSurgeryRecord;

    const merged = mergeOtDetailsSaveIntoRecord(apiResponse, {
      anesthesiaType: 'Topical',
      anesthetistName: 'John Smith',
      remarks: 'UAT anaesthesia persistence test',
    });

    expect(merged.anesthesiaType).toBe('Topical');
    expect(merged.anesthetistName).toBe('John Smith');
    expect(merged.remarks).toBe('UAT anaesthesia persistence test');
  });
});
