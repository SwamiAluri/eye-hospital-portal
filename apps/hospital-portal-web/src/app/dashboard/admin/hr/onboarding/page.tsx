import { redirect } from 'next/navigation';

export default function HrOnboardingRedirectPage() {
  redirect('/dashboard/admin/onboarding');
}
