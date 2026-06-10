/**
 * F2.3 — One-shot seed for existing tenants:
 *   appointment.status
 *   counsellor.patient_intention
 *   insurance.accommodation_class
 *
 * SQL mode (all tenants — recommended):
 *   Applies migrations/64_f23_master_entity_types.sql (registry + values, idempotent).
 *   $env:DATABASE_URL="postgresql://user:pass@localhost:5432/hospital"
 *   npm run seed:f23-master
 *
 * API mode (single tenant — after migration 64 + AuthService with F2.3 seeds):
 *   Calls POST /api/master-values/seed-defaults (inserts only entity types with zero rows).
 *   $env:API_URL="http://localhost:5073"
 *   $env:E2E_TEST_TENANT_ID="<tenant-uuid>"
 *   npm run seed:f23-master -- --api
 *
 * Verify only:
 *   npm run seed:f23-master -- --api --dry-run
 */
import { execSync } from 'child_process';
import path from 'path';
import { F23_ENTITY_TYPES, F23_EXPECTED_COUNTS } from './data/f23-master-seeds';

const API_URL = (process.env.API_URL ?? 'http://localhost:5073').replace(/\/$/, '');
const DATABASE_URL = process.env.DATABASE_URL;
const TENANT_ID = process.env.TENANT_ID ?? process.env.E2E_TEST_TENANT_ID ?? '155fe198-6ae5-4a01-9254-ead5b427247e';
const EMAIL = process.env.E2E_TEST_EMAIL ?? process.env.SEED_ADMIN_EMAIL ?? 'admin@test.com';
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';

const useApi = process.argv.includes('--api');
const dryRun = process.argv.includes('--dry-run');

type LoginResponse = { accessToken?: string; token?: string };

type LookupResponse = {
  items?: Array<{ code?: string; label?: string }>;
  Items?: Array<{ code?: string; label?: string }>;
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

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'X-Tenant-ID': TENANT_ID,
    'Content-Type': 'application/json',
  };
}

async function lookupCount(token: string, entityType: string): Promise<number> {
  const res = await fetch(`${API_URL}/api/master-values/lookup/${encodeURIComponent(entityType)}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(`Lookup ${entityType} failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as LookupResponse;
  const items = json.items ?? json.Items ?? [];
  return items.length;
}

async function verifyTenant(token: string, label: string): Promise<boolean> {
  console.log(`\n${label} (tenant ${TENANT_ID})`);
  let ok = true;
  for (const entityType of F23_ENTITY_TYPES) {
    const count = await lookupCount(token, entityType);
    const expected = F23_EXPECTED_COUNTS[entityType];
    const status = count >= expected ? 'OK' : count > 0 ? 'PARTIAL' : 'MISSING';
    console.log(`  ${entityType}: ${count}/${expected} — ${status}`);
    if (count < expected) ok = false;
  }
  return ok;
}

async function runApiMode(): Promise<void> {
  console.log(`API mode — tenant ${TENANT_ID}`);
  const token = await login();

  const beforeOk = await verifyTenant(token, 'Before seed');

  if (dryRun) {
    console.log('\nDry run — no writes.');
    process.exit(beforeOk ? 0 : 1);
  }

  if (beforeOk) {
    console.log('\nAll F2.3 entity types already seeded for this tenant.');
    process.exit(0);
  }

  const seedRes = await fetch(`${API_URL}/api/master-values/seed-defaults`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!seedRes.ok) {
    console.error('seed-defaults failed:', seedRes.status, await seedRes.text());
    process.exit(1);
  }
  console.log('\nseed-defaults: OK');

  const afterOk = await verifyTenant(token, 'After seed-defaults');
  if (!afterOk) {
    console.error(
      '\nF2.3 types still missing. Run SQL mode (registry + exact codes):\n' +
        '  $env:DATABASE_URL="postgresql://..."\n' +
        '  npm run seed:f23-master\n' +
        'Ensure AuthService is rebuilt if using seed-defaults alone.',
    );
    process.exit(1);
  }
  console.log('\nF2.3 master seed complete (API / current tenant).');
}

function runSqlMode(): void {
  if (!DATABASE_URL) {
    console.error('Set DATABASE_URL for SQL mode, or pass --api for single-tenant API seed.');
    process.exit(1);
  }

  const sqlPath = path.resolve(__dirname, '..', '..', '..', 'migrations', '64_f23_master_entity_types.sql');

  console.log('SQL mode — seeding F2.3 entity types for all active tenants…');
  console.log(`Migration: ${sqlPath}`);

  execSync(`psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${sqlPath}"`, {
    stdio: 'inherit',
    env: process.env,
  });

  console.log('\nF2.3 master seed complete (all tenants).');
  console.log('Verify: npm run seed:f23-master -- --api --dry-run');
}

async function main(): Promise<void> {
  if (useApi) {
    await runApiMode();
  } else {
    runSqlMode();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
