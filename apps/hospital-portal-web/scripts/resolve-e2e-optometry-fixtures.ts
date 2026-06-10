/**
 * A4 — Resolve E2E_OPTOMETRY_PATIENT_ID / E2E_OPTOMETRY_VISIT_ID from AuthService API.
 * Run: npx tsx scripts/resolve-e2e-optometry-fixtures.ts
 *
 * Requires: API_URL, E2E_TEST_EMAIL, E2E_TEST_PASSWORD, E2E_TEST_TENANT_ID
 */
const API_URL = process.env.API_URL ?? 'http://localhost:5073';
const EMAIL = process.env.E2E_TEST_EMAIL ?? 'admin@test.com';
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'Admin123!';
const TENANT_ID = process.env.E2E_TEST_TENANT_ID ?? '155fe198-6ae5-4a01-9254-ead5b427247e';
const BRANCH_ID =
  process.env.E2E_TEST_BRANCH_ID ?? '74c014cf-9570-4824-bdf9-b369ea11a8f4';

type LoginResponse = {
  accessToken?: string;
  token?: string;
  user?: { branchId?: string };
};

type QueueRow = {
  visitId?: string;
  VisitId?: string;
  patientId?: string;
  PatientId?: string;
  patientName?: string;
  PatientName?: string;
  status?: string;
  Status?: string;
};

async function login(): Promise<{ token: string; branchId: string }> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, tenantId: TENANT_ID }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as LoginResponse;
  const token = data.accessToken ?? data.token;
  if (!token) throw new Error('No token in login response');
  const branchId = data.user?.branchId ?? BRANCH_ID;
  return { token, branchId };
}

async function seedOptometryQueue(token: string): Promise<void> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Tenant-ID': TENANT_ID,
  };
  const res = await fetch(`${API_URL}/api/Seed/optometry-queue`, { method: 'POST', headers });
  if (!res.ok) {
    console.warn('Optometry queue seed skipped:', res.status, await res.text());
  }
}

function pickQueueRow(rows: QueueRow[]): QueueRow | undefined {
  const active = rows.filter((r) => {
    const status = (r.status ?? r.Status ?? '').toLowerCase();
    return status === 'waiting' || status === 'inprogress' || status === 'in progress';
  });
  return active[0] ?? rows[0];
}

async function main() {
  const { token, branchId } = await login();
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Tenant-ID': TENANT_ID,
  };

  const queueUrl = `${API_URL}/api/visits/queue/optometrist?branchId=${branchId}&includeCompletedToday=true`;
  let queueRes = await fetch(queueUrl, { headers });
  if (!queueRes.ok) {
    console.error('Queue fetch failed:', queueRes.status, await queueRes.text());
    process.exit(1);
  }
  let rows = (await queueRes.json()) as QueueRow[];
  let first = pickQueueRow(rows);
  if (!first?.patientId && !first?.PatientId) {
    console.log('No active visits — seeding optometry queue…');
    await seedOptometryQueue(token);
    queueRes = await fetch(queueUrl, { headers });
    if (!queueRes.ok) {
      console.error('Queue fetch after seed failed:', queueRes.status, await queueRes.text());
      process.exit(1);
    }
    rows = (await queueRes.json()) as QueueRow[];
    first = pickQueueRow(rows);
  }

  const patientId = first?.patientId ?? first?.PatientId;
  const visitId = first?.visitId ?? first?.VisitId;
  if (!patientId || !visitId) {
    console.log('No optometry visits found after seed. Check-in a patient manually.');
    process.exit(0);
  }

  const patientName = first?.patientName ?? first?.PatientName ?? 'unknown';
  const githubEnv = process.argv.includes('--github-env');

  if (githubEnv) {
    console.log(`E2E_OPTOMETRY_PATIENT_ID=${patientId}`);
    console.log(`E2E_OPTOMETRY_VISIT_ID=${visitId}`);
    return;
  }

  console.log('# Optometry E2E fixtures (PowerShell)');
  console.log(`$env:E2E_OPTOMETRY_PATIENT_ID="${patientId}"`);
  console.log(`$env:E2E_OPTOMETRY_VISIT_ID="${visitId}"`);
  console.log(`# Patient: ${patientName}`);
  console.log('npm run test:e2e:optometry');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
