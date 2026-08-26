/**
 * IOL power compare (W-07 A2). Catalog 0.50 D is a picker step only, not a match.
 * Server remains the authority; this is UX only.
 */

const TRAILING_UNIT = /\s*(D|d|diopt(?:er|re)s?)\s*$/;

export function roundIolDiopter(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseIolDiopter(raw: string | null | undefined): number | null {
  if (raw == null || !String(raw).trim()) return null;
  const stripped = String(raw).trim().replace(TRAILING_UNIT, '').replace(/\+/g, '').replace(/\s/g, '');
  const value = Number(stripped);
  if (!Number.isFinite(value)) return null;
  return roundIolDiopter(value);
}

export function iolDioptersDiffer(a: number, b: number): boolean {
  return roundIolDiopter(a) !== roundIolDiopter(b);
}

/** True when both sides parse and differ, or exactly one side has a planned power. */
export function plannedIolDiffers(a?: string | null, b?: string | null): boolean {
  const pa = parseIolDiopter(a);
  const pb = parseIolDiopter(b);
  if (pa == null && pb == null) return false;
  if (pa == null || pb == null) return true;
  return iolDioptersDiffer(pa, pb);
}

export function biometryMissingEyePhrase(eye?: string | null): string {
  const e = (eye ?? '').toUpperCase();
  if (e.includes('OS') || e.includes('LE') || e.includes('LEFT')) return 'left eye';
  if (e.includes('OU') || e.includes('BE') || e.includes('BOTH')) return 'both eyes';
  return 'right eye';
}

export function formatIolDiopter(value: number): string {
  const rounded = roundIolDiopter(value);
  const body = Math.abs(rounded).toFixed(2);
  return rounded >= 0 ? `+${body} D` : `-${body} D`;
}

export function normalizeIolModel(value: string | null | undefined): string {
  return (value ?? '').trim().split(/\s+/).filter(Boolean).join(' ');
}

export function iolModelsDiffer(planned: string | null | undefined, scanned: string | null | undefined): boolean {
  const a = normalizeIolModel(planned);
  const b = normalizeIolModel(scanned);
  if (!a || !b) return false;
  return a.toUpperCase() !== b.toUpperCase();
}

export function plannedIolModelFromCatalog(
  catalog: { productCode?: string | null; modelName: string }[],
  barcode?: string | null,
): string | null {
  const raw = (barcode ?? '').trim();
  if (!raw) return null;
  const hit = catalog.find(c =>
    (c.productCode && c.productCode.toUpperCase() === raw.toUpperCase())
    || c.modelName.toUpperCase() === raw.toUpperCase(),
  );
  return hit?.modelName ?? null;
}

export function describeIolMismatch(opts: {
  plannedPower: number | null;
  scannedPower: number | null;
  plannedModel?: string | null;
  scannedModel?: string | null;
  implanted: boolean;
}): { blocked: boolean; powerRequired: boolean; message: string | null } {
  if (!opts.implanted) return { blocked: false, powerRequired: false, message: null };

  const parts: string[] = [];
  let powerRequired = false;
  if (opts.plannedPower != null && opts.scannedPower == null) {
    powerRequired = true;
  } else if (
    opts.plannedPower != null
    && opts.scannedPower != null
    && iolDioptersDiffer(opts.plannedPower, opts.scannedPower)
  ) {
    parts.push(
      `This lens is ${formatIolDiopter(opts.scannedPower)}. The planned power is ${formatIolDiopter(opts.plannedPower)}.`,
    );
  }

  if (iolModelsDiffer(opts.plannedModel, opts.scannedModel)) {
    parts.push(
      `This lens is ${normalizeIolModel(opts.scannedModel)}. The planned model is ${normalizeIolModel(opts.plannedModel)}.`,
    );
  }

  return {
    blocked: parts.length > 0,
    powerRequired,
    message: parts.length > 0 ? parts.join(' ') : null,
  };
}
