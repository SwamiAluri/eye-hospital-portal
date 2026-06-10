import type { Metadata } from 'next';
import { AuthLayoutShell } from '@/components/auth/AuthLayoutShell';
import './auth-theme.css';

export const metadata: Metadata = {
  title: 'Login | OphthalmoCare Management System',
  description: 'Clinical sign in to the OphthalmoCare hospital management platform',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthLayoutShell>{children}</AuthLayoutShell>;
}
