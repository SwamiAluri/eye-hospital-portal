'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCachedAuthStore } from '@/lib/permission-cache';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarDays,
  Stethoscope,
  UserCircle,
  Pill,
  TestTube,
  Bell,
  FileText,
  Star,
  ArrowRightLeft,
  Ambulance,
  ChevronDown,
  ChevronRight,
  Settings,
  Shield,
  Building,
  Building2,
  Briefcase,
  UserCheck,
  FileCheck,
  Smartphone,
  Key,
  AlertTriangle,
  ClipboardList,
  DollarSign,
  TrendingUp,
  GraduationCap,
  BarChart,
  FolderOpen,
  Upload,
  Activity,
  LogOut,
  LogIn,
  Menu,
  Eye,
  Glasses,
  Zap,
  Target,
  Layers,
  Droplet,
  Palette,
  Grid,
  Circle,
  ShoppingCart,
  Contact,
  Brain,
  Truck,
  Package,
  Thermometer,
  Wrench,
  Tent,
  CreditCard,
  Receipt,
  Camera,
  Video,
  Waves,
  UserPlus,
  Monitor,
  Siren,
  PhoneCall,
  RotateCcw,
  Database,
} from 'lucide-react';

interface MenuItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  requiredPermission: string | null;
  isSection?: boolean;
  isParent?: boolean;
  isChild?: boolean;
  isExpandable?: boolean;
  exact?: boolean;
  badge?: React.ReactNode;
  subItems?: MenuItem[];
}

interface MenuSection {
  title: string;
  icon: React.ReactNode;
  items: MenuItem[];
}

interface SidebarProps {
  isMobileOpen?: boolean;
  onClose?: () => void;
  drawerOnly?: boolean;
}

export default function Sidebar({ isMobileOpen = false, onClose, drawerOnly = false }: SidebarProps) {
  const { roles, hasPermission, logout } = useCachedAuthStore();
  const pathname = usePathname();
  const [openSection, setOpenSection] = useState<string | null>('Dashboard');
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [expandedSubsections, setExpandedSubsections] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [collapsedPopover, setCollapsedPopover] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
  };

  const toggleSection = (sectionTitle: string) => {
    setOpenSection(prev => prev === sectionTitle ? null : sectionTitle);
  };

  const toggleSubmenu = (label: string) => {
    setExpandedItems(prev => 
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const toggleSubsection = (label: string) => {
    setExpandedSubsections(prev => 
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  // 18-Section Role/Department-Based Navigation Structure
  const menuSections: MenuSection[] = [

    // ── 1. DASHBOARD ──────────────────────────────────────────────────────────
    {
      title: 'Dashboard',
      icon: <LayoutDashboard className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Overview',
          href: '/dashboard',
          icon: <LayoutDashboard className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
          exact: true,
        },
      ],
    },

    // ── 2. OPD & REGISTRATION ─────────────────────────────────────────────────
    {
      title: 'OPD & Registration',
      icon: <Contact className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Front Office / OPD',
          href: '/dashboard/frontdesk',
          icon: <Contact className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
        {
          label: 'Queue Management',
          href: '/dashboard/frontdesk/queue',
          icon: <ClipboardList className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'queue_management.view',
        },
        {
          label: 'Appointments',
          href: '/dashboard/appointments',
          icon: <Calendar className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'appointment.view',
        },
        {
          label: 'Patient Portal',
          href: '/dashboard/patient-portal',
          icon: <Smartphone className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'patient_portal.view',
        },
        {
          label: 'Eye Camps',
          href: '/dashboard/operations/eye-camps',
          icon: <Tent className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:EYECAMP:VIEW',
        },
      ],
    },

    // ── 3. DOCTOR'S DESK ──────────────────────────────────────────────────────
    {
      title: "Doctor's Desk",
      icon: <Stethoscope className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Patient Directory',
          href: '/dashboard/patients',
          icon: <Users className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'patient.view',
        },
        {
          label: "Doctor's Desk",
          href: '/dashboard/doctors-desk',
          icon: <Stethoscope className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'CLINICAL:EXAMINATION:VIEW',
        },
        {
          label: 'Junior Doctor',
          href: '/dashboard/examinations',
          icon: <UserCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'clinical_examination.view',
        },
        {
          label: 'Advanced Services',
          href: '/dashboard/telemedicine',
          icon: <Star className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
      ],
    },

    // ── 4. OPTOMETRY ──────────────────────────────────────────────────────────
    {
      title: 'Optometry',
      icon: <Eye className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Optometrist Examination',
          href: '/dashboard/optometrist',
          icon: <Eye className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'CLINICAL:EXAMINATION:VIEW',
        },
      ],
    },

    // ── 5. COUNSELLOR ─────────────────────────────────────────────────────────
    {
      title: 'Counsellor',
      icon: <Brain className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Counselor',
          href: '/dashboard/counselor',
          icon: <UserCircle className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
        {
          label: 'Counsellor Waiting List',
          href: '/dashboard/counsellors-desk/waiting-list',
          icon: <ClipboardList className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
        {
          label: 'Finalize Surgery',
          href: '/dashboard/counsellors-desk/finalize-surgery',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
        {
          label: 'Follow-up Center',
          href: '/dashboard/counsellors-desk/surgery-followup',
          icon: <PhoneCall className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
      ],
    },

    // ── CCMS – COVERAGE & CLAIMS MANAGEMENT ──────────────────────────────────
    {
      title: 'Coverage & Claims',
      icon: <FileCheck className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'CCMS Dashboard',
          href: '/dashboard/ccms',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
        {
          label: 'Cases',
          href: '/dashboard/ccms/cases',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
        {
          label: 'Authorization Queue',
          href: '/dashboard/ccms/authorization',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
        {
          label: 'Claims',
          href: '/dashboard/ccms/claims',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
        {
          label: 'Settlements',
          href: '/dashboard/ccms/settlement',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
        {
          label: 'Payers / TPA',
          href: '/dashboard/ccms/master-data/payers',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
      ],
    },

    // ── 6. WARD & INPATIENT ───────────────────────────────────────────────────
    {
      title: 'Ward & Inpatient',
      icon: <Tent className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Ward',
          href: '/dashboard/ip-management/ward',
          icon: <Tent className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
        {
          label: 'IP Management',
          href: '/dashboard/ip-management',
          icon: <CreditCard className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
          exact: true,
        },
        {
          label: 'Operation Theatre',
          href: '/dashboard/ip-management/operation-theatre',
          icon: <Activity className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
        {
          label: 'IPD Management',
          href: '/dashboard/operations/ot/schedule',
          icon: <Building2 className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:OT:VIEW',
        },
        {
          label: 'Bed Management',
          href: '/dashboard/operations/stores',
          icon: <Layers className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Discharge Management',
          href: '/dashboard/emergency',
          icon: <LogOut className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'emergency.view',
        },
      ],
    },

    // ── 7. DIAGNOSTICS & LAB ──────────────────────────────────────────────────
    {
      title: 'Diagnostics & Lab',
      icon: <TestTube className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Scan / Imaging',
          href: '/dashboard/diagnostic/fundus-imaging',
          icon: <Camera className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'DIAGNOSTIC:IMAGING:VIEW',
        },
        {
          label: 'Diagnostics Lab',
          href: '/dashboard/diagnostic/biometry',
          icon: <TestTube className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'DIAGNOSTIC:BIOMETRY:VIEW',
        },
        {
          label: 'Laboratory (Pathology)',
          href: '/dashboard/laboratory',
          icon: <Thermometer className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'laboratory.view',
        },
        {
          label: 'Blood Bank',
          href: '/dashboard/operations/ambulance',
          icon: <Droplet className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:AMBULANCE:VIEW',
        },
      ],
    },

    // ── 8. PHARMACY ───────────────────────────────────────────────────────────
    {
      title: 'Pharmacy',
      icon: <Pill className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Pharmacy',
          href: '/dashboard/pharmacy',
          icon: <Pill className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'pharmacy.view',
        },
        {
          label: 'Pharmacy Bills',
          href: '/admin/inventory/pharmacy',
          icon: <Receipt className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'pharmacy.view',
        },
      ],
    },

    // ── 9. OPTICAL SHOP ───────────────────────────────────────────────────────
    {
      title: 'Optical Shop',
      icon: <Glasses className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Optical Shop',
          href: '/dashboard/optical',
          icon: <Glasses className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPTICAL:VIEW',
        },
      ],
    },

    // ── 10. INVENTORY ─────────────────────────────────────────────────────────
    {
      title: 'Inventory',
      icon: <Package className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Dashboard',
          href: '/admin/inventory',
          icon: <LayoutDashboard className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
          exact: true,
        },
        {
          label: 'Items',
          href: '/admin/inventory/items',
          icon: <Grid className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Stores',
          href: '/admin/inventory/stores',
          icon: <Building className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Stock',
          href: '/admin/inventory/stock',
          icon: <Layers className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Transfers',
          href: '/admin/inventory/transfers',
          icon: <ArrowRightLeft className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Requisitions',
          href: '/admin/inventory/requisitions',
          icon: <ClipboardList className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Auto-Reorder',
          href: '/admin/inventory/reorder',
          icon: <Bell className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Expiry Alerts',
          href: '/admin/inventory/expiry',
          icon: <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Surgery OT',
          href: '/admin/inventory/surgery',
          icon: <Activity className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Asset Management',
          href: '/dashboard/operations/biomedical',
          icon: <Wrench className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:BIOMEDICAL:VIEW',
        },
      ],
    },

    // ── 11. PROCUREMENT ───────────────────────────────────────────────────────
    {
      title: 'Procurement',
      icon: <Truck className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Vendors',
          href: '/admin/inventory/vendors',
          icon: <Truck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'GRN',
          href: '/admin/inventory/grn',
          icon: <Package className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Purchase Orders',
          href: '/admin/inventory/po',
          icon: <ShoppingCart className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'RFQ',
          href: '/admin/inventory/rfq',
          icon: <FileText className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Purchase Query',
          href: '/admin/inventory/purchase-query',
          icon: <ClipboardList className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Vendor Payments',
          href: '/admin/inventory/vendor-payments',
          icon: <CreditCard className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Purchase Returns',
          href: '/admin/inventory/returns',
          icon: <RotateCcw className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Procurement Policy',
          href: '/admin/inventory/procurement/policies',
          icon: <Shield className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'Vendor Performance',
          href: '/admin/inventory/vendor-performance',
          icon: <TrendingUp className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
        {
          label: 'GST Reports',
          href: '/admin/inventory/reports',
          icon: <BarChart className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:STORES:VIEW',
        },
      ],
    },

    // ── 12. FINANCE & BILLING ─────────────────────────────────────────────────
    {
      title: 'Finance & Billing',
      icon: <DollarSign className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Billing & Finance',
          href: '/dashboard/billing/opd',
          icon: <DollarSign className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
        {
          label: 'Insurance Management',
          href: '/dashboard/finance?tab=insurance',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'FINANCE:INSURANCE:VIEW',
        },
        {
          label: 'Revenue Cycle',
          href: '/dashboard/finance?tab=reports',
          icon: <TrendingUp className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'FINANCE:REPORTS:VIEW',
        },
      ],
    },

    // ── 13. HR & STAFF ────────────────────────────────────────────────────────
    {
      title: 'HR & Staff',
      icon: <Briefcase className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Staff Scheduling',
          href: '/dashboard/admin/hr',
          icon: <CalendarDays className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'employee.view',
        },
        {
          label: 'Onboarding',
          href: '/dashboard/admin/hr/onboarding',
          icon: <UserPlus className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'employee.view',
        },
        {
          label: 'Licenses',
          href: '/dashboard/admin/licenses',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'license.view',
        },
        {
          label: 'Performance',
          href: '/dashboard/admin/performance',
          icon: <TrendingUp className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'employee.view',
        },
        {
          label: 'Training',
          href: '/dashboard/admin/training',
          icon: <GraduationCap className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'employee.view',
        },
        {
          label: 'Attendance',
          href: '/dashboard/admin/attendance',
          icon: <ClipboardList className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'employee.view',
        },
        {
          label: 'Leave Management',
          href: '/dashboard/admin/leave',
          icon: <Calendar className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'employee.view',
        },
        {
          label: 'Payroll',
          href: '/dashboard/admin/payroll',
          icon: <DollarSign className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'employee.view',
        },
      ],
    },

    // ── 14. REPORTS & ANALYTICS ───────────────────────────────────────────────
    {
      title: 'Reports & Analytics',
      icon: <BarChart className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Advanced Reports',
          href: '/dashboard/reports',
          icon: <FileText className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
        {
          label: 'Analytics & BI',
          href: '/dashboard/analytics',
          icon: <BarChart className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
        {
          label: 'Medical Records',
          href: '/dashboard/documents',
          icon: <FolderOpen className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'document.view',
        },
      ],
    },

    // ── 15. COMPLIANCE & QUALITY ──────────────────────────────────────────────
    {
      title: 'Compliance & Quality',
      icon: <Shield className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Consent Management',
          href: '/dashboard/quality',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'quality.view',
        },
        {
          label: 'NABH Management',
          href: '/dashboard/quality',
          icon: <Star className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'quality.view',
        },
        {
          label: 'HIPAA Management',
          href: '/dashboard/admin/compliance',
          icon: <Shield className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'audit.view',
        },
        {
          label: 'Feedback & Surveys',
          href: '/dashboard/quality',
          icon: <Monitor className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'quality.view',
        },
      ],
    },

    // ── 16. COMMUNICATION & SUPPORT ───────────────────────────────────────────
    {
      title: 'Communication & Support',
      icon: <Bell className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Helpdesk & Support',
          href: '/dashboard/referrals',
          icon: <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'referral.view',
        },
        {
          label: 'Communication',
          href: '/dashboard/notifications',
          icon: <Bell className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'notification.view',
        },
        {
          label: 'Housekeeping',
          href: '/dashboard/operations/cssd',
          icon: <Building className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'OPERATIONS:CSSD:VIEW',
        },
      ],
    },

    // ── 17. MASTER DATA ───────────────────────────────────────────────────────
    {
      title: 'Master Data',
      icon: <Database className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Patient Setup',
          href: '/dashboard/master-data/patient_setup',
          icon: <Users className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Clinical',
          href: '/dashboard/master-data/clinical',
          icon: <Stethoscope className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Appointments',
          href: '/dashboard/master-data/appointments',
          icon: <Calendar className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Counsellor',
          href: '/dashboard/master-data/counsellor',
          icon: <Brain className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Billing & Finance',
          href: '/dashboard/master-data/billing_finance',
          icon: <DollarSign className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Insurance',
          href: '/dashboard/master-data/insurance',
          icon: <Shield className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Inventory',
          href: '/dashboard/master-data/inventory',
          icon: <Package className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Pharmacy',
          href: '/dashboard/master-data/pharmacy',
          icon: <Pill className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Lab & Diagnostics',
          href: '/dashboard/master-data/lab_diagnostics',
          icon: <TestTube className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'Ward & IP',
          href: '/dashboard/master-data/ward_ip',
          icon: <Tent className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'HR & Staff',
          href: '/dashboard/master-data/hr_staff',
          icon: <Briefcase className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'master_data.view',
        },
        {
          label: 'System',
          href: '/dashboard/master-data/system',
          icon: <Settings className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'master_data.view',
        },
      ],
    },

    // ── 18. ADMINISTRATION ────────────────────────────────────────────────────
    {
      title: 'Administration',
      icon: <Settings className="h-5 w-5" strokeWidth={2.5} />,
      items: [
        {
          label: 'Overview',
          href: '/dashboard/admin/overview',
          icon: <LayoutDashboard className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
        },
        // — Organization —
        {
          label: 'Organization',
          href: '#',
          icon: <Building2 className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
          isSection: true,
        },
        {
          label: 'Hierarchy Viewer',
          href: '/dashboard/admin/hierarchy',
          icon: <Activity className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'organization.view',
        },
        {
          label: 'Tenants',
          href: '/dashboard/admin/tenants',
          icon: <Building className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'tenant.view',
        },
        {
          label: 'Organizations',
          href: '/dashboard/organizations',
          icon: <Building2 className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'organization.view',
        },
        {
          label: 'Branches',
          href: '/dashboard/admin/branches',
          icon: <Building className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'branch.view',
        },
        {
          label: 'Departments',
          href: '/dashboard/departments',
          icon: <Briefcase className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'department.view',
        },
        // — People —
        {
          label: 'People',
          href: '#',
          icon: <Users className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
          isSection: true,
        },
        {
          label: 'Users & Employees',
          href: '/dashboard/admin/users',
          icon: <Users className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'user.view',
        },
        {
          label: 'Bulk Operations',
          href: '/dashboard/bulk-operations',
          icon: <Upload className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'bulk.import',
        },
        // — Access Control —
        {
          label: 'Access Control',
          href: '#',
          icon: <Key className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
          isSection: true,
        },
        {
          label: 'Roles & Permissions',
          href: '/dashboard/roles',
          icon: <Shield className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'role.view',
        },
        {
          label: 'Department Access',
          href: '/dashboard/admin/department-access',
          icon: <Key className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'department.view',
        },
        {
          label: 'Access Requests',
          href: '/dashboard/admin/access-requests',
          icon: <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'permission.view',
        },
        // — Security & Compliance —
        {
          label: 'Security & Compliance',
          href: '#',
          icon: <Shield className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: null,
          isSection: true,
        },
        {
          label: 'Security Dashboard',
          href: '/dashboard/admin/security',
          icon: <Shield className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'session.view',
        },
        {
          label: 'IT Security',
          href: '/dashboard/admin/security',
          icon: <Key className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'session.view',
        },
        {
          label: 'Audit Logs',
          href: '/dashboard/audit-logs',
          icon: <Activity className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'audit.view',
        },
        {
          label: 'Compliance Reports',
          href: '/dashboard/admin/compliance',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'audit.view',
        },
        {
          label: 'System Settings',
          href: '/dashboard/system-settings',
          icon: <Settings className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'system_settings.view',
        },
      ],
    },
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (href === '/dashboard' || exact) {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  // Auto-open the correct section and expand submenu whenever the pathname changes.
  // This prevents the sidebar from collapsing when navigating between sub-pages.
  useEffect(() => {
    for (const section of menuSections) {
      for (const item of section.items) {
        // Skip non-navigable section dividers
        if (item.href === '#') continue;

        if (item.isExpandable && item.subItems) {
          const hasActiveChild = item.subItems.some((sub) =>
            isActive(sub.href, sub.exact)
          );
          if (hasActiveChild) {
            setOpenSection(section.title);
            setExpandedItems((prev) =>
              prev.includes(item.label) ? prev : [...prev, item.label]
            );
            return;
          }
        }

        if (isActive(item.href, item.exact)) {
          setOpenSection(section.title);
          return;
        }
      }
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    {/* Desktop sidebar — hidden below lg (1024px) */}
    {!drawerOnly && (
    <nav className={`hidden lg:flex ${isCollapsed ? 'lg:w-16' : 'lg:w-60'} flex-col h-full font-sans transition-all duration-300 overflow-hidden`} style={{backgroundColor:'#0f1e3c'}} aria-label="Main navigation">
      {/* Header */}
      <div className={`${isCollapsed ? 'p-3' : 'px-4 py-4'} border-b flex-shrink-0`} style={{borderColor:'rgba(255,255,255,0.1)'}}>
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor:'#10b981'}}>
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-md transition-colors"
              style={{color:'rgba(255,255,255,0.5)'}}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor='rgba(255,255,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor='transparent')}
              title="Expand sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor:'#10b981'}}>
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="font-semibold text-sm text-white truncate">Hospital Portal</h1>
                <p className="text-xs truncate" style={{color:'rgba(255,255,255,0.45)'}}>Healthcare Excellence</p>
              </div>
            </div>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-md transition-colors flex-shrink-0"
              style={{color:'rgba(255,255,255,0.5)'}}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor='rgba(255,255,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor='transparent')}
              title="Collapse sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-3 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {menuSections.map((section) => {
          // Filter items based on permissions
          const visibleItems = section.items.filter(item => 
            !item.requiredPermission || hasPermission(item.requiredPermission)
          );

          // Don't show section if no items are visible
          if (visibleItems.length === 0) return null;

          const isOpen = openSection === section.title;
          const showSectionPopover = isCollapsed && collapsedPopover === section.title;

          return (
            <div key={section.title} className="mb-1 relative">
              {/* Section Header */}
              <button
                onClick={() => {
                  if (isCollapsed) {
                    setCollapsedPopover(showSectionPopover ? null : section.title);
                  } else {
                    toggleSection(section.title);
                  }
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 transition-colors group"
                style={{color: isOpen ? 'white' : 'rgba(255,255,255,0.65)'}}
                onMouseEnter={e => { if(!isOpen) e.currentTarget.style.backgroundColor='rgba(255,255,255,0.07)'; }}
                onMouseLeave={e => { if(!isOpen) e.currentTarget.style.backgroundColor='transparent'; }}
                title={isCollapsed ? section.title : ''}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'gap-2.5'}`}>
                  <span className="flex-shrink-0">
                    {section.icon}
                  </span>
                  {!isCollapsed && <span className="text-xs font-semibold uppercase tracking-wider">{section.title}</span>}
                </div>
                {!isCollapsed && (
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 flex-shrink-0 ${
                    isOpen ? 'rotate-180' : ''
                  }`} style={{color:'rgba(255,255,255,0.4)'}} />
                )}
              </button>

              {/* Collapsed Section Popover */}
              {showSectionPopover && (
                <div className="absolute left-full top-0 ml-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[240px] max-h-[600px] overflow-y-auto z-50">
                  <div className="px-4 py-2 text-sm font-semibold text-gray-800 border-b border-gray-100 sticky top-0 bg-white">
                    {section.title}
                  </div>
                  {(() => {
                    let currentSubsection: string | null = null;
                    return visibleItems.map((item, index) => {
                      // Handle subsection headers
                      if (item.isSection) {
                        currentSubsection = item.label;
                        return (
                          <div key={`section-${item.label}`} className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-3 first:mt-2">
                            {item.label}
                          </div>
                        );
                      }
                      
                      const active = isActive(item.href);
                      
                      // Handle expandable items with sub-items (e.g., HR Management)
                      if (item.isExpandable && item.subItems) {
                        return (
                          <div key={item.label}>
                            <div className="px-4 py-2 text-xs font-semibold text-gray-600 mt-2 flex items-center gap-2">
                              {item.icon}
                              <span>{item.label}</span>
                            </div>
                            {item.subItems.map((subItem) => {
                              const subActive = isActive(subItem.href, subItem.exact);
                              return (
                                <Link
                                  key={subItem.href}
                                  href={subItem.href}
                                  prefetch={false}
                                  onClick={() => setCollapsedPopover(null)}
                                  className={`
                                    flex items-center gap-3 px-6 py-2 transition-all duration-150
                                    ${subActive
                                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500'
                                      : 'text-gray-700 hover:bg-primary-50/60 hover:text-primary-700'
                                    }
                                  `}
                                >
                                  <span className={`text-xs ${subActive ? 'text-teal-600' : 'text-gray-600'}`}>
                                    {subItem.icon}
                                  </span>
                                  <span className="text-sm">{subItem.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        );
                      }
                      
                      // Regular item
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch={false}
                          onClick={() => setCollapsedPopover(null)}
                          className={`
                            flex items-center gap-3 px-4 py-2 transition-all duration-150
                            ${active
                              ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500'
                              : 'text-gray-700 hover:bg-primary-50/60 hover:text-primary-700'
                            }
                          `}
                        >
                          <span className={`${active ? 'text-teal-600' : 'text-gray-600'}`}>
                            {item.icon}
                          </span>
                          <span className="text-sm">{item.label}</span>
                        </Link>
                      );
                    });
                  })()}
                </div>
              )}

              {/* Section Items */}
              {isOpen && !isCollapsed && (
                <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  // Render subsection header
                  if (item.isSection) {
                    const isSubsectionExpanded = expandedSubsections.includes(item.label);
                    if (isCollapsed) return null; // Don't show subsection headers when collapsed
                    return (
                      <div key={item.label} className="ml-4 mr-2">
                        <button
                          onClick={() => toggleSubsection(item.label)}
                          className="w-full flex items-center justify-between px-3 py-2 mt-2 mb-0.5 transition-colors group"
                          style={{color:'rgba(255,255,255,0.4)'}}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider">{item.label}</span>
                          </div>
                          <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${
                            isSubsectionExpanded ? 'rotate-90' : ''
                          }`} />
                        </button>
                      </div>
                    );
                  }

                  // Check if item is under a subsection
                  const itemIndex = visibleItems.indexOf(item);
                  const previousItems = visibleItems.slice(0, itemIndex);
                  const lastSubsection = previousItems.reverse().find(i => i.isSection);
                  
                  // If there's a subsection before this item and it's not expanded, don't show the item
                  if (lastSubsection && !expandedSubsections.includes(lastSubsection.label)) {
                    return null;
                  }

                  const active = isActive(item.href);
                  
                  // Determine if this is a subsection item (comes after a section header)
                  const isSubsectionItem = !!lastSubsection;
                  
                  const baseClass = item.isChild 
                    ? "pl-12 pr-4 py-2.5" 
                    : isSubsectionItem
                    ? "pl-6 pr-4 py-2.5"
                    : "pl-4 pr-4 py-2.5";
                  
                  // Render expandable menu item with submenu
                  if (item.isExpandable && item.subItems) {
                    const isExpanded = expandedItems.includes(item.label);
                    if (isCollapsed) {
                      // Show only icon with popover for sub-items when collapsed
                      const showPopover = collapsedPopover === item.label;
                      return (
                        <div key={item.label} className="mx-2 relative">
                          <button
                            onClick={() => setCollapsedPopover(showPopover ? null : item.label)}
                            className={`
                              w-full flex items-center justify-center py-2.5 rounded-md transition-all duration-150
                              ${active
                                ? 'text-primary-400'
                                : 'hover:text-white'
                              }
                            `}
                          style={{color: active ? '#34d399' : 'rgba(255,255,255,0.55)', backgroundColor: active ? 'rgba(16,185,129,0.15)' : undefined}}
                            title={item.label}
                          >
                            <span className={`font-bold ${active ? 'text-teal-600' : 'text-gray-600'}`}>
                              {item.icon}
                            </span>
                          </button>
                          {showPopover && item.subItems && (
                            <div className="absolute left-full top-0 ml-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[200px] z-50">
                              <div className="px-4 py-2 text-sm font-bold text-gray-700 border-b border-gray-100">
                                {item.label}
                              </div>
                              {item.subItems.map((subItem) => {
                                const subActive = isActive(subItem.href, subItem.exact);
                                return (
                                  <Link
                                    key={subItem.href}
                                    href={subItem.href}
                                    prefetch={false}
                                    onClick={() => setCollapsedPopover(null)}
                                    className={`
                                      flex items-center gap-3 px-4 py-2.5 transition-all duration-150
                                      ${subActive
                                        ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500'
                                        : 'text-gray-700 hover:bg-primary-50/60 hover:text-primary-700'
                                      }
                                    `}
                                  >
                                    <span className={`font-bold ${subActive ? 'text-teal-600' : 'text-gray-600'}`}>
                                      {subItem.icon}
                                    </span>
                                    <span className="font-bold text-sm">{subItem.label}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div key={item.label} className="mx-2">
                        <button
                          onClick={() => toggleSubmenu(item.label)}
                          className={`
                            w-full flex items-center justify-between ${baseClass} rounded-md transition-all duration-150
                            ${active
                              ? 'text-white'
                              : ''
                            }
                          `}
                      style={{color: active ? 'white' : 'rgba(255,255,255,0.7)', backgroundColor: active ? 'rgba(16,185,129,0.15)' : undefined}}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`font-bold ${active ? 'text-teal-600' : 'text-gray-600'}`}>
                              {item.icon}
                            </span>
                            <span className="font-bold text-sm">{item.label}</span>
                          </div>
                          <ChevronRight className={`h-3.5 w-3.5 text-gray-500 transition-transform duration-200 ${
                            isExpanded ? 'rotate-90' : ''
                          }`} />
                        </button>
                        {isExpanded && item.subItems.map((subItem) => {
                          const subActive = isActive(subItem.href, subItem.exact);
                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              prefetch={false}
                              className={`
                                flex items-center gap-3 pl-12 pr-4 py-2.5 rounded-md transition-all duration-150
                                ${subActive
                                  ? 'text-white'
                                  : ''
                                }
                              `}
                              style={{color: subActive ? 'white' : 'rgba(255,255,255,0.6)', backgroundColor: subActive ? 'rgba(16,185,129,0.15)' : undefined}}
                            >
                              <span className={`font-bold ${subActive ? 'text-teal-600' : 'text-gray-600'}`}>
                                {subItem.icon}
                              </span>
                              <span className="font-bold text-sm">{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    );
                  }

                  // Render menu item
                  if (isCollapsed) {
                    // Show only icon with tooltip when collapsed
                    return (
                      <div key={item.href} className="mx-2" title={item.label}>
                        <Link
                          href={item.href}
                          prefetch={false}
                          className={`
                            flex items-center justify-center py-2.5 rounded-md transition-all duration-150
                          `}
                          style={{color: active ? '#34d399' : 'rgba(255,255,255,0.55)', backgroundColor: active ? 'rgba(16,185,129,0.15)' : undefined}}
                        >
                          {item.icon}
                        </Link>
                      </div>
                    );
                  }
                  return (
                    <div key={item.href} className="mx-2">
                      <Link
                        href={item.href}
                        prefetch={false}
                        className={`
                          flex items-center gap-3 ${baseClass} rounded-md transition-all duration-150
                          ${active ? 'border-l-2 border-primary-400' : ''}
                        `}
                        style={{color: active ? 'white' : 'rgba(255,255,255,0.7)', backgroundColor: active ? 'rgba(16,185,129,0.15)' : undefined}}
                        onMouseEnter={e => { if(!active) e.currentTarget.style.backgroundColor='rgba(255,255,255,0.07)'; }}
                        onMouseLeave={e => { if(!active) e.currentTarget.style.backgroundColor='transparent'; }}
                      >
                        <span className="flex-shrink-0">
                          {item.icon}
                        </span>
                        <span className="text-sm flex-1 truncate">{item.label}</span>
                        {item.badge}
                      </Link>
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 flex-shrink-0" style={{borderTop:'1px solid rgba(255,255,255,0.1)'}}>
        <Link
          href="/dashboard/settings"
          prefetch={false}
          className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-md transition-colors mb-1`}
          style={{color:'rgba(255,255,255,0.55)'}}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor='rgba(255,255,255,0.08)'; e.currentTarget.style.color='white'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor='transparent'; e.currentTarget.style.color='rgba(255,255,255,0.55)'; }}
          title={isCollapsed ? "Settings" : ""}
        >
          <Settings className="h-4 w-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm">Settings</span>}
        </Link>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-md transition-colors`}
          style={{color:'rgba(239,68,68,0.75)'}}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor='rgba(239,68,68,0.12)'; e.currentTarget.style.color='#ef4444'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor='transparent'; e.currentTarget.style.color='rgba(239,68,68,0.75)'; }}
          title={isCollapsed ? "Logout" : ""}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!isCollapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </nav>
    )}

    {/* Mobile / tablet slide-in drawer — visible only when isMobileOpen=true, on screens < lg */}
    {isMobileOpen && (
      <>
        {/* Backdrop overlay */}
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
        {/* Drawer panel */}
        <nav
          className="fixed inset-y-0 left-0 z-50 w-64 shadow-2xl flex flex-col h-full font-sans overflow-y-auto lg:hidden"
          style={{backgroundColor:'#0f1e3c'}}
          aria-label="Mobile navigation"
        >
          {/* Drawer header */}
          <div className="px-4 py-4 flex items-center justify-between flex-shrink-0" style={{borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor:'#10b981'}}>
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-sm text-white">Hospital Portal</h1>
                <p className="text-xs" style={{color:'rgba(255,255,255,0.45)'}}>Healthcare Excellence</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md transition-colors"
              style={{color:'rgba(255,255,255,0.5)'}}
              aria-label="Close menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>

          {/* Drawer nav items — same structure as desktop, never collapsed */}
          <div className="flex-1 overflow-y-auto py-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {menuSections.map((section) => {
              const visibleItems = section.items.filter(item =>
                !item.requiredPermission || hasPermission(item.requiredPermission)
              );
              if (visibleItems.length === 0) return null;
              const isOpen = openSection === section.title;
              return (
                <div key={section.title} className="mb-0.5">
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="w-full flex items-center justify-between px-3 py-2.5 transition-colors"
                    style={{color: isOpen ? 'white' : 'rgba(255,255,255,0.65)'}}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex-shrink-0">{section.icon}</span>
                      <span className="text-xs font-semibold uppercase tracking-wider">{section.title}</span>
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{color:'rgba(255,255,255,0.4)'}} />
                  </button>
                  {isOpen && (
                    <div className="space-y-0.5">
                      {visibleItems.map((item) => {
                        if (item.isSection) {
                          return (
                            <div key={item.label} className="mx-3 mt-3 mb-1">
                              <span className="text-xs font-semibold uppercase tracking-wider" style={{color:'rgba(255,255,255,0.35)'}}>{item.label}</span>
                            </div>
                          );
                        }
                        const active = isActive(item.href);
                        if (item.isExpandable && item.subItems) {
                          const isExpanded = expandedItems.includes(item.label);
                          return (
                            <div key={item.label} className="mx-2">
                              <button
                                onClick={() => toggleSubmenu(item.label)}
                                className={`w-full flex items-center justify-between pl-4 pr-4 py-2.5 rounded-md transition-all duration-150`}
                                style={{color: active ? 'white' : 'rgba(255,255,255,0.7)', backgroundColor: active ? 'rgba(16,185,129,0.15)' : undefined}}
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`font-bold ${active ? 'text-teal-600' : 'text-gray-600'}`}>{item.icon}</span>
                                  <span className="font-bold text-sm">{item.label}</span>
                                </div>
                                <ChevronRight className={`h-3.5 w-3.5 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                              {isExpanded && item.subItems.map((subItem) => {
                                const subActive = isActive(subItem.href, subItem.exact);
                                return (
                                  <Link
                                    key={subItem.href}
                                    href={subItem.href}
                                    prefetch={false}
                                    onClick={onClose}
                                    className={`flex items-center gap-3 pl-12 pr-4 py-2.5 rounded-md transition-all duration-150 ${
                                      subActive ? 'border-l-2 border-primary-400' : ''
                                    }`}
                                    style={{color: subActive ? 'white' : 'rgba(255,255,255,0.65)', backgroundColor: subActive ? 'rgba(16,185,129,0.15)' : undefined}}
                                  >
                                    <span>{subItem.icon}</span>
                                    <span className="text-sm">{subItem.label}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          );
                        }
                        return (
                          <div key={item.href} className="mx-2">
                            <Link
                              href={item.href}
                              prefetch={false}
                              onClick={onClose}
                              className={`flex items-center gap-3 pl-4 pr-4 py-2.5 rounded-md transition-all duration-150 ${
                                active ? 'border-l-2 border-primary-400' : ''
                              }`}
                              style={{color: active ? 'white' : 'rgba(255,255,255,0.7)', backgroundColor: active ? 'rgba(16,185,129,0.15)' : undefined}}
                            >
                              <span className="flex-shrink-0">{item.icon}</span>
                              <span className="text-sm flex-1 truncate">{item.label}</span>
                              {item.badge}
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Drawer footer */}
          <div className="p-3 flex-shrink-0" style={{borderTop:'1px solid rgba(255,255,255,0.1)'}}>
            <Link
              href="/dashboard/settings"
              prefetch={false}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors mb-1"
              style={{color:'rgba(255,255,255,0.55)'}}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor='rgba(255,255,255,0.08)'; e.currentTarget.style.color='white'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor='transparent'; e.currentTarget.style.color='rgba(255,255,255,0.55)'; }}
            >
              <Settings className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">Settings</span>
            </Link>
            <button
              onClick={() => { handleLogout(); onClose?.(); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors"
              style={{color:'rgba(239,68,68,0.75)'}}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor='rgba(239,68,68,0.12)'; e.currentTarget.style.color='#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor='transparent'; e.currentTarget.style.color='rgba(239,68,68,0.75)'; }}
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </nav>
      </>
    )}
    </>
  );
}
