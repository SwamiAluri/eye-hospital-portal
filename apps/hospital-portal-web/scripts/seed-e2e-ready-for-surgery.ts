/**
 * Completes mark-ready hard gates on one Admitted journey and transitions it
 * to ReadyForSurgery so `E2E_WARD_FULL_FLOWS=1` Playwright tests can run.
 *
 * Usage: npm run seed:e2e:ward-ready
 */
const authApiBase = (process.env.E2E_API_URL ?? 'http://localhost:5073/api').replace(/\/$/, '');
const ipApiBase = (
  process.env.E2E_IP_MANAGEMENT_API_URL
  ?? process.env.NEXT_PUBLIC_IP_MANAGEMENT_API_URL
  ?? 'http://localhost:5074/api'
).replace(/\/$/, '');
const tenantId = process.env.E2E_TEST_TENANT_ID ?? '155fe198-6ae5-4a01-9254-ead5b427247e';
const branchId = process.env.E2E_TEST_BRANCH_ID ?? '74c014cf-9570-4824-bdf9-b369ea11a8f4';
const email = process.env.E2E_TEST_EMAIL ?? 'admin@test.com';
const password = process.env.E2E_TEST_PASSWORD ?? 'Admin123!';

const MIN_PDF = Buffer.from('%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF', 'utf8').toString('base64');

type JourneyRow = {
  id: string;
  patientName: string | null;
  clinicalState: string;
  eyeOperated?: string | null;
  paymentMode?: string | null;
};

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'X-Tenant-ID': tenantId,
    'Content-Type': 'application/json',
  };
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function normalizeEye(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim().toUpperCase();
  if (!raw) return null;
  if (raw === 'OD' || raw === 'OS' || raw === 'OU') return raw;
  if (raw === 'RE' || raw.includes('RIGHT')) return 'OD';
  if (raw === 'LE' || raw.includes('LEFT')) return 'OS';
  if (raw === 'BOTH' || raw.includes('BILAT')) return 'OU';
  return raw;
}

async function main() {
  const loginRes = await fetch(`${authApiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, tenantId }),
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status}`);
  }
  const login = (await loginRes.json()) as { accessToken: string };
  const h = headers(login.accessToken);

  const listRes = await fetch(`${ipApiBase}/ip-management/journeys?branchId=${branchId}`, { headers: h });
  if (!listRes.ok) throw new Error(`List journeys failed: ${listRes.status}`);
  const journeys = (await listRes.json()) as JourneyRow[];
  const ready = journeys.find(j => j.clinicalState === 'ReadyForSurgery');
  if (ready) {
    console.log(`ReadyForSurgery already present: ${ready.patientName} (${ready.id})`);
    return;
  }

  const admittedPool = journeys.filter(j => j.clinicalState === 'Admitted');
  if (admittedPool.length === 0) {
    throw new Error('No Admitted journey to promote. Admit a cash Expected patient first.');
  }
  const preferred = admittedPool.filter(j => !j.id.startsWith('11111111'));
  const candidates = (preferred.length > 0 ? preferred : admittedPool).slice().reverse();

  const errors: string[] = [];
  for (const target of candidates) {
    try {
      await promoteAdmitted(h, target);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${target.patientName}: ${msg}`);
      console.warn(`  skip ${target.patientName}: ${msg}`);
    }
  }
  throw new Error(`Could not promote any Admitted journey.\n${errors.join('\n')}`);
}

async function promoteAdmitted(h: Record<string, string>, target: JourneyRow) {
  console.log(`Seeding ReadyForSurgery from Admitted ${target.patientName} (${target.id})`);

  const detailRes = await fetch(`${ipApiBase}/ip-management/journeys/${target.id}`, { headers: h });
  const detail = (await readJson(detailRes)) as {
    eyeOperated?: string | null;
    paymentMode?: string | null;
    error?: string;
  };
  if (!detailRes.ok) throw new Error(`Get journey failed: ${JSON.stringify(detail)}`);
  const eye = normalizeEye(detail.eyeOperated) ?? 'OD';

  await fetch(`${ipApiBase}/ip-management/journeys/${target.id}/pre-op/clearance/init`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ paymentModeSnapshot: detail.paymentMode ?? 'Cash' }),
  });

  const checklistRes = await fetch(
    `${ipApiBase}/ip-management/journeys/${target.id}/ward-investigation-checklist`,
    { headers: h },
  );
  const checklist = (await readJson(checklistRes)) as {
    items?: Array<{ itemId: string; itemKey: string; isCritical?: boolean; entryStatus?: string }>;
    unverifiedCriticalKeys?: string[];
  };
  const critical = (checklist.items ?? []).filter(i => i.isCritical || (checklist.unverifiedCriticalKeys ?? []).includes(i.itemKey));
  for (const item of critical) {
    if (item.entryStatus === 'verified') continue;
    const save = await fetch(
      `${ipApiBase}/ip-management/journeys/${target.id}/ward-investigation-checklist/completions/${item.itemId}/result`,
      {
        method: 'PUT',
        headers: h,
        body: JSON.stringify({ resultValue: '12', resultSource: 'manual_ward' }),
      },
    );
    if (!save.ok) {
      console.warn(`  lab save skipped ${item.itemKey}: ${save.status} ${JSON.stringify(await readJson(save))}`);
      continue;
    }
    const verify = await fetch(
      `${ipApiBase}/ip-management/journeys/${target.id}/ward-investigation-checklist/completions/${item.itemId}/verify`,
      { method: 'POST', headers: h, body: '{}' },
    );
    if (!verify.ok) {
      console.warn(`  lab verify skipped ${item.itemKey}: ${verify.status} ${JSON.stringify(await readJson(verify))}`);
    } else {
      console.log(`  verified ${item.itemKey}`);
    }
  }

  const clearanceRes = await fetch(`${ipApiBase}/ip-management/journeys/${target.id}/pre-op/clearance`, { headers: h });
  const clearance = (await readJson(clearanceRes)) as {
    completions?: Array<{ itemId: string; itemKey: string; isCompleted?: boolean; isBypassed?: boolean }>;
  };
  const completions = clearance.completions ?? [];
  const keys = completions.map(c => c.itemKey).join(',') || '(none)';
  const consent = completions.find(c => {
    const k = (c.itemKey ?? '').toLowerCase();
    return k.includes('consent') && (k.includes('sign') || k.includes('surgical') || k.includes('surgery'));
  }) ?? completions.find(c => (c.itemKey ?? '').toLowerCase().includes('consent'));
  const site = completions.find(c => {
    const k = (c.itemKey ?? '').toLowerCase();
    return k.includes('site_marked') || k.includes('laterality') || k.includes('surgery_site');
  });

  if (!consent || !site) {
    console.warn(`  clearance catalog has no consent/laterality rows (${keys}); completing remaining items then mark-ready`);
    for (const row of completions.filter(c => !c.isCompleted && !c.isBypassed)) {
      const save = await fetch(
        `${ipApiBase}/ip-management/journeys/${target.id}/pre-op/completions/${row.itemId}`,
        {
          method: 'POST',
          headers: h,
          body: JSON.stringify({
            itemId: row.itemId,
            isCompleted: true,
            isBypassed: false,
            notes: 'E2E seed',
            resultValue: eye,
          }),
        },
      );
      if (!save.ok) {
        console.warn(`  completion skipped ${row.itemKey}: ${save.status}`);
      }
    }
  } else {

  const uploadRes = await fetch(`${ipApiBase}/ip-management/journeys/${target.id}/pre-op/documents`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      documentType: 'ConsentForm',
      fileName: 'e2e-consent.pdf',
      contentType: 'application/pdf',
      fileData: MIN_PDF,
    }),
  });
  const uploaded = (await readJson(uploadRes)) as { id?: string; error?: string };
  if (!uploadRes.ok || !uploaded.id) {
    throw new Error(`Consent document upload failed: ${uploadRes.status} ${JSON.stringify(uploaded)}`);
  }

  const captureRes = await fetch(
    `${ipApiBase}/ip-management/journeys/${target.id}/pre-op/consent/${consent.itemId}/capture`,
    {
      method: 'POST',
      headers: h,
      body: JSON.stringify({
        patientSigned: true,
        witnessName: 'E2E Witness',
        witnessRelation: 'Spouse',
        method: 'Upload',
        documentId: uploaded.id,
        notes: 'E2E seed',
      }),
    },
  );
  if (!captureRes.ok) {
    throw new Error(`Consent capture failed: ${captureRes.status} ${JSON.stringify(await readJson(captureRes))}`);
  }

  const siteRes = await fetch(
    `${ipApiBase}/ip-management/journeys/${target.id}/pre-op/completions/${site.itemId}`,
    {
      method: 'POST',
      headers: h,
      body: JSON.stringify({
        itemId: site.itemId,
        isCompleted: true,
        isBypassed: false,
        notes: 'E2E marked by ward nurse',
        resultValue: eye,
      }),
    },
  );
  if (!siteRes.ok) {
    throw new Error(`Laterality save failed: ${siteRes.status} ${JSON.stringify(await readJson(siteRes))}`);
  }
  }

  const pacSave = await fetch(`${ipApiBase}/ip-management/journeys/${target.id}/pac-assessment`, {
    method: 'PUT',
    headers: h,
    body: JSON.stringify({
      bp: '120/80',
      hr: 72,
      physicalStatusAsa: 2,
      anaesthesiaPlan: 'Local',
      consentType: 'Written',
      airwayExam: { mallampati: 2, mouthOpening: 'Normal' },
      systemicReview: { cvs: 'NAD', respiratory: 'NAD' },
    }),
  });
  if (!pacSave.ok) {
    throw new Error(`PAC save failed: ${pacSave.status} ${JSON.stringify(await readJson(pacSave))}`);
  }
  const pacComplete = await fetch(`${ipApiBase}/ip-management/journeys/${target.id}/pac-assessment/complete`, {
    method: 'POST',
    headers: h,
  });
  if (!pacComplete.ok) {
    throw new Error(`PAC complete failed: ${pacComplete.status} ${JSON.stringify(await readJson(pacComplete))}`);
  }

  const transition = await fetch(
    `${ipApiBase}/ip-management/journeys/${target.id}/clinical-transition`,
    {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ newState: 'ReadyForSurgery', acknowledgeWarnings: true }),
    },
  );
  const after = (await readJson(transition)) as { clinicalState?: string; error?: string; transitionWarnings?: unknown };
  if (!transition.ok || after.clinicalState !== 'ReadyForSurgery') {
    throw new Error(`Mark ready failed: ${transition.status} ${JSON.stringify(after)}`);
  }
  console.log(`ReadyForSurgery: ${target.patientName} (${target.id})`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
