import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WaitingListWorkRow } from './WaitingListWorkRow';
import type { WaitingListPatient } from '@/types/counsellors-desk';

function basePatient(overrides: Partial<WaitingListPatient> = {}): WaitingListPatient {
  return {
    id: 'sess-1',
    slNo: 1,
    uhid: 'UH1',
    patientName: 'Vasantha Kumari',
    eye: 'OU',
    type: 'Surgery',
    surgeryName: 'LASIK Both Eyes',
    patientType: 'Cash',
    age: 55,
    gender: 'F',
    doctor: 'Dr. Rao',
    time: '08 Apr 2026',
    remarks: '',
    status: 'RepeatCounselling',
    counselorId: 'amelia',
    counselorName: 'Amelia',
    ...overrides,
  };
}

describe('WaitingListWorkRow — OT Returned', () => {
  it('Vasantha: OT Returned + RepeatCounselling shows Start Repeat (not Start Counseling)', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow
        patient={basePatient()}
        isSelected={false}
        activeTab="OtReturned"
        hasCcmsCase={false}
        currentUserId="amelia"
        onRowClick={() => {}}
        onDemographics={() => {}}
        onPreAuth={() => {}}
        onLifecycleAction={() => {}}
        otReturnReason="Anaesthesia Contraindication"
      />,
    );
    expect(html).toContain('OT Returned');
    expect(html).toContain('Anaesthesia Contraindication');
    expect(html).toContain('Start Repeat');
    expect(html).toContain('waiting-list-row-lifecycle-start-repeat');
    expect(html).not.toContain('waiting-list-row-ot-start-counselling');
    expect(html).toContain('Surgery');
    expect(html).toContain('08 Apr 2026');
    expect(html).toContain(WAITING_LIST_WORK_GRID_SNIPPET);
  });

  it('no-session OT Returned shows Start Counseling create CTA', () => {
    const html = renderToStaticMarkup(
      <WaitingListWorkRow
        patient={basePatient({ status: 'Pending', counselorId: null, id: 'journey-1' })}
        isSelected={false}
        activeTab="OtReturned"
        hasCcmsCase={false}
        currentUserId="amelia"
        onRowClick={() => {}}
        onDemographics={() => {}}
        onPreAuth={() => {}}
        otReturnReason="BP high"
        onOtStartCounselling={() => {}}
      />,
    );
    expect(html).toContain('Start Counseling');
    expect(html).toContain('waiting-list-row-ot-start-counselling');
    expect(html).not.toContain('Start Repeat');
  });
});

const WAITING_LIST_WORK_GRID_SNIPPET = 'waiting-list-work-grid';
