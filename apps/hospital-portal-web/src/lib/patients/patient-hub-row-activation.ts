/**
 * Preview opens from the row itself.
 * Enter or Space on a nested link, button, or menu stays on that control.
 */
export function shouldActivateRowPreview(event: {
  key: string;
  target: unknown;
  currentTarget: unknown;
}): boolean {
  if (event.target !== event.currentTarget) return false;
  return event.key === 'Enter' || event.key === ' ';
}
