/**
 * B9 — CI gate: flag new hardcoded option arrays outside allowlisted modules.
 * Run: npm run test:parity:hardcoded-options
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const SRC_ROOT = join(__dirname, '..', 'src');
const TEXT_EXT = new Set(['.ts', '.tsx']);

/** Paths (substring match) allowed to define *_OPTIONS arrays until migrated to master. */
const ALLOWLIST_SUBSTRINGS = [
  'lib/optometry/',
  'lib/medical-history/',
  'lib/examination/exam-rx-options.ts',
  'lib/counsellors-desk/investigation-catalog',
  'lib/master-data/integration-manifest.ts',
  'lib/billing/payment-mode-maps.ts',
  'lib/billing/payment-coverage-maps.ts',
  'lib/counsellors-desk/session-utils.ts',
  'components/widgets/PaymentModeSelectionWidget.tsx',
  'components/counsellors-desk/AddPatientModal.tsx',
  'components/examination/AdvicePatientEducationTab.tsx',
  'components/widgets/SurgerySchedulingWidget.tsx',
  'components/widgets/LabTestIntegrationWidget.tsx',
  'app/admin/inventory/expiry/page.tsx',
  'app/dashboard/ccms/operations/preauth/page.tsx',
];

const OPTION_ARRAY_PATTERN =
  /(?:export\s+)?const\s+([A-Z][A-Z0-9_]*OPTIONS)\s*=\s*\[/g;

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
      collectSourceFiles(full, out);
    } else if (TEXT_EXT.has(name.slice(name.lastIndexOf('.')))) {
      out.push(full);
    }
  }
  return out;
}

function isAllowlisted(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  return ALLOWLIST_SUBSTRINGS.some((s) => normalized.includes(s));
}

/** Known baseline violations (B6/B7/B8 debt). Gate fails only when new entries appear. */
const BASELINE_VIOLATIONS = new Set<string>([]);

const violations = new Set<string>();

for (const file of collectSourceFiles(SRC_ROOT)) {
  const rel = relative(join(__dirname, '..'), file);
  if (isAllowlisted(rel)) continue;

  const content = readFileSync(file, 'utf8');
  let match: RegExpExecArray | null;
  OPTION_ARRAY_PATTERN.lastIndex = 0;
  while ((match = OPTION_ARRAY_PATTERN.exec(content)) !== null) {
    violations.add(`${rel.replace(/\\/g, '/')} — ${match[1]}`);
  }
}

const newViolations = [...violations].filter((v) => !BASELINE_VIOLATIONS.has(v));

assert(
  newViolations.length === 0,
  `New hardcoded *_OPTIONS arrays detected (use useMasterValues or extend baseline after migration):\n  ${newViolations.join('\n  ')}`,
);

console.log(
  `Hardcoded options gate passed (${violations.size} total, ${BASELINE_VIOLATIONS.size} baselined, ${newViolations.length} new).`,
);
