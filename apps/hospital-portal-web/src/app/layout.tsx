import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Telugu } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { ThemeProvider } from '@/lib/theme/ThemeProvider';
import { ReactQueryProvider } from '@/components/ReactQueryProvider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
  variable: '--font-inter',
});

const notoSansTelugu = Noto_Sans_Telugu({
  subsets: ['telugu'],
  display: 'swap',
  weight: ['400', '600'],
  variable: '--font-telugu',
});

export const metadata: Metadata = {
  title: 'Hospital Portal - Eye Hospital Management System',
  description: 'Complete Hospital Management System with Eye Care Specialization',
  keywords: 'hospital, healthcare, eye care, ophthalmology, optometry, HIPAA',
  authors: [{ name: 'Hospital Portal Team' }],
  icons: {
    icon: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0f1e3c',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${notoSansTelugu.variable}`}>
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="font-sans">
        {/* Skip link for keyboard users */}
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <ThemeProvider>
          <ReactQueryProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
