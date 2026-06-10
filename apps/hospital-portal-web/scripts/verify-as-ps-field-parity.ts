/**
 * AS/PS field parity — manifest keys must match DEFAULT_* shells and TypeScript interfaces.
 * Run: npm run test:parity:as-ps
 */
import { AS_PS_PARITY_MANIFESTS } from '../src/lib/optometry/field-parity-manifest';
import {
  DEFAULT_ANTERIOR_SEGMENT,
  DEFAULT_FUNDUS_EXAM,
  DEFAULT_PERIPHERAL_RETINA_EXAM,
  DEFAULT_POSTERIOR_SEGMENT,
  DEFAULT_PUPIL_EXAM,
  DEFAULT_VITREOUS_EXAM,
} from '../src/lib/optometry/visit-segment-defaults';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function sortedKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).sort();
}

function assertManifestMatchesDefaults(
  label: string,
  manifest: readonly string[],
  defaults: Record<string, unknown>,
): void {
  const manifestKeys = [...manifest].sort();
  const defaultKeys = sortedKeys(defaults);
  assert(
    JSON.stringify(manifestKeys) === JSON.stringify(defaultKeys),
    `${label}: manifest/defaults mismatch\n  manifest only: ${manifestKeys.filter((k) => !defaultKeys.includes(k)).join(', ') || '—'}\n  defaults only: ${defaultKeys.filter((k) => !manifestKeys.includes(k)).join(', ') || '—'}`,
  );
  console.log(`${label}: ${manifest.length} keys OK (manifest ≡ defaults)`);
}

const pairs: [string, readonly string[], Record<string, unknown>][] = [
  ['PupilExamData', AS_PS_PARITY_MANIFESTS.pupilExam, DEFAULT_PUPIL_EXAM],
  ['AnteriorSegmentExamData', AS_PS_PARITY_MANIFESTS.anteriorSegment, DEFAULT_ANTERIOR_SEGMENT],
  ['PosteriorSegmentExamData', AS_PS_PARITY_MANIFESTS.posteriorSegment, DEFAULT_POSTERIOR_SEGMENT],
  ['FundusExamData', AS_PS_PARITY_MANIFESTS.fundusExam, DEFAULT_FUNDUS_EXAM],
  ['VitreousExamData', AS_PS_PARITY_MANIFESTS.vitreousExam, DEFAULT_VITREOUS_EXAM],
  ['PeripheralRetinaExamData', AS_PS_PARITY_MANIFESTS.peripheralRetinaExam, DEFAULT_PERIPHERAL_RETINA_EXAM],
];

for (const [label, keys, defaults] of pairs) {
  assertManifestMatchesDefaults(label, keys, defaults);
}

console.log('All AS/PS field parity manifests passed.');
