'use client';

import React from 'react';
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

export const SIDEBAR_MENU_SECTIONS: MenuSection[] = [

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
        {
          label: 'Analytics',
          href: '/dashboard/counselor/analytics',
          icon: <BarChart className="h-4 w-4" strokeWidth={2.5} />,
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
          requiredPermission: 'ccms.coverage_case.read',
        },
        {
          label: 'Cases',
          href: '/dashboard/ccms/cases',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'ccms.coverage_case.read',
        },
        {
          label: 'Authorization Queue',
          href: '/dashboard/ccms/authorization',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'ccms.authorization.read',
        },
        {
          label: 'Claims',
          href: '/dashboard/ccms/claims',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'ccms.claim.read',
        },
        {
          label: 'Enhancements',
          href: '/dashboard/ccms/enhancements',
          icon: <TrendingUp className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'ccms.authorization.read',
        },
        {
          label: 'Settlements',
          href: '/dashboard/ccms/settlement',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'ccms.settlement.read',
        },
        {
          label: 'Pre-Auth Queue (Ops)',
          href: '/dashboard/ccms/operations/preauth',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'ccms.authorization.read',
        },
        {
          label: 'Settlement Desk',
          href: '/dashboard/ccms/operations/settlement',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'ccms.settlement.read',
        },
        {
          label: 'Payers / TPA',
          href: '/dashboard/ccms/master-data/payers',
          icon: <FileCheck className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'ccms.master_data.read',
        },
        {
          label: 'Analytics',
          href: '/dashboard/ccms/analytics',
          icon: <BarChart className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'ccms.report.dashboard',
        },
        {
          label: 'CCMS Settings',
          href: '/dashboard/ccms/settings',
          icon: <Settings className="h-4 w-4" strokeWidth={2.5} />,
          requiredPermission: 'ccms.workflow.admin',
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

export type { MenuItem, MenuSection };
