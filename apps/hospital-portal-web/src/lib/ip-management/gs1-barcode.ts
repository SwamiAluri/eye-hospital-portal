/**
 * GS1-128 / DataMatrix parse for IOL UDI (W-07 A1).
 * Server remains the authority; this fills the scan panel immediately.
 */

const GS = '\u001d';

export const GS1_UNREADABLE_MESSAGE =
  'This barcode could not be read. Enter the serial from the pack. Do not guess the power.';

export type Gs1ParseResult = {
  parsed: boolean;
  unreadable: boolean;
  isGs1: boolean;
  gtin: string | null;
  serial: string | null;
  lot: string | null;
  expiry: string | null;
  symbology: string;
};

const EMPTY: Gs1ParseResult = {
  parsed: false,
  unreadable: false,
  isGs1: false,
  gtin: null,
  serial: null,
  lot: null,
  expiry: null,
  symbology: 'raw',
};

export function isManualIolSerial(raw: string | null | undefined): boolean {
  const s = (raw ?? '').trim();
  if (s.length < 5) return false;
  if (looksLikeGs1(s, s, 'raw')) return false;
  return /^[A-Za-z0-9\-_]+$/.test(s);
}

export function parseGs1Barcode(raw: string | null | undefined): Gs1ParseResult {
  if (raw == null || !String(raw).trim()) {
    return { ...EMPTY, unreadable: true };
  }
  const original = String(raw).trim();
  const stripped = stripSymbology(original.replace(/\s/g, ''));
  const looks = looksLikeGs1(original, stripped.payload, stripped.symbology);
  const parsed = stripped.payload.includes('(')
    ? parseParenthesized(stripped.payload, stripped.symbology)
    : parseElementString(stripped.payload, stripped.symbology);
  if (parsed?.parsed) return parsed;
  if (looks) {
    return {
      ...EMPTY,
      isGs1: true,
      unreadable: true,
      symbology: stripped.symbology === 'raw' ? 'gs1' : stripped.symbology,
    };
  }
  return { ...EMPTY, symbology: 'raw' };
}

export function formatGs1Expiry(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function stripSymbology(value: string): { payload: string; symbology: string } {
  const upper = value.slice(0, 3);
  if (upper.toUpperCase() === ']C1') return { payload: value.slice(3), symbology: 'gs1-128' };
  if (upper === ']d2' || upper === ']D2' || upper === ']e0' || upper === ']E0') {
    return { payload: value.slice(3), symbology: 'gs1-datamatrix' };
  }
  if (upper.toUpperCase() === ']Q3') return { payload: value.slice(3), symbology: 'gs1-qr' };
  return { payload: value, symbology: 'raw' };
}

function looksLikeGs1(original: string, payload: string, symbology: string): boolean {
  if (symbology !== 'raw') return true;
  if (original.includes(GS) || payload.includes(GS)) return true;
  if (/\((01|21|17|10)\)/.test(payload)) return true;
  return payload.startsWith('01') && payload.length >= 3;
}

function parseParenthesized(payload: string, symbology: string): Gs1ParseResult | null {
  const fields: Record<string, string> = {};
  const re = /\((\d{2,4})\)([^(]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(payload))) {
    if (m[1] && m[2]) fields[m[1]] = m[2];
  }
  return fromFields(fields, symbology === 'raw' ? 'gs1' : symbology);
}

function parseElementString(payload: string, symbology: string): Gs1ParseResult | null {
  const fields: Record<string, string> = {};
  const s = payload.replaceAll(GS, '\n');
  let i = 0;
  while (i < s.length) {
    if (s[i] === '\n') { i += 1; continue; }
    if (i + 2 > s.length) break;
    const ai = s.slice(i, i + 2);
    if (ai === '01' && isDigits(s, i + 2, 14)) {
      fields['01'] = s.slice(i + 2, i + 16);
      i += 16;
      continue;
    }
    if (ai === '17' && isDigits(s, i + 2, 6)) {
      fields['17'] = s.slice(i + 2, i + 8);
      i += 8;
      continue;
    }
    if (ai === '10' || ai === '21') {
      const start = i + 2;
      const end = findVariableEnd(s, start);
      if (end === start) { i = start; continue; }
      fields[ai] = s.slice(start, end);
      i = end;
      continue;
    }
    break;
  }
  return fromFields(fields, symbology === 'raw' && Object.keys(fields).length ? 'gs1' : symbology);
}

function findVariableEnd(s: string, start: number): number {
  const nl = s.indexOf('\n', start);
  if (nl >= 0) return nl;
  for (let j = start; j < s.length; j++) {
    const ai = s.slice(j, j + 2);
    if (ai === '01' && isDigits(s, j + 2, 14)) return j;
    if (ai === '17' && isDigits(s, j + 2, 6)) return j;
    if ((ai === '10' || ai === '21') && j - start >= 4) return j;
  }
  return s.length;
}

function isDigits(s: string, start: number, count: number): boolean {
  if (start + count > s.length) return false;
  for (let i = 0; i < count; i++) {
    const c = s.charCodeAt(start + i);
    if (c < 48 || c > 57) return false;
  }
  return true;
}

function fromFields(fields: Record<string, string>, symbology: string): Gs1ParseResult | null {
  const gtin = fields['01'] || null;
  const serial = fields['21'] || null;
  const lot = fields['10'] || null;
  const expiry = parseExpiry(fields['17']);
  if (!gtin && !serial) return null;
  return {
    parsed: true,
    unreadable: false,
    isGs1: true,
    gtin,
    serial,
    lot,
    expiry,
    symbology: symbology === 'raw' ? 'gs1' : symbology,
  };
}

function parseExpiry(yymmdd?: string): string | null {
  if (!yymmdd || yymmdd.length !== 6 || !/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  let dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12) return null;
  const year = 2000 + yy;
  const last = new Date(year, mm, 0).getDate();
  if (dd === 0) dd = last;
  if (dd > last) return null;
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}
