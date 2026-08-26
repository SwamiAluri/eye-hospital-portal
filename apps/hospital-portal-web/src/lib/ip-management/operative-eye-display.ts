import { normalizeOperativeEye } from './preop-laterality';

export const LATERALITY_MISSING_BLOCKER = 'Operating eye must be recorded before theatre';

export type OperativeEyeCode = 'OD' | 'OS' | 'OU';

export type OperativeEyeDisplay =
  | { kind: 'missing'; message: typeof LATERALITY_MISSING_BLOCKER }
  | { kind: 'eye'; code: OperativeEyeCode; word: 'RIGHT' | 'LEFT' | 'BOTH' };

const WORD: Record<OperativeEyeCode, 'RIGHT' | 'LEFT' | 'BOTH'> = {
  OD: 'RIGHT',
  OS: 'LEFT',
  OU: 'BOTH',
};

/**
 * Census / rail laterality. Colour is never the only cue: the word RIGHT/LEFT/BOTH
 * is spelled out above OD/OS/OU. A null or unrecognised empty value is a blocker,
 * never an empty slot.
 */
export function operativeEyeDisplay(value: string | null | undefined): OperativeEyeDisplay {
  const code = normalizeOperativeEye(value);
  if (code === 'OD' || code === 'OS' || code === 'OU') {
    return { kind: 'eye', code, word: WORD[code] };
  }
  return { kind: 'missing', message: LATERALITY_MISSING_BLOCKER };
}
