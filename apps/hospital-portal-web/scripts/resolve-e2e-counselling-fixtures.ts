/**
 * Resolve counselling E2E fixtures from AuthService waiting list (optional seed).
 * Run: npx tsx scripts/resolve-e2e-counselling-fixtures.ts
 *
 * Emits:
 * - E2E_COUNSELLING_SESSION_ID — non-terminal (Pending | Processed) for editable workflow tests
 * - E2E_COUNSELLING_DONE_SESSION_ID — terminal Done (optional) for read-only / Finish tests
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

/** Editable workflow — Waiting List → Quote → Decision → Notes → Finish. */
const EDITABLE_STATUSES = new Set(['pending', 'processed']);

/** Terminal / Finish / read-only coverage (optional separate env). */
const DONE_STATUSES = new Set(['done', 'completed']);

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

function rowStatus(row: WaitingListRow): string {
  return (row.status ?? row.Status ?? '').trim().toLowerCase();
}

function rowId(row: WaitingListRow): string | undefined {
  return row.id ?? row.Id;
}

function rowName(row: WaitingListRow): string {
  return row.patientName ?? row.PatientName ?? 'unknown';
}

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

function pickEditableRow(rows: WaitingListRow[]): WaitingListRow | undefined {
  return rows.find((r) => EDITABLE_STATUSES.has(rowStatus(r)));
}

function pickDoneRow(rows: WaitingListRow[]): WaitingListRow | undefined {
  return rows.find((r) => DONE_STATUSES.has(rowStatus(r)));
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
  let editable = pickEditableRow(rows);

  if (!editable) {
    console.log('No Pending/Processed counselling sessions — seeding counselor queue…');
    await seedCounselorQueue(token);
    rows = await fetchWaitingList(token);
    editable = pickEditableRow(rows);
  }

  const editableId = editable ? rowId(editable) : undefined;
  if (!editableId) {
    console.error(
      'No non-terminal (Pending|Processed) counselling session found after seed. ' +
        'Do not fall back to Done/Completed — editable E2E requires an open session.',
    );
    process.exit(1);
  }

  const done = pickDoneRow(rows);
  const doneId = done ? rowId(done) : undefined;
  const githubEnv = process.argv.includes('--github-env');

  if (githubEnv) {
    console.log(`E2E_COUNSELLING_SESSION_ID=${editableId}`);
    if (doneId) console.log(`E2E_COUNSELLING_DONE_SESSION_ID=${doneId}`);
    return;
  }

  console.log('# Counselling E2E fixtures (PowerShell)');
  console.log(`$env:E2E_COUNSELLING_SESSION_ID="${editableId}"`);
  console.log(`# Editable: ${rowName(editable!)} status=${editable!.status ?? editable!.Status}`);
  if (doneId) {
    console.log(`$env:E2E_COUNSELLING_DONE_SESSION_ID="${doneId}"`);
    console.log(`# Terminal Done: ${rowName(done!)} status=${done!.status ?? done!.Status}`);
  } else {
    console.log('# E2E_COUNSELLING_DONE_SESSION_ID not set (no Done row on waiting list)');
  }
  console.log('npm run test:e2e:counselling');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
