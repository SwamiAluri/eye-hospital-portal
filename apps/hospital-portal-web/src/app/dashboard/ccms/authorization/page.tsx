import { redirect } from 'next/navigation';

// The authorization queue has been merged into the pre-auth operations desk.
export default function AuthorizationRedirectPage() {
  redirect('/dashboard/ccms/operations/preauth');
}
