/**
 * Pure helpers for counselling session Close / dirty-leave decisions.
 * Close is navigation-only — never completes or cancels the session.
 */

export type CloseLeaveChoice = 'save_and_close' | 'leave_without_saving' | 'cancel';

export interface ResolveCloseNavigationInput {
  isDirty: boolean;
  choice?: CloseLeaveChoice;
}

export type ResolveCloseNavigationResult =
  | { action: 'navigate' }
  | { action: 'confirm' }
  | { action: 'save_then_navigate' }
  | { action: 'navigate_discard' }
  | { action: 'stay' };

/** Decide what Close should do given dirty state and optional dialog choice. */
export function resolveCloseNavigation(
  input: ResolveCloseNavigationInput,
): ResolveCloseNavigationResult {
  if (!input.isDirty) return { action: 'navigate' };
  if (!input.choice) return { action: 'confirm' };
  switch (input.choice) {
    case 'save_and_close':
      return { action: 'save_then_navigate' };
    case 'leave_without_saving':
      return { action: 'navigate_discard' };
    case 'cancel':
      return { action: 'stay' };
    default:
      return { action: 'stay' };
  }
}

/** Close must never invoke these session mutation verbs. */
export const CLOSE_FORBIDDEN_MUTATIONS = [
  'complete',
  'cancel',
  'PatientIntention',
  'ownership',
] as const;
