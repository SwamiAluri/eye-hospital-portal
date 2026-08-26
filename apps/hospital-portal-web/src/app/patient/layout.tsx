'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Calendar,
  FileText,
  TestTube,
  MessageSquare,
  CreditCard,
  User,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  Heart,
  Phone,
  Mail,
  Clock,
  Shield,
  HelpCircle,
  Building2,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/patient/dashboard', icon: Home },
  { name: 'My Appointments', href: '/patient/appointments', icon: Calendar },
  { name: 'Prescriptions', href: '/patient/prescriptions', icon: FileText },
  { name: 'Test Results', href: '/patient/results', icon: TestTube },
  { name: 'Messages', href: '/patient/messages', icon: MessageSquare },
  { name: 'Payments', href: '/patient/payments', icon: CreditCard },
  { name: 'My Profile', href: '/patient/profile', icon: User },
];

interface PatientInfo {
  id: string;
  name: string;
  mrn: string;
  email: string;
  phone: string;
}

const patient: PatientInfo = {
  id: 'PAT-001',
  name: 'Rajesh Kumar',
  mrn: 'MRN-2024-001',
  email: 'rajesh.kumar@email.com',
  phone: '+91 98765 43210',
};

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const isAuthPage =
    pathname === '/patient/login' ||
    pathname === '/patient/register' ||
    pathname === '/patient/forgot-password';

  if (isAuthPage) return <>{children}</>;

  const handleLogout = () => {
    router.push('/patient/login');
  };

  const NavItems = ({ onItemClick }: { onItemClick?: () => void }) => (
    <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
      {navigation.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onItemClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-emerald-500/15 text-emerald-400 border-l-2 border-emerald-400 pl-[10px] font-medium'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <item.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-emerald-400' : 'text-white/40'}`} />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );

  const SidebarContent = ({ onItemClick }: { onItemClick?: () => void }) => (
    <div className="flex flex-col h-full w-60 bg-navy-900">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary-500">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">Hospital Portal</p>
          <p className="text-xs leading-tight text-primary-300">Patient Portal</p>
        </div>
      </div>

      <NavItems onItemClick={onItemClick} />

      <div className="mx-3 mb-2 p-3 rounded-lg border border-white/10" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
        <h4 className="text-xs font-semibold text-white mb-1.5">Need Help?</h4>
        <div className="space-y-1.5">
          <a href="tel:+911234567890" className="flex items-center gap-2 text-xs transition-colors text-primary-300">
            <Phone className="h-3 w-3 flex-shrink-0" />
            +91 1234 567 890
          </a>
          <a href="mailto:support@hospital.com" className="flex items-center gap-2 text-xs transition-colors text-primary-300">
            <Mail className="h-3 w-3 flex-shrink-0" />
            support@hospital.com
          </a>
        </div>
      </div>

      <div className="mx-3 mb-3 p-3 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-white mb-1.5">
          <Clock className="h-3 w-3" />
          Hospital Hours
        </h4>
        <div className="text-xs space-y-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <p>Mon - Sat: 8:00 AM - 8:00 PM</p>
          <p>Sunday: 9:00 AM - 2:00 PM</p>
          <p className="text-red-400 font-medium">Emergency: 24/7</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100 p-3 gap-3 overflow-hidden">
      <div className="hidden lg:flex flex-shrink-0 rounded-2xl overflow-hidden shadow-md">
        <SidebarContent />
      </div>

      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex">
            <div className="rounded-r-2xl overflow-hidden shadow-xl">
              <SidebarContent onItemClick={() => setIsMobileOpen(false)} />
            </div>
            <button
              className="ml-2 mt-3 h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center text-white"
              onClick={() => setIsMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-0 gap-3">
        <div className="rounded-2xl overflow-hidden shadow-md flex-shrink-0 bg-navy-900">
          <div className="flex items-center justify-between h-14 px-4">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                onClick={() => setIsMobileOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 hidden lg:block text-primary-500" />
                <span className="text-white font-semibold text-sm">Patient Portal</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="tel:+911234567890"
                className="hidden md:flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
              >
                <Phone className="h-3.5 w-3.5" />
                Emergency: 1234-567-890
              </a>

              <button className="relative p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <Bell className="h-5 w-5" />
                <span className="absolute top-0.5 right-0.5 h-4 w-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full">3</span>
              </button>

              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold text-white bg-primary-500">
                    {patient.name.split(' ').map(function(n) { return n[0]; }).join('')}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-white text-xs font-medium leading-tight">{patient.name}</p>
                    <p className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.45)' }}>{patient.mrn}</p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 hidden sm:block" style={{ color: 'rgba(255,255,255,0.45)' }} />
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">{patient.name}</p>
                      <p className="text-xs text-gray-500">{patient.email}</p>
                    </div>
                    <Link href="/patient/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setIsProfileOpen(false)}>
                      <User className="h-4 w-4 text-gray-400" /> My Profile
                    </Link>
                    <Link href="/patient/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setIsProfileOpen(false)}>
                      <Shield className="h-4 w-4 text-gray-400" /> Privacy Settings
                    </Link>
                    <Link href="/patient/help" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setIsProfileOpen(false)}>
                      <HelpCircle className="h-4 w-4 text-gray-400" /> Help and Support
                    </Link>
                    <div className="border-t border-gray-100 mt-1">
                      <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full">
                        <LogOut className="h-4 w-4" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <main
          id="main-content"
          className="flex-1 min-h-0 overflow-auto rounded-2xl bg-white shadow-sm"
          role="main"
          aria-label="Patient portal main content"
        >
          <div className="p-4">{children}</div>
        </main>
      </div>
    </div>
  );
}