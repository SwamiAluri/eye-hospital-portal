/**
 * Widget Registry
 * Central registry of all available widgets in the counselor workspace
 */

import {
  User,
  Clock,
  Activity,
  FileText,
  CreditCard,
  Shield,
  Calendar,
  Stethoscope,
  Package,
  Eye,
  HeartPulse,
  FileCheck,
  Bed,
  ClipboardList,
  DollarSign,
  HeartPulseIcon,
  Pill,
  BookOpen,
  Bell,
  Image,
  Users,
  MessageCircle,
  Video,
  GitCompare,
  FlaskConical,
  Sparkles,
  Target,
} from 'lucide-react';

import type {
  WidgetMetadata,
  WidgetRegistryEntry,
  WidgetComponent,
  SessionStage,
} from './widget-types';

/**
 * Widget Registry - Maps widget IDs to their metadata and components
 */
class WidgetRegistryClass {
  private registry: Map<string, WidgetRegistryEntry> = new Map();

  /**
   * Register a widget
   */
  register(entry: WidgetRegistryEntry): void {
    this.registry.set(entry.metadata.id, entry);
  }

  /**
   * Get widget by ID
   */
  get(widgetId: string): WidgetRegistryEntry | undefined {
    return this.registry.get(widgetId);
  }

  /**
   * Get all registered widgets
   */
  getAll(): WidgetRegistryEntry[] {
    return Array.from(this.registry.values());
  }

  /**
   * Get widgets by category
   */
  getByCategory(category: string): WidgetRegistryEntry[] {
    return this.getAll().filter((entry) => entry.metadata.category === category);
  }

  /**
   * Get widgets available for a specific session stage
   */
  getByStage(stage: SessionStage): WidgetRegistryEntry[] {
    return this.getAll().filter((entry) => {
      if (!entry.metadata.requiredStages || entry.metadata.requiredStages.length === 0) {
        return true; // Available in all stages
      }
      return entry.metadata.requiredStages.includes(stage);
    });
  }

  /**
   * Check if widget exists
   */
  has(widgetId: string): boolean {
    return this.registry.has(widgetId);
  }
}

// Singleton instance
export const WidgetRegistry = new WidgetRegistryClass();

/**
 * Widget Metadata Definitions
 * Define all available widgets here
 */

// Patient Context Widgets
export const PATIENT_SUMMARY_WIDGET: WidgetMetadata = {
  id: 'patient-summary',
  title: 'Patient Summary',
  description: 'Demographics, MRN, referral source, chief complaint',
  icon: User,
  category: 'patient-context',
  defaultSize: 'medium',
  allowedSizes: ['small', 'medium', 'large'],
  isPinnable: true,
  isCloseable: false, // Always visible when patient selected
  isResizable: true,
  minWidth: 300,
  minHeight: 200,
};

export const ACTIVE_SESSION_WIDGET: WidgetMetadata = {
  id: 'active-session',
  title: 'Active Session',
  description: 'Session timer, type, stage progress',
  icon: Activity,
  category: 'patient-context',
  defaultSize: 'small',
  allowedSizes: ['small', 'medium'],
  requiredStages: ['initial', 'clinical-review', 'package-selection', 'iol-selection', 'financial', 'consent', 'pre-surgery', 'scheduling', 'admission'],
  isPinnable: true,
  isCloseable: false,
  isResizable: false,
  minWidth: 250,
  minHeight: 150,
};

// Clinical Workflow Widgets
export const CLINICAL_SUMMARY_WIDGET: WidgetMetadata = {
  id: 'clinical-summary',
  title: 'Clinical Summary',
  description: 'Diagnosis, IOP, visual acuity, previous history',
  icon: Stethoscope,
  category: 'clinical',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['initial', 'clinical-review', 'package-selection', 'consent'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 400,
  minHeight: 300,
};

export const PACKAGE_SELECTION_WIDGET: WidgetMetadata = {
  id: 'package-selection',
  title: 'Package Selection',
  description: 'Visual package cards, customization, price calculator',
  icon: Package,
  category: 'clinical',
  defaultSize: 'large',
  allowedSizes: ['large', 'full'],
  requiredStages: ['package-selection', 'financial'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 500,
  minHeight: 400,
};

export const IOL_RECOMMENDATION_WIDGET: WidgetMetadata = {
  id: 'iol-recommendation',
  title: 'Procedure Counseling',
  description: 'IOL selection, power calculator, comparison table',
  icon: Eye,
  category: 'clinical',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['iol-selection', 'package-selection', 'consent'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 450,
  minHeight: 350,
};

export const SURGERY_SCHEDULING_WIDGET: WidgetMetadata = {
  id: 'surgery-scheduling',
  title: 'Surgery Scheduling',
  description: 'Calendar picker, OT availability, surgeon assignment',
  icon: Calendar,
  category: 'scheduling',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['scheduling', 'pre-surgery'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 450,
  minHeight: 400,
};

export const PREOPERATIVE_INSTRUCTIONS_WIDGET: WidgetMetadata = {
  id: 'preoperative-instructions',
  title: 'Pre-Operative Instructions',
  description: 'Medical history capture (DM/HTN), investigation ordering, pre-op requirements',
  icon: HeartPulse,
  category: 'clinical',
  defaultSize: 'large',
  allowedSizes: ['large', 'full'],
  requiredStages: ['initial', 'clinical-review', 'pre-surgery'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 500,
  minHeight: 500,
};

export const IMAGING_ORDER_WIDGET: WidgetMetadata = {
  id: 'imaging-order',
  title: 'Imaging Orders',
  description: 'Order OCT, Fundus, FFA, Visual Field, Biometry scans',
  icon: Image,
  category: 'imaging',
  defaultSize: 'medium',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['clinical-review', 'package-selection', 'pre-surgery'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 400,
  minHeight: 450,
};

// Financial Widgets
export const PAYMENT_MODE_SELECTION_WIDGET: WidgetMetadata = {
  id: 'payment-mode-selection',
  title: 'Payment Mode Selection',
  description: 'Select patient type: Cash, Insurance, CoPay, ESH, CGHS, Arograshree, SGHS, Camp',
  icon: CreditCard,
  category: 'financial',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['initial', 'clinical-review', 'package-selection'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 450,
  minHeight: 400,
};

export const ADVANCE_PAYMENT_CALCULATOR_WIDGET: WidgetMetadata = {
  id: 'advance-payment-calculator',
  title: 'Advance Payment Calculator',
  description: 'Cash flow - 50% advance, 50% balance calculation',
  icon: DollarSign,
  category: 'financial',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['financial'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 400,
  minHeight: 450,
};

export const GOVERNMENT_SCHEME_AUTHORIZATION_WIDGET: WidgetMetadata = {
  id: 'government-scheme-authorization',
  title: 'Government Scheme Authorization',
  description: 'CGHS, ESH, SGHS, Arograshree forms and document upload',
  icon: Shield,
  category: 'financial',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['financial'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 450,
  minHeight: 500,
};

export const CAMP_SPONSOR_INFO_WIDGET: WidgetMetadata = {
  id: 'camp-sponsor-info',
  title: 'Camp Sponsor Info',
  description: 'Zero-cost display, sponsor details, camp registration',
  icon: Users,
  category: 'financial',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['financial'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 400,
  minHeight: 450,
};

export const PAYMENT_SUMMARY_WIDGET: WidgetMetadata = {
  id: 'payment-summary',
  title: 'Payment Summary',
  description: 'Package cost, discounts, balance, payment history',
  icon: DollarSign,
  category: 'financial',
  defaultSize: 'medium',
  allowedSizes: ['small', 'medium', 'large'],
  requiredStages: ['financial', 'package-selection', 'consent', 'admission'],
  isPinnable: true,
  isCloseable: true,
  isResizable: true,
  minWidth: 320,
  minHeight: 250,
};

export const PAYMENT_COLLECTION_WIDGET: WidgetMetadata = {
  id: 'payment-collection',
  title: 'Payment Collection',
  description: 'Payment link generator, cash/card/UPI entry, receipt',
  icon: CreditCard,
  category: 'financial',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['financial', 'admission'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 400,
  minHeight: 350,
};

export const INSURANCE_PREAUTH_WIDGET: WidgetMetadata = {
  id: 'insurance-preauth',
  title: 'Insurance Pre-Auth',
  description: 'Pre-auth form, document upload, status tracker',
  icon: Shield,
  category: 'financial',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['financial', 'consent', 'admission'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 450,
  minHeight: 400,
};

// Consent & Documentation Widgets
export const CONSENT_SIGNING_WIDGET: WidgetMetadata = {
  id: 'consent-signing',
  title: 'Consent Signing',
  description: 'Multi-stage workflow, patient/witness signatures, video consent',
  icon: FileCheck,
  category: 'documentation',
  defaultSize: 'large',
  allowedSizes: ['large', 'full'],
  requiredStages: ['consent', 'pre-surgery'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 500,
  minHeight: 450,
};

export const DOCUMENT_VIEWER_WIDGET: WidgetMetadata = {
  id: 'document-viewer',
  title: 'Document Viewer',
  description: 'PDF/image viewer for reports, consent forms, insurance docs',
  icon: FileText,
  category: 'documentation',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 400,
  minHeight: 500,
};

export const SESSION_NOTES_WIDGET: WidgetMetadata = {
  id: 'session-notes',
  title: 'Session Notes',
  description: 'Rich text editor, voice-to-text, template inserter',
  icon: ClipboardList,
  category: 'communication',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  isPinnable: true,
  isCloseable: true,
  isResizable: true,
  minWidth: 400,
  minHeight: 300,
};

// Post-Session Widgets
export const PREOP_CHECKLIST_WIDGET: WidgetMetadata = {
  id: 'preop-checklist',
  title: 'Pre-Op Checklist',
  description: 'Test ordering, fitness certificate, completion tracker',
  icon: HeartPulse,
  category: 'clinical',
  defaultSize: 'medium',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['pre-surgery', 'admission'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 350,
  minHeight: 300,
};

export const ADMISSION_PLANNING_WIDGET: WidgetMetadata = {
  id: 'admission-planning',
  title: 'Admission Planning',
  description: 'Bed reservation, admission date/time, ward selection',
  icon: Bed,
  category: 'scheduling',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['admission', 'pre-surgery'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 450,
  minHeight: 350,
};

// Post-Operative Care Widgets
export const POSTOP_FOLLOWUP_WIDGET: WidgetMetadata = {
  id: 'postop-followup',
  title: 'Post-Op Follow-Up',
  description: 'Recovery milestones, symptoms tracking, progress photos',
  icon: HeartPulseIcon,
  category: 'post-operative',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['post-operative-care', 'follow-up-scheduling'],
  isPinnable: true,
  isCloseable: true,
  isResizable: true,
  minWidth: 400,
  minHeight: 400,
};

export const MEDICATION_SCHEDULE_WIDGET: WidgetMetadata = {
  id: 'medication-schedule',
  title: 'Medication Schedule',
  description: 'Daily medication schedule with adherence tracking',
  icon: Pill,
  category: 'post-operative',
  defaultSize: 'medium',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['post-operative-care', 'follow-up-scheduling'],
  isPinnable: true,
  isCloseable: true,
  isResizable: true,
  minWidth: 350,
  minHeight: 350,
};

// Patient Education Widgets
export const EDUCATION_LIBRARY_WIDGET: WidgetMetadata = {
  id: 'education-library',
  title: 'Education Library',
  description: 'Patient education content with progress tracking',
  icon: BookOpen,
  category: 'education',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  isPinnable: true,
  isCloseable: true,
  isResizable: true,
  minWidth: 400,
  minHeight: 350,
};

export const APPOINTMENT_REMINDER_WIDGET: WidgetMetadata = {
  id: 'appointment-reminder',
  title: 'Appointment Reminders',
  description: 'Upcoming appointments with confirmation actions',
  icon: Bell,
  category: 'education',
  defaultSize: 'medium',
  allowedSizes: ['small', 'medium'],
  isPinnable: true,
  isCloseable: true,
  isResizable: true,
  minWidth: 300,
  minHeight: 250,
};

// Enhanced Clinical Widgets
export const VITALS_MONITORING_WIDGET: WidgetMetadata = {
  id: 'vitals-monitoring',
  title: 'Vitals Monitoring',
  description: 'Record and track vital signs with trend analysis',
  icon: Activity,
  category: 'monitoring',
  defaultSize: 'medium',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['clinical-review', 'post-operative-care'],
  isPinnable: true,
  isCloseable: true,
  isResizable: true,
  minWidth: 350,
  minHeight: 300,
};

export const MEDICAL_HISTORY_TIMELINE_WIDGET: WidgetMetadata = {
  id: 'medical-history-timeline',
  title: 'Medical History Timeline',
  description: 'Visual chronological medical history',
  icon: Clock,
  category: 'monitoring',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  isPinnable: true,
  isCloseable: true,
  isResizable: true,
  minWidth: 400,
  minHeight: 400,
};

export const LAB_TEST_INTEGRATION_WIDGET: WidgetMetadata = {
  id: 'lab-test-integration',
  title: 'Lab Test Integration',
  description: 'Lab test orders, status tracking, and results viewer',
  icon: FlaskConical,
  category: 'monitoring',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['clinical-review', 'pre-surgery'],
  isPinnable: true,
  isCloseable: true,
  isResizable: true,
  minWidth: 400,
  minHeight: 350,
};

export const IMAGING_VIEWER_WIDGET: WidgetMetadata = {
  id: 'imaging-viewer',
  title: 'Medical Imaging',
  description: 'View and navigate DICOM/OCT/Fundus images',
  icon: Image,
  category: 'imaging',
  defaultSize: 'large',
  allowedSizes: ['large', 'full'],
  requiredStages: ['clinical-review', 'iol-selection'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 450,
  minHeight: 400,
};

// Financial & Admin Widgets
export const INSURANCE_CLAIM_TRACKING_WIDGET: WidgetMetadata = {
  id: 'insurance-claim-tracking',
  title: 'Insurance Claim Tracking',
  description: 'Real-time claim status and document tracking',
  icon: Shield,
  category: 'admin',
  defaultSize: 'medium',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['financial', 'post-operative-care'],
  isPinnable: true,
  isCloseable: true,
  isResizable: true,
  minWidth: 400,
  minHeight: 350,
};

export const BILLING_PAYMENT_PLAN_WIDGET: WidgetMetadata = {
  id: 'billing-payment-plan',
  title: 'Billing & Payment Plan',
  description: 'Detailed billing with EMI calculator',
  icon: CreditCard,
  category: 'admin',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['financial', 'admission'],
  isPinnable: true,
  isCloseable: true,
  isResizable: true,
  minWidth: 450,
  minHeight: 400,
};

export const REFERRAL_MANAGEMENT_WIDGET: WidgetMetadata = {
  id: 'referral-management',
  title: 'Referral Management',
  description: 'Create and track specialist referrals',
  icon: Users,
  category: 'admin',
  defaultSize: 'medium',
  allowedSizes: ['medium', 'large'],
  isPinnable: true,
  isCloseable: true,
  isResizable: true,
  minWidth: 400,
  minHeight: 350,
};

export const PATIENT_FEEDBACK_WIDGET: WidgetMetadata = {
  id: 'patient-feedback',
  title: 'Patient Feedback',
  description: 'Collect NPS scores and patient satisfaction feedback',
  icon: MessageCircle,
  category: 'admin',
  defaultSize: 'medium',
  allowedSizes: ['medium', 'large'],
  requiredStages: ['post-operative-care', 'outcome-tracking'],
  isPinnable: true,
  isCloseable: true,
  isResizable: true,
  minWidth: 400,
  minHeight: 400,
};

// Advanced Features Widgets
export const TELEMEDICINE_CONSULTATION_WIDGET: WidgetMetadata = {
  id: 'telemedicine-consultation',
  title: 'Telemedicine Consultation',
  description: 'Video consultation with call controls',
  icon: Video,
  category: 'telemedicine',
  defaultSize: 'large',
  allowedSizes: ['large', 'full'],
  requiredStages: ['initial', 'clinical-review', 'follow-up-scheduling'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 500,
  minHeight: 450,
};

export const TREATMENT_PLAN_COMPARISON_WIDGET: WidgetMetadata = {
  id: 'treatment-plan-comparison',
  title: 'Treatment Plan Comparison',
  description: 'Side-by-side comparison of treatment options',
  icon: GitCompare,
  category: 'analytics',
  defaultSize: 'large',
  allowedSizes: ['large', 'full'],
  requiredStages: ['package-selection', 'iol-selection'],
  isPinnable: false,
  isCloseable: true,
  isResizable: true,
  minWidth: 600,
  minHeight: 400,
};

export const SMART_WORKFLOW_ASSISTANT_WIDGET: WidgetMetadata = {
  id: 'smart-workflow-assistant',
  title: 'Smart Workflow Assistant',
  description: 'AI-powered workflow suggestions and task prioritization',
  icon: Sparkles,
  category: 'analytics',
  defaultSize: 'medium',
  allowedSizes: ['small', 'medium'],
  isPinnable: true,
  isCloseable: true,
  isResizable: true,
  minWidth: 350,
  minHeight: 300,
};

export const PATIENT_DECISION_WIDGET: WidgetMetadata = {
  id: 'patient-decision',
  title: 'Patient Decision',
  description: 'Capture patient intent — willing to proceed or not ready yet',
  icon: Target,
  category: 'clinical',
  defaultSize: 'large',
  allowedSizes: ['medium', 'large'],
  isPinnable: false,
  isCloseable: false,
  isResizable: true,
  minWidth: 400,
  minHeight: 300,
};

/**
 * Register all widgets
 * Components are lazy-loaded to reduce bundle size
 */
export function registerAllWidgets(): void {
  // Patient Context Widgets
  WidgetRegistry.register({
    metadata: PATIENT_SUMMARY_WIDGET,
    component: require('@/components/widgets/PatientSummaryWidget').default,
  });

  WidgetRegistry.register({
    metadata: ACTIVE_SESSION_WIDGET,
    component: require('@/components/widgets/ActiveSessionWidget').default,
  });

  // Clinical Workflow Widgets
  WidgetRegistry.register({
    metadata: CLINICAL_SUMMARY_WIDGET,
    component: require('@/components/widgets/ClinicalSummaryWidget').default,
  });

  WidgetRegistry.register({
    metadata: PACKAGE_SELECTION_WIDGET,
    component: require('@/components/widgets/PackageSelectionWidget').default,
  });

  WidgetRegistry.register({
    metadata: IOL_RECOMMENDATION_WIDGET,
    component: require('@/components/widgets/IOLRecommendationWidget').default,
  });

  WidgetRegistry.register({
    metadata: SURGERY_SCHEDULING_WIDGET,
    component: require('@/components/widgets/SurgerySchedulingWidget').default,
  });

  // Financial Widgets
  WidgetRegistry.register({
    metadata: PAYMENT_MODE_SELECTION_WIDGET,
    component: require('@/components/widgets/PaymentModeSelectionWidget').default,
  });

  WidgetRegistry.register({
    metadata: ADVANCE_PAYMENT_CALCULATOR_WIDGET,
    component: require('@/components/widgets/AdvancePaymentCalculatorWidget').default,
  });

  WidgetRegistry.register({
    metadata: GOVERNMENT_SCHEME_AUTHORIZATION_WIDGET,
    component: require('@/components/widgets/GovernmentSchemeAuthorizationWidget').default,
  });

  WidgetRegistry.register({
    metadata: CAMP_SPONSOR_INFO_WIDGET,
    component: require('@/components/widgets/CampSponsorInfoWidget').default,
  });

  WidgetRegistry.register({
    metadata: PAYMENT_SUMMARY_WIDGET,
    component: require('@/components/widgets/PaymentSummaryWidget').default,
  });

  WidgetRegistry.register({
    metadata: PAYMENT_COLLECTION_WIDGET,
    component: require('@/components/widgets/PaymentCollectionWidget').default,
  });

  WidgetRegistry.register({
    metadata: INSURANCE_PREAUTH_WIDGET,
    component: require('@/components/widgets/InsurancePreAuthWidget').default,
  });

  // Consent & Documentation Widgets
  WidgetRegistry.register({
    metadata: CONSENT_SIGNING_WIDGET,
    component: require('@/components/widgets/ConsentSigningWidget').default,
  });

  WidgetRegistry.register({
    metadata: DOCUMENT_VIEWER_WIDGET,
    component: require('@/components/widgets/DocumentViewerWidget').default,
  });

  WidgetRegistry.register({
    metadata: SESSION_NOTES_WIDGET,
    component: require('@/components/widgets/SessionNotesWidget').default,
  });

  // Post-Session Widgets
  WidgetRegistry.register({
    metadata: PREOP_CHECKLIST_WIDGET,
    component: require('@/components/widgets/PreOpChecklistWidget').default,
  });

  WidgetRegistry.register({
    metadata: ADMISSION_PLANNING_WIDGET,
    component: require('@/components/widgets/AdmissionPlanningWidget').default,
  });

  // Post-Operative Care Widgets
  WidgetRegistry.register({
    metadata: POSTOP_FOLLOWUP_WIDGET,
    component: require('@/components/widgets/PostOpFollowUpWidget').default,
  });

  WidgetRegistry.register({
    metadata: MEDICATION_SCHEDULE_WIDGET,
    component: require('@/components/widgets/MedicationScheduleWidget').default,
  });

  // Patient Education Widgets
  WidgetRegistry.register({
    metadata: EDUCATION_LIBRARY_WIDGET,
    component: require('@/components/widgets/EducationLibraryWidget').default,
  });

  WidgetRegistry.register({
    metadata: APPOINTMENT_REMINDER_WIDGET,
    component: require('@/components/widgets/AppointmentReminderWidget').default,
  });

  // Enhanced Clinical Widgets
  WidgetRegistry.register({
    metadata: VITALS_MONITORING_WIDGET,
    component: require('@/components/widgets/VitalsMonitoringWidget').default,
  });

  WidgetRegistry.register({
    metadata: MEDICAL_HISTORY_TIMELINE_WIDGET,
    component: require('@/components/widgets/MedicalHistoryTimelineWidget').default,
  });

  WidgetRegistry.register({
    metadata: LAB_TEST_INTEGRATION_WIDGET,
    component: require('@/components/widgets/LabTestIntegrationWidget').default,
  });

  WidgetRegistry.register({
    metadata: IMAGING_VIEWER_WIDGET,
    component: require('@/components/widgets/ImagingViewerWidget').default,
  });

  WidgetRegistry.register({
    metadata: PREOPERATIVE_INSTRUCTIONS_WIDGET,
    component: require('@/components/widgets/PreOperativeInstructionsWidget').default,
  });

  WidgetRegistry.register({
    metadata: IMAGING_ORDER_WIDGET,
    component: require('@/components/widgets/ImagingOrderWidget').default,
  });

  // Financial & Admin Widgets
  WidgetRegistry.register({
    metadata: INSURANCE_CLAIM_TRACKING_WIDGET,
    component: require('@/components/widgets/InsuranceClaimTrackingWidget').default,
  });

  WidgetRegistry.register({
    metadata: BILLING_PAYMENT_PLAN_WIDGET,
    component: require('@/components/widgets/BillingPaymentPlanWidget').default,
  });

  WidgetRegistry.register({
    metadata: REFERRAL_MANAGEMENT_WIDGET,
    component: require('@/components/widgets/ReferralManagementWidget').default,
  });

  WidgetRegistry.register({
    metadata: PATIENT_FEEDBACK_WIDGET,
    component: require('@/components/widgets/PatientFeedbackWidget').default,
  });

  // Advanced Features Widgets
  WidgetRegistry.register({
    metadata: TELEMEDICINE_CONSULTATION_WIDGET,
    component: require('@/components/widgets/TelemedicineConsultationWidget').default,
  });

  WidgetRegistry.register({
    metadata: TREATMENT_PLAN_COMPARISON_WIDGET,
    component: require('@/components/widgets/TreatmentPlanComparisonWidget').default,
  });

  WidgetRegistry.register({
    metadata: SMART_WORKFLOW_ASSISTANT_WIDGET,
    component: require('@/components/widgets/SmartWorkflowAssistantWidget').default,
  });

  // Patient Decision — Step 6 of counseling workflow
  WidgetRegistry.register({
    metadata: PATIENT_DECISION_WIDGET,
    component: require('@/components/widgets/PatientDecisionWidget').default,
  });
}

/**
 * Get widget metadata by ID
 */
export function getWidgetMetadata(widgetId: string): WidgetMetadata | undefined {
  const entry = WidgetRegistry.get(widgetId);
  return entry?.metadata;
}

/**
 * Get widget component by ID
 */
export function getWidgetComponent(widgetId: string): WidgetComponent | undefined {
  const entry = WidgetRegistry.get(widgetId);
  return entry?.component;
}

/**
 * Get all available widget IDs
 */
export function getAllWidgetIds(): string[] {
  return WidgetRegistry.getAll().map((entry) => entry.metadata.id);
}
