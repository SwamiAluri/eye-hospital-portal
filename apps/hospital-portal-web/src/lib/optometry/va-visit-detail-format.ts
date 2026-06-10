export interface VaVisitDetailSection {
  heading: string;
  lines: string[];
}

function formatRxEye(
  rx: Record<string, Record<string, unknown>> | undefined,
  eye: 'OD' | 'OS',
): string | null {
  const eyeData = rx?.[eye];
  if (!eyeData) return null;
  const s = eyeData.sphere ?? '—';
  const c = eyeData.cylinder ?? '—';
  const a = eyeData.axis ?? '—';
  const va = eyeData.va ?? eyeData.visualAcuity;
  const base = `${s}/${c}×${a}`;
  return va ? `${base} · VA ${va}` : base;
}

function formatVaEye(
  dist: Record<string, { unaided?: string; aided?: string }> | undefined,
  eye: 'OD' | 'OS',
): string | null {
  const eyeData = dist?.[eye];
  if (!eyeData) return null;
  const parts = [eyeData.unaided, eyeData.aided].filter(Boolean);
  if (!parts.length) return null;
  return parts.join(' → ');
}

function pushEyeLines(
  lines: string[],
  label: string,
  od: string | null,
  os: string | null,
): void {
  if (!od && !os) return;
  if (od) lines.push(`${label} OD: ${od}`);
  if (os) lines.push(`${label} OS: ${os}`);
}

/** Human-readable VA / Rx blocks for a prior visit history record. */
export function formatVaVisitDetail(raw: Record<string, unknown>): VaVisitDetailSection[] {
  const sections: VaVisitDetailSection[] = [];

  const distance = (raw.distanceVA ?? raw.distance) as
    | Record<string, { unaided?: string; aided?: string }>
    | undefined;
  const near = raw.near as Record<string, { unaided?: string; aided?: string }> | undefined;

  const vaLines: string[] = [];
  pushEyeLines(vaLines, 'Distance', formatVaEye(distance, 'OD'), formatVaEye(distance, 'OS'));
  pushEyeLines(vaLines, 'Near', formatVaEye(near, 'OD'), formatVaEye(near, 'OS'));
  if (vaLines.length) sections.push({ heading: 'Visual acuity', lines: vaLines });

  const finalRx = raw.finalRx as Record<string, Record<string, unknown>> | undefined;
  const startingRx = raw.startingRx as Record<string, Record<string, unknown>> | undefined;
  const rxSource = finalRx ?? startingRx;
  const rxLines: string[] = [];
  const odRx = formatRxEye(rxSource, 'OD');
  const osRx = formatRxEye(rxSource, 'OS');
  if (odRx) rxLines.push(`OD: ${odRx}`);
  if (osRx) rxLines.push(`OS: ${osRx}`);
  if (rxLines.length) {
    sections.push({
      heading: finalRx ? 'Final Rx' : 'Rx',
      lines: rxLines,
    });
  }

  const k = raw.keratometry as Record<string, Record<string, unknown>> | undefined;
  if (k?.OD || k?.OS) {
    const kLines: string[] = [];
    (['OD', 'OS'] as const).forEach((eye) => {
      const e = k[eye];
      if (!e) return;
      const k1 = e.k1 ?? e.K1;
      const k2 = e.k2 ?? e.K2;
      if (k1 || k2) kLines.push(`${eye}: K1 ${k1 ?? '—'} · K2 ${k2 ?? '—'}`);
    });
    if (kLines.length) sections.push({ heading: 'Keratometry', lines: kLines });
  }

  const cv = raw.colorVision as Record<string, unknown> | undefined;
  if (cv && (cv.testType || cv.result)) {
    sections.push({
      heading: 'Color vision',
      lines: [
        `Test: ${cv.testType ?? '—'}`,
        `Result: ${cv.result ?? '—'}`,
        ...(cv.platesMissed ? [`Plates missed: ${cv.platesMissed}`] : []),
      ],
    });
  }

  const cs = raw.contrastSensitivity as Record<string, unknown> | undefined;
  if (cs) {
    const csLines = [`Test: ${cs.testType ?? '—'}`];
    const od = cs.OD as { logCS?: number; score?: string } | undefined;
    const os = cs.OS as { logCS?: number; score?: string } | undefined;
    if (od?.logCS != null || od?.score) csLines.push(`OD: ${od.score ?? od.logCS}`);
    if (os?.logCS != null || os?.score) csLines.push(`OS: ${os.score ?? os.logCS}`);
    if (csLines.length > 1) sections.push({ heading: 'Contrast sensitivity', lines: csLines });
  }

  if (sections.length === 0) {
    const notes = raw.notes ?? raw.clinicalNotes;
    if (notes) {
      sections.push({ heading: 'Notes', lines: [String(notes)] });
    } else {
      sections.push({ heading: 'Visit', lines: ['No structured VA/Rx data for this visit.'] });
    }
  }

  return sections;
}

export const VA_SECTION_LOCK_TOOLTIP = 'Locked after visit day.';
