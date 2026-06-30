/** Mydriatic / cycloplegic drugs used to detect dilatation doses in the med log. */
const DILATATION_KEYWORDS = [
  'tropicamide',
  'cyclopentolate',
  'phenylephrine',
  'homatropine',
  'mydriacyl',
  'atropine',
  'mydriatic',
  'cyclopleg',
  'dilat',
] as const;

export function isDilatationMedicine(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const hay = name.toLowerCase();
  return DILATATION_KEYWORDS.some(k => hay.includes(k));
}

export const WARD_DILATATION_ITEM_KEY = 'ward_dilatation_done';
