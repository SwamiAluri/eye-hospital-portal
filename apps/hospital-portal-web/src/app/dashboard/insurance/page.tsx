import { redirect } from 'next/navigation';

/**
 * Phase 3 — standalone insurance dashboard retired.
 * Bookmarks / links redirect to Coverage & Claims (CCMS).
 */
export default function InsurancePage() {
  redirect('/dashboard/ccms');
}
