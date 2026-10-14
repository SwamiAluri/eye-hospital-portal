/**
 * Development-only Patient 360 UAT fixture.
 * Calls existing patient create/lookup APIs and existing domain write APIs.
 * Does not create tables or production rows outside this deterministic identity.
 * Requires a non-production API.
 *
 *   npx tsx scripts/seed-patient-360-uat.ts
 */
import { PATIENT_360_UAT_LOOKUP_QUERY, PATIENT_360_UAT_SEED } from '../src/lib/patients/patient-360-uat-seed';

const authApiBase = (process.env.E2E_API_URL ?? 'http://localhost:5073/api').replace(/\/$/, '');
const tenantId = process.env.E2E_TEST_TENANT_ID ?? '155fe198-6ae5-4a01-9254-ead5b427247e';
const branchId = process.env.E2E_TEST_BRANCH_ID ?? '74c014cf-9570-4824-bdf9-b369ea11a8f4';
const email = process.env.E2E_TEST_EMAIL ?? 'admin@test.com';
const password = process.env.E2E_TEST_PASSWORD ?? 'Admin123!';
const doctorId = process.env.E2E_TEST_DOCTOR_ID ?? '';

type LookupPage = { items?: Array<{ id: string; firstName?: string; lastName?: string; email?: string; phone?: string }> };

const UAT_NOTE = 'UAT360 Longitudinal development fixture';

async function postJson(
  headers: Record<string, string>,
  path: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(`${authApiBase}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

async function getJson(headers: Record<string, string>, path: string): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(`${authApiBase}${path}`, { headers });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, json };
}

function alreadySeeded(payload: unknown): boolean {
  return JSON.stringify(payload ?? '').includes(UAT_NOTE);
}

async function seedDomains(headers: Record<string, string>, patientId: string) {
  const report: Array<Record<string, unknown>> = [];

  const vitals = await getJson(headers, `/vitals/patient/${patientId}?limit=5`);
  if (vitals.ok && alreadySeeded(vitals.json)) {
    report.push({ domain: 'vitals', status: 'skipped', reason: 'idempotent' });
  } else {
    const created = await postJson(headers, `/vitals/patient/${patientId}`, {
      bloodPressureSystolic: 128,
      bloodPressureDiastolic: 82,
      heartRate: 72,
      temperature: 36.8,
      oxygenSaturation: 98,
      weightKg: 68,
      notes: UAT_NOTE,
    });
    report.push({ domain: 'vitals', status: created.ok ? 'created' : 'seed-gap', http: created.status });
  }

  const allergies = await getJson(headers, `/patient-allergies/patient/${patientId}`);
  if (allergies.ok && alreadySeeded(allergies.json)) {
    report.push({ domain: 'allergies', status: 'skipped', reason: 'idempotent' });
  } else {
    const created = await postJson(headers, '/patient-allergies', {
      patientId,
      allergenName: 'Penicillin',
      allergenType: 'medication',
      severity: 'moderate',
      reaction: 'Rash',
      notes: UAT_NOTE,
      status: 'active',
    });
    report.push({ domain: 'allergies', status: created.ok ? 'created' : 'seed-gap', http: created.status });
  }

  const notes = await getJson(headers, `/patient-notes/patient/${patientId}`);
  if (notes.ok && alreadySeeded(notes.json)) {
    report.push({ domain: 'notes', status: 'skipped', reason: 'idempotent' });
  } else {
    const created = await postJson(headers, '/patient-notes', {
      patientId,
      noteType: 'clinical',
      title: 'UAT360 chart note',
      content: UAT_NOTE,
      priority: 'normal',
      status: 'active',
    });
    report.push({ domain: 'notes', status: created.ok ? 'created' : 'seed-gap', http: created.status });
  }

  const consents = await getJson(headers, `/patient-consents/patient/${patientId}`);
  if (consents.ok && alreadySeeded(consents.json)) {
    report.push({ domain: 'consents', status: 'skipped', reason: 'idempotent' });
  } else {
    const created = await postJson(headers, '/patient-consents', {
      patientId,
      consentType: 'treatment',
      consentName: 'UAT360 treatment consent',
      isGranted: true,
      notes: UAT_NOTE,
      status: 'active',
    });
    report.push({ domain: 'consents', status: created.ok ? 'created' : 'seed-gap', http: created.status });
  }

  const comms = await getJson(headers, `/patient-communications/patient/${patientId}`);
  if (comms.ok && alreadySeeded(comms.json)) {
    report.push({ domain: 'communications', status: 'skipped', reason: 'idempotent' });
  } else {
    const created = await postJson(headers, '/patient-communications', {
      patientId,
      channel: 'sms',
      subject: 'UAT360 reminder',
      message: UAT_NOTE,
      status: 'sent',
    });
    report.push({ domain: 'communications', status: created.ok ? 'created' : 'seed-gap', http: created.status });
  }

  const insurance = await getJson(headers, `/patient-insurance/patient/${patientId}`);
  if (insurance.ok && alreadySeeded(insurance.json)) {
    report.push({ domain: 'insurance', status: 'skipped', reason: 'idempotent' });
  } else {
    const created = await postJson(headers, '/patient-insurance', {
      patientId,
      providerName: 'UAT360 Payer',
      policyNumber: 'UAT360-POL-1',
      planName: 'UAT plan',
      status: 'active',
      notes: UAT_NOTE,
    });
    report.push({ domain: 'insurance', status: created.ok ? 'created' : 'seed-gap', http: created.status });
  }

  if (!doctorId) {
    report.push({
      domain: 'appointments',
      status: 'seed-gap',
      reason: 'E2E_TEST_DOCTOR_ID not set; appointment/visit/bill not seeded',
    });
  } else {
    const created = await postJson(headers, '/appointments', {
      patientId,
      doctorId,
      appointmentDate: '2026-10-20T10:30:00',
      appointmentType: 'OPD',
      notes: UAT_NOTE,
      branchId,
    });
    report.push({ domain: 'appointments', status: created.ok ? 'created' : 'seed-gap', http: created.status });
  }

  report.push({ domain: 'ccms', status: 'seed-gap', reason: 'requires coverage-case workflow IDs' });
  report.push({ domain: 'imaging-files', status: 'seed-gap', reason: 'requires imaging order then upload' });
  report.push({ domain: 'ip-history', status: 'seed-gap', reason: 'requires IP journey onboard' });
  report.push({ domain: 'mpi-documents', status: 'source-gap', reason: 'no patient-scoped MPI document API' });

  return report;
}

async function main() {
  if ((process.env.NODE_ENV ?? '').toLowerCase() === 'production') {
    throw new Error('Patient 360 UAT seed is development-only.');
  }

  const loginRes = await fetch(`${authApiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, tenantId }),
  });
  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  const login = (await loginRes.json()) as { accessToken: string };
  const headers = {
    Authorization: `Bearer ${login.accessToken}`,
    'X-Tenant-ID': tenantId,
    'Content-Type': 'application/json',
  };

  let patientId: string | undefined;
  const lookupRes = await fetch(
    `${authApiBase}/patients/lookup?branchId=${branchId}&q=${encodeURIComponent(PATIENT_360_UAT_LOOKUP_QUERY)}&page=1&pageSize=10`,
    { headers },
  );
  if (lookupRes.ok) {
    const data = (await lookupRes.json()) as LookupPage;
    const existing = data.items?.find(
      (row) =>
        row.firstName === PATIENT_360_UAT_SEED.firstName && row.lastName === PATIENT_360_UAT_SEED.lastName,
    );
    if (existing?.id) patientId = existing.id;
  }

  if (!patientId) {
    const createRes = await fetch(`${authApiBase}/patients`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        firstName: PATIENT_360_UAT_SEED.firstName,
        lastName: PATIENT_360_UAT_SEED.lastName,
        dateOfBirth: PATIENT_360_UAT_SEED.dateOfBirth,
        gender: PATIENT_360_UAT_SEED.gender,
        contactNumber: PATIENT_360_UAT_SEED.contactNumber,
        email: PATIENT_360_UAT_SEED.email,
        emergencyContactName: PATIENT_360_UAT_SEED.emergencyContactName,
        emergencyContactPhone: PATIENT_360_UAT_SEED.emergencyContactPhone,
        emergencyContactRelationship: PATIENT_360_UAT_SEED.emergencyContactRelationship,
        bloodGroup: PATIENT_360_UAT_SEED.bloodGroup,
        allergies: PATIENT_360_UAT_SEED.allergies,
        branchId,
      }),
    });
    const createText = await createRes.text();
    if (!createRes.ok) throw new Error(`Create failed: ${createRes.status} ${createText}`);
    const created = JSON.parse(createText) as { id?: string };
    patientId = created.id;
    if (!patientId) throw new Error('Create succeeded without patient id');
  }

  const domains = await seedDomains(headers, patientId);
  console.log(JSON.stringify({ status: 'ok', patientId, domains }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
