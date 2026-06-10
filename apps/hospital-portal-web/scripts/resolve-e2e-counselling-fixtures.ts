/**
 * Resolve E2E_COUNSELLING_SESSION_ID from AuthService waiting list (optional seed).
 * Run: npx tsx scripts/resolve-e2e-counselling-fixtures.ts
 *
 * Requires: API_URL or E2E_API_URL, E2E_TEST_EMAIL, E2E_TEST_PASSWORD, E2E_TEST_TENANT_ID
 */
const API_URL = (process.env.API_URL ?? process.env.E2E_API_URL ?? 'http://localhost:5073').replace(
  /\/$/,
  '',
);
const EMAIL = process.env.E2E_TEST_EMAIL ?? 'admin@test.com';
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'Admin123!';
const TENANT_ID = process.env.E2E_TEST_TENANT_ID ?? '155fe198-6ae5-4a01-9254-ead5b427247e';

type LoginResponse = {
  accessToken?: string;
  token?: string;
};

type WaitingListRow = {
  id?: string;
  Id?: string;
  patientName?: string;
  PatientName?: string;
  status?: string;
  Status?: string;
};

async function login(): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, tenantId: TENANT_ID }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as LoginResponse;
  const token = data.accessToken ?? data.token;
  if (!token) throw new Error('No token in login response');
  return token;
}

async function seedCounselorQueue(token: string): Promise<void> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Tenant-ID': TENANT_ID,
  };
  const res = await fetch(`${API_URL}/api/SeedData/counselor-queue`, { method: 'POST', headers });
  if (!res.ok) {
    console.warn('Counselor queue seed skipped:', res.status, await res.text());
  }
}

function pickSessionRow(rows: WaitingListRow[]): WaitingListRow | undefined {
  const open = rows.filter((r) => {
    const status = (r.status ?? r.Status ?? '').toLowerCase();
    return status === 'pending' || status === 'processed';
  });
  return open[0] ?? rows[0];
}

async function fetchWaitingList(token: string): Promise<WaitingListRow[]> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-Tenant-ID': TENANT_ID,
  };
  const res = await fetch(`${API_URL}/api/Counseling/waiting-list`, { headers });
  if (!res.ok) throw new Error(`Waiting list failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data) ? (data as WaitingListRow[]) : [];
}

async function main() {
  const token = await login();
  let rows = await fetchWaitingList(token);
  let first = pickSessionRow(rows);

  if (!first?.id && !first?.Id) {
    console.log('No counselling sessions — seeding counselor queue…');
    await seedCounselorQueue(token);
    rows = await fetchWaitingList(token);
    first = pickSessionRow(rows);
  }

  const sessionId = first?.id ?? first?.Id;
  if (!sessionId) {
    console.log('No counselling sessions found. Seed manually: POST /api/SeedData/counselor-queue');
    process.exit(0);
  }

  const patientName = first?.patientName ?? first?.PatientName ?? 'unknown';
  const githubEnv = process.argv.includes('--github-env');

  if (githubEnv) {
    console.log(`E2E_COUNSELLING_SESSION_ID=${sessionId}`);
    return;
  }

  console.log('# Counselling E2E fixtures (PowerShell)');
  console.log(`$env:E2E_COUNSELLING_SESSION_ID="${sessionId}"`);
  console.log(`# Patient: ${patientName}`);
  console.log('npm run test:e2e:counselling');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
