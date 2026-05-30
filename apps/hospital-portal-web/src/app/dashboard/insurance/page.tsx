import { redirect } from 'next/navigation';

/**
 * The standalone insurance dashboard has been replaced by Coverage & Claims (CCMS).
 * Redirect any bookmarked or linked visits to the CCMS overview.
 */
export default function InsurancePage() {
  redirect('/dashboard/ccms');
}
