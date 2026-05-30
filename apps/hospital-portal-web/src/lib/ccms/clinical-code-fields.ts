/** Structured diagnosis / procedure rows synced to backend JSON strings. */

export interface DiagnosisEntry {
  icd10: string;
  description: string;
  isPrimary: boolean;
}

export interface ProcedureEntry {
  code: string;
  name: string;
}

export function emptyDiagnosis(): DiagnosisEntry {
  return { icd10: '', description: '', isPrimary: true };
}

export function emptyProcedure(): ProcedureEntry {
  return { code: '', name: '' };
}

export function parseDiagnosisJson(raw?: string | null): DiagnosisEntry[] {
  if (!raw?.trim()) return [emptyDiagnosis()];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [emptyDiagnosis()];
    return parsed.map((item, i) => {
      const row = item as Record<string, unknown>;
      return {
        icd10: String(row.icd10 ?? row.code ?? '').trim(),
        description: String(row.description ?? row.name ?? '').trim(),
        isPrimary: row.isPrimary !== false && i === 0,
      };
    });
  } catch {
    return [{ icd10: '', description: raw.trim(), isPrimary: true }];
  }
}

export function parseProceduresJson(raw?: string | null): ProcedureEntry[] {
  if (!raw?.trim()) return [emptyProcedure()];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [emptyProcedure()];
    return parsed.map(item => {
      const row = item as Record<string, unknown>;
      return {
        code: String(row.code ?? row.icd10 ?? '').trim(),
        name: String(row.name ?? row.description ?? '').trim(),
      };
    });
  } catch {
    return [{ code: '', name: raw.trim() }];
  }
}

export function serializeDiagnosisJson(entries: DiagnosisEntry[]): string | undefined {
  const rows = entries
    .filter(e => e.icd10.trim() || e.description.trim())
    .map((e, i) => ({
      icd10: e.icd10.trim(),
      description: e.description.trim() || e.icd10.trim(),
      isPrimary: e.isPrimary || (i === 0 && entries.length === 1),
    }));
  return rows.length > 0 ? JSON.stringify(rows) : undefined;
}

export function serializeProceduresJson(entries: ProcedureEntry[]): string | undefined {
  const rows = entries
    .filter(e => e.code.trim() || e.name.trim())
    .map(e => ({
      code: e.code.trim(),
      name: e.name.trim() || e.code.trim(),
    }));
  return rows.length > 0 ? JSON.stringify(rows) : undefined;
}

export function formatDiagnosisSummary(entries: DiagnosisEntry[]): string {
  const rows = entries.filter(e => e.icd10.trim() || e.description.trim());
  if (rows.length === 0) return '—';
  return rows
    .map(e => {
      const code = e.icd10.trim();
      const desc = e.description.trim();
      if (code && desc) return `${code} — ${desc}`;
      return code || desc;
    })
    .join('; ');
}

export function formatProceduresSummary(entries: ProcedureEntry[]): string {
  const rows = entries.filter(e => e.code.trim() || e.name.trim());
  if (rows.length === 0) return '—';
  return rows
    .map(e => {
      const code = e.code.trim();
      const name = e.name.trim();
      if (code && name) return `${code} — ${name}`;
      return code || name;
    })
    .join('; ');
}
