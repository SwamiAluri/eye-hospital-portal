import { examinationApi, getApi } from '@/lib/api';
import { PATIENT_360_LIST_PAGE_SIZE, patient360PageFields } from '@/lib/patients/patient-360-list-paging';
import { imagingApi } from '@/lib/api/imaging.api';
import { labReportsApi } from '@/lib/api/lab-reports.api';
import { opticalOrdersApi } from '@/lib/api/optical-orders.api';
import { patientAllergiesApi } from '@/lib/api/patient-allergies.api';
import { patientNotesApi } from '@/lib/api/patient-notes.api';

export { IP_VITALS_UNAVAILABLE } from '@/lib/patients/patient-360-ip-vitals';

export type ClinicalSource =
  | 'vitals'
  | 'allergies'
  | 'examinations'
  | 'prescriptions'
  | 'codedDiagnosis'
  | 'labs'
  | 'imaging'
  | 'optical'
  | 'notes';

export type ReadState = 'ready' | 'unauthorized' | 'unavailable';

export interface NamedMeasure {
  label: string;
  value: string;
}

export interface OpdVitalRow {
  id: string;
  source: 'OPD';
  measuredAt: string | null;
  measures: NamedMeasure[];
}

export interface AllergyRecordRow {
  id: string;
  name: string;
  reaction: string | null;
  status: string | null;
  recorded: string | null;
}

export interface ExaminationRow {
  id: string;
  title: string;
  when: string | null;
  provider: string | null;
  eye: string | null;
  finding: string | null;
}

export interface PrescriptionLineRow {
  id: string;
  medicationName: string;
  genericName: string | null;
  dosage: string | null;
  form: string | null;
  route: string | null;
  frequency: string | null;
  durationDays: number | null;
  startDate: string | null;
  endDate: string | null;
}

export interface PrescriptionRow {
  id: string;
  when: string | null;
  status: string | null;
  lines: PrescriptionLineRow[];
}

export interface PrescriptionListResult {
  state: ReadState;
  rows: PrescriptionRow[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface CodedDiagnosisRow {
  id: string;
  code: string;
  description: string;
  diagnosisType: string | null;
  eyeSpecificity: string | null;
  codeLaterality: string | null;
  diagnosedAt: string | null;
}

export interface CodedDiagnosisListResult {
  state: ReadState;
  rows: CodedDiagnosisRow[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface LabReportRow {
  id: string;
  title: string;
  when: string | null;
  status: string | null;
  detail: string | null;
  reference: string | null;
  reportUrl: string | null;
  canonicalDocumentId: string | null;
  canonicalFileName: string | null;
  canonicalMimeType: string | null;
}

export interface ImagingOrderRow {
  id: string;
  title: string;
  when: string | null;
  status: string | null;
  detail: string | null;
}

export interface OpticalOrderRow {
  id: string;
  title: string;
  when: string | null;
  status: string | null;
  eye: string | null;
  prescription: string | null;
}

export interface ChartNoteRow {
  id: string;
  kind: 'Chart note';
  noteType: string;
  title: string;
  when: string | null;
  status: string | null;
  content: string | null;
  author: string | null;
}

export interface ClinicalListResult<T> {
  state: ReadState;
  rows: T[];
}

export interface Patient360ClinicalBundle {
  vitals: ClinicalListResult<OpdVitalRow>;
  allergies: ClinicalListResult<AllergyRecordRow>;
  examinations: ClinicalListResult<ExaminationRow>;
  prescriptions: PrescriptionListResult;
  labs: ClinicalListResult<LabReportRow>;
  imaging: ClinicalListResult<ImagingOrderRow>;
  optical: ClinicalListResult<OpticalOrderRow>;
  notes: ClinicalListResult<ChartNoteRow>;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function displayWhen(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (match) return `${match[1]} ${match[2]}`;
  return raw;
}

export function unwrapList(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.data)) return record.data;
  if (record.data && typeof record.data === 'object') {
    const nested = record.data as Record<string, unknown>;
    if (Array.isArray(nested.items)) return nested.items;
  }
  return null;
}

export function classifyReadError(error: unknown): Exclude<ReadState, 'ready'> {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 401 || status === 403) return 'unauthorized';
  return 'unavailable';
}

const EMPTY: Record<ClinicalSource, string> = {
  vitals: 'No OPD vitals recorded.',
  allergies: 'No allergy records recorded.',
  examinations: 'No examinations recorded.',
  prescriptions: 'No prescriptions recorded.',
  codedDiagnosis: 'No coded diagnoses recorded.',
  labs: 'No lab results recorded.',
  imaging: 'No imaging orders recorded.',
  optical: 'No optical orders recorded.',
  notes: 'No chart notes recorded.',
};

const UNAVAILABLE: Record<ClinicalSource, string> = {
  vitals: 'OPD vitals are not available in Patient 360.',
  allergies: 'Allergy records are not available in Patient 360.',
  examinations: 'Examinations are not available in Patient 360.',
  prescriptions: 'Prescriptions are not available in Patient 360.',
  codedDiagnosis: 'Coded diagnosis is not available in Patient 360.',
  labs: 'Laboratory reports are not available in Patient 360.',
  imaging: 'Imaging orders are not available in Patient 360.',
  optical: 'Optical orders are not available in Patient 360.',
  notes: 'Chart notes are not available in Patient 360.',
};

const UNAUTHORIZED: Record<ClinicalSource, string> = {
  vitals: 'OPD vitals are not available to this sign-in.',
  allergies: 'Allergy records are not available to this sign-in.',
  examinations: 'Examinations are not available to this sign-in.',
  prescriptions: 'Prescriptions are not available to this sign-in.',
  codedDiagnosis: 'Coded diagnosis is not available to this sign-in.',
  labs: 'Laboratory reports are not available to this sign-in.',
  imaging: 'Imaging orders are not available to this sign-in.',
  optical: 'Optical orders are not available to this sign-in.',
  notes: 'Chart notes are not available to this sign-in.',
};

export function clinicalEmptyMessage(source: ClinicalSource): string {
  return EMPTY[source];
}

export function clinicalUnavailableMessage(source: ClinicalSource): string {
  return UNAVAILABLE[source];
}

export function clinicalUnauthorizedMessage(source: ClinicalSource): string {
  return UNAUTHORIZED[source];
}

export function mapOpdVital(raw: Record<string, unknown>): OpdVitalRow | null {
  const measures: NamedMeasure[] = [];
  const systolic = raw.bloodPressureSystolic;
  const diastolic = raw.bloodPressureDiastolic;
  if (typeof systolic === 'number' && typeof diastolic === 'number') {
    measures.push({ label: 'Blood pressure', value: `${systolic}/${diastolic}` });
  }
  if (typeof raw.heartRate === 'number') measures.push({ label: 'Heart rate', value: String(raw.heartRate) });
  if (typeof raw.temperature === 'number') measures.push({ label: 'Temperature', value: String(raw.temperature) });
  if (typeof raw.oxygenSaturation === 'number') {
    measures.push({ label: 'Oxygen saturation', value: `${raw.oxygenSaturation}%` });
  }
  if (typeof raw.weightKg === 'number') measures.push({ label: 'Weight', value: `${raw.weightKg} kg` });
  if (typeof raw.heightCm === 'number') measures.push({ label: 'Height', value: `${raw.heightCm} cm` });
  if (typeof raw.bmi === 'number') measures.push({ label: 'BMI', value: String(raw.bmi) });
  if (!text(raw.id) || measures.length === 0) return null;
  return {
    id: String(raw.id),
    source: 'OPD',
    measuredAt: displayWhen(raw.measuredAt ?? raw.measurementDate),
    measures,
  };
}

export function mapAllergyRecord(raw: Record<string, unknown>): AllergyRecordRow | null {
  const name = text(raw.allergenName);
  const id = text(raw.id);
  if (!name || !id) return null;
  return {
    id,
    name,
    reaction: text(raw.reaction),
    status: text(raw.status),
    recorded: displayWhen(raw.createdAt ?? raw.onsetDate),
  };
}

export function mapExamination(raw: Record<string, unknown>): ExaminationRow | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    title: text(raw.examinationType) ?? text(raw.chiefComplaint) ?? 'Examination',
    when: displayWhen(raw.examinationDate ?? raw.createdAt),
    provider: text(raw.examinedByName) ?? text(raw.examiningDoctorName),
    eye: text(raw.laterality) ?? text(raw.eye),
    finding: text(raw.findings),
  };
}

function lineRow(raw: Record<string, unknown>): PrescriptionLineRow | null {
  const id = text(raw.id);
  const medicationName = text(raw.medicationName);
  if (!id || !medicationName) return null;
  const duration = raw.durationDays;
  return {
    id,
    medicationName,
    genericName: text(raw.genericName),
    dosage: text(raw.dosage),
    form: text(raw.form),
    route: text(raw.route),
    frequency: text(raw.frequency),
    durationDays: typeof duration === 'number' && Number.isFinite(duration) ? duration : null,
    startDate: displayWhen(raw.startDate),
    endDate: displayWhen(raw.endDate),
  };
}

export function mapPrescription(raw: Record<string, unknown>): PrescriptionRow | null {
  const id = text(raw.id);
  if (!id) return null;
  const lines = Array.isArray(raw.lines) ? raw.lines : Array.isArray(raw.medications) ? raw.medications : [];
  return {
    id,
    when: displayWhen(raw.prescriptionDate),
    status: text(raw.status),
    lines: lines
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map(lineRow)
      .filter((line): line is PrescriptionLineRow => line != null),
  };
}

export function mapLabReport(raw: Record<string, unknown>): LabReportRow | null {
  const id = text(raw.id);
  const title = text(raw.testName);
  if (!id || !title) return null;
  const value = [text(raw.resultValue), text(raw.resultUnit)].filter(Boolean).join(' ');
  const reportUrl = text(raw.reportUrl);
  return {
    id,
    title,
    when: displayWhen(raw.completedAt ?? raw.orderedAt ?? raw.createdAt),
    status: text(raw.status),
    detail: value || null,
    reference: text(raw.referenceRange),
    reportUrl: reportUrl && /^https?:\/\//i.test(reportUrl) ? reportUrl : null,
    canonicalDocumentId: text(raw.canonicalDocumentId),
    canonicalFileName: text(raw.canonicalFileName),
    canonicalMimeType: text(raw.canonicalMimeType),
  };
}

export function mapImagingOrder(raw: Record<string, unknown>): ImagingOrderRow | null {
  const id = text(raw.id);
  const title = text(raw.imagingType);
  if (!id || !title) return null;
  return {
    id,
    title,
    when: displayWhen(raw.orderedAt),
    status: text(raw.status),
    detail: text(raw.laterality),
  };
}

function opticalEye(raw: Record<string, unknown>): string | null {
  const od = text(raw.odSphere) || text(raw.odCylinder) || text(raw.odAxis) || text(raw.odAdd);
  const os = text(raw.osSphere) || text(raw.osCylinder) || text(raw.osAxis) || text(raw.osAdd);
  if (od && os) return 'OU';
  if (od) return 'OD';
  if (os) return 'OS';
  return null;
}

function opticalSide(label: string, sphere: string | null, cylinder: string | null, axis: string | null, add: string | null): string | null {
  const parts = [sphere, cylinder, axis ? `x${axis}` : null, add ? `add ${add}` : null].filter(Boolean);
  return parts.length ? `${label} ${parts.join(' ')}` : null;
}

export function mapOpticalOrder(raw: Record<string, unknown>): OpticalOrderRow | null {
  const id = text(raw.id);
  const title = text(raw.orderType);
  if (!id || !title) return null;
  const prescription = [
    opticalSide('OD', text(raw.odSphere), text(raw.odCylinder), text(raw.odAxis), text(raw.odAdd)),
    opticalSide('OS', text(raw.osSphere), text(raw.osCylinder), text(raw.osAxis), text(raw.osAdd)),
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    id,
    title,
    when: displayWhen(raw.orderDate ?? raw.createdAt),
    status: text(raw.status),
    eye: opticalEye(raw),
    prescription: prescription || null,
  };
}

export function mapChartNote(raw: Record<string, unknown>): ChartNoteRow | null {
  const id = text(raw.id);
  if (!id) return null;
  return {
    id,
    kind: 'Chart note',
    noteType: text(raw.noteType) ?? 'Chart note',
    title: text(raw.title) ?? 'Chart note',
    when: displayWhen(raw.createdAt),
    status: text(raw.status),
    content: text(raw.content),
    author: text(raw.authorName),
  };
}

async function readMapped<T>(
  task: () => Promise<unknown>,
  map: (raw: Record<string, unknown>) => T | null,
): Promise<ClinicalListResult<T>> {
  try {
    const rows = unwrapList(await task());
    if (!rows) return { state: 'unavailable', rows: [] };
    return {
      state: 'ready',
      rows: rows
        .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
        .map(map)
        .filter((row): row is T => row != null),
    };
  } catch (error) {
    return { state: classifyReadError(error), rows: [] };
  }
}

export async function loadPatient360Prescriptions(
  patientId: string,
  pageNumber: number,
): Promise<PrescriptionListResult> {
  try {
    const response = await getApi().get(`/prescriptions/patients/${patientId}/patient-360`, {
      params: { pageNumber, pageSize: PATIENT_360_LIST_PAGE_SIZE },
    });
    const rows = unwrapList(response.data);
    if (!rows) {
      return { state: 'unavailable', rows: [], totalCount: 0, pageNumber, pageSize: PATIENT_360_LIST_PAGE_SIZE };
    }
    return {
      state: 'ready',
      rows: rows
        .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
        .map(mapPrescription)
        .filter((row): row is PrescriptionRow => row != null),
      ...patient360PageFields(response.data, pageNumber),
    };
  } catch (error) {
    return {
      state: classifyReadError(error),
      rows: [],
      totalCount: 0,
      pageNumber,
      pageSize: PATIENT_360_LIST_PAGE_SIZE,
    };
  }
}

export function codedDiagnosisTypeLabel(value: string | null): string | null {
  if (value === 'primary') return 'Primary';
  if (value === 'secondary') return 'Secondary';
  if (value === 'rule-out') return 'Rule-out';
  return value;
}

export function mapCodedDiagnosis(raw: Record<string, unknown>): CodedDiagnosisRow | null {
  const id = text(raw.id);
  const code = text(raw.code);
  const description = text(raw.description);
  if (!id || !code || !description) return null;
  return {
    id,
    code,
    description,
    diagnosisType: text(raw.diagnosisType),
    eyeSpecificity: text(raw.eyeSpecificity),
    codeLaterality: text(raw.codeLaterality),
    diagnosedAt: displayWhen(raw.diagnosedAt),
  };
}

export async function loadPatient360CodedDiagnoses(
  patientId: string,
  pageNumber: number,
): Promise<CodedDiagnosisListResult> {
  try {
    const response = await getApi().get(`/diagnoses/patients/${patientId}/patient-360`, {
      params: { pageNumber, pageSize: PATIENT_360_LIST_PAGE_SIZE },
    });
    const rows = unwrapList(response.data);
    if (!rows) {
      return { state: 'unavailable', rows: [], totalCount: 0, pageNumber, pageSize: PATIENT_360_LIST_PAGE_SIZE };
    }
    return {
      state: 'ready',
      rows: rows
        .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
        .map(mapCodedDiagnosis)
        .filter((row): row is CodedDiagnosisRow => row != null),
      ...patient360PageFields(response.data, pageNumber),
    };
  } catch (error) {
    return {
      state: classifyReadError(error),
      rows: [],
      totalCount: 0,
      pageNumber,
      pageSize: PATIENT_360_LIST_PAGE_SIZE,
    };
  }
}

export async function loadPatient360Clinical(patientId: string): Promise<Patient360ClinicalBundle> {
  const [vitals, allergies, examinations, labs, imaging, optical, notes] = await Promise.all([
    readMapped(
      () => getApi().get(`/vitals/patient/${patientId}?limit=50`).then((response) => response.data),
      mapOpdVital,
    ),
    readMapped(
      () => patientAllergiesApi.getByPatient(patientId).then((response) => response.data),
      mapAllergyRecord,
    ),
    readMapped(
      () => examinationApi.getByPatient(patientId).then((response) => response.data),
      mapExamination,
    ),
    readMapped(
      () => labReportsApi.getByPatient(patientId).then((response) => response.data),
      mapLabReport,
    ),
    readMapped(() => imagingApi.getPatientOrders(patientId), mapImagingOrder),
    readMapped(
      () => opticalOrdersApi.getByPatient(patientId).then((response) => response.data),
      mapOpticalOrder,
    ),
    readMapped(
      () => patientNotesApi.getByPatient(patientId).then((response) => response.data),
      mapChartNote,
    ),
  ]);

  return {
    vitals,
    allergies,
    examinations,
    prescriptions: { state: 'ready', rows: [], totalCount: 0, pageNumber: 1, pageSize: PATIENT_360_LIST_PAGE_SIZE },
    labs,
    imaging,
    optical,
    notes,
  };
}
