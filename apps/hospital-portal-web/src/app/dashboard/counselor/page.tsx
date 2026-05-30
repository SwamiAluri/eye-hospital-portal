import { redirect } from 'next/navigation';

export default function CounselorLegacyRedirect() {
  redirect('/dashboard/counsellors-desk/waiting-list');
}
