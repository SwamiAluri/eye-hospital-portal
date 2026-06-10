/**
 * sanitize-names.ts
 *
 * Fixes mojibake characters that appear when UTF-8 strings (containing em-dashes,
 * smart quotes, etc.) are stored/retrieved as Latin-1.
 *
 * Use this on any variant or catalog name before rendering it in the UI.
 */

const MOJIBAKE_MAP: [string, string][] = [
  ['â€"', '—'],   // em dash
  ['â€“', '–'],   // en dash
  ['â€™', '\u2019'], // right single quotation mark
  ['â€œ', '\u201C'], // left double quotation mark
  ['â€\u009D', '\u201D'], // right double quotation mark (byte 0x9D)
  ['â€', '"'],    // fallback for truncated right double quote
  ['Â\u00A0', ' '],  // non-breaking space rendered as "Â "
  ['Ã©', 'é'],
  ['Ã ', 'à'],
  ['Ã¨', 'è'],
];

/** Strip empty quote pairs and collapse extra whitespace from bad catalog data. */
function stripEmptyQuotes(name: string): string {
  return name
    .replace(/""/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .trim();
}

export function sanitizeVariantName(name: string): string {
  let result = name;
  for (const [bad, good] of MOJIBAKE_MAP) {
    result = result.split(bad).join(good);
  }
  return stripEmptyQuotes(result);
}
