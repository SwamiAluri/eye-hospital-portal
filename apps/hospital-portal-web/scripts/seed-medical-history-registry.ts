/**
 * Applies migrations/65_medical_history_registry.sql (all tenants).
 *
 *   $env:DATABASE_URL="postgresql://user:pass@host:5432/hospital"
 *   npm run seed:medical-history
 *
 * Verify registry via API (single tenant):
 *   npm run seed:medical-history -- --verify-api
 */
import { execSync } from 'child_process';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
const API_URL = (process.env.API_URL ?? 'http://localhost:5073').replace(/\/$/, '');
const TENANT_ID = process.env.TENANT_ID ?? process.env.E2E_TEST_TENANT_ID ?? '155fe198-6ae5-4a01-9254-ead5b427247e';
const EMAIL = process.env.E2E_TEST_EMAIL ?? process.env.SEED_ADMIN_EMAIL ?? 'admin@test.com';
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';

const MEDICAL_HISTORY_TYPES = [
  'medical_history.chronic_condition',
  'medical_history.medication',
  'medical_history.surgery',
  'medical_history.family_condition',
  'medical_history.immunization',
  'medical_history.medication_route',
  'medical_history.family_relationship',
  'medical_history.smoking_status',
  'medical_history.alcohol_use',
] as const;

const verifyApi = process.argv.includes('--verify-api');

async function login(): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, tenantId: TENANT_ID }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { accessToken?: string; token?: string };
  const token = data.accessToken ?? data.token;
  if (!token) throw new Error('No token in login response');
  return token;
}

async function verifyViaApi(): Promise<void> {
  const token = await login();
  const groupsRes = await fetch(`${API_URL}/api/master-values/groups`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': TENANT_ID },
  });
  if (!groupsRes.ok) throw new Error(`getGroups failed: ${groupsRes.status}`);
  const groups = (await groupsRes.json()) as Array<{ groupKey: string; entityTypes: Array<{ entityType: string }> }>;
  const clinical = groups.find((g) => g.groupKey === 'clinical');
  const clinicalTypes = new Set(clinical?.entityTypes.map((e) => e.entityType) ?? []);

  let ok = true;
  for (const entityType of MEDICAL_HISTORY_TYPES) {
    const inRegistry = clinicalTypes.has(entityType);
    console.log(`  ${entityType}: ${inRegistry ? 'OK (tab registered)' : 'MISSING from groups API'}`);
    if (!inRegistry) ok = false;
  }
  if (!ok) process.exit(1);
  console.log('\nMedical history registry verify — OK');
}

function runSql(): void {
  if (!DATABASE_URL) {
    console.error('Set DATABASE_URL to apply migration 65.');
    process.exit(1);
  }
  const sqlPath = path.resolve(__dirname, '..', '..', '..', 'migrations', '65_medical_history_registry.sql');
  console.log(`Applying ${sqlPath} …`);
  execSync(`psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${sqlPath}"`, { stdio: 'inherit' });
  console.log('Migration 65 applied.');
}

async function main(): Promise<void> {
  if (verifyApi) {
    await verifyViaApi();
    return;
  }
  runSql();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
