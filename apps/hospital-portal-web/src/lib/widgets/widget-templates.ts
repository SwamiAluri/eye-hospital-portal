/**
 * Widget Templates
 * Pre-configured widget layouts for different session types
 */

import {
  Clock,
  Stethoscope,
  DollarSign,
  FileCheck,
  Calendar,
  Activity,
  Shield,
} from 'lucide-react';

import type { WidgetTemplate, SessionStage } from './widget-types';

/**
 * Queue/Initial State Template
 * Shown when no patient is selected or session hasn't started
 * Empty layout - queue management is now in the header and sidebar
 */
export const QUEUE_TEMPLATE: WidgetTemplate = {
  id: 'queue',
  name: 'Queue Management',
  description: 'View and manage patient queue',
  stage: 'queue',
  icon: Clock,
  widgets: [],
};

/**
 * Initial Consultation Template - Session Start
 * Shows patient context and clinical data (read-only)
 * Counselor reviews info then proceeds to payment/package selection
 */
export const INITIAL_CONSULTATION_TEMPLATE: WidgetTemplate = {
  id: 'initial',
  name: 'Session Start',
  description: 'Review patient information and clinical data',
  stage: 'initial',
  icon: Stethoscope,
  widgets: [
    {
      widgetId: 'patient-summary',
      size: 'small',
      isPinned: true,
      order: 1,
    },
    {
      widgetId: 'active-session',
      size: 'small',
      isPinned: true,
      order: 2,
    },
    {
      widgetId: 'clinical-summary',
      size: 'large',
      isPinned: false,
      order: 3,
    },
    {
      widgetId: 'session-notes',
      size: 'medium',
      isPinned: false,
      order: 4,
    },
  ],
};

/**
 * Package Selection Template
 * Payment mode selection and package discussion
 */
export const PACKAGE_SELECTION_TEMPLATE: WidgetTemplate = {
  id: 'package-selection',
  name: 'Payment & Package Selection',
  description: 'Select payment mode and discuss package options',
  stage: 'package-selection',
  icon: DollarSign,
  widgets: [
    {
      widgetId: 'patient-summary',
      size: 'small',
      isPinned: true,
      order: 1,
    },
    {
      widgetId: 'active-session',
      size: 'small',
      isPinned: true,
      order: 2,
    },
    {
      widgetId: 'payment-mode-selection',
      size: 'large',
      isPinned: false,
      order: 3,
    },
    {
      widgetId: 'package-selection',
      size: 'large',
      isPinned: false,
      order: 4,
    },
    {
      widgetId: 'iol-recommendation',
      size: 'large',
      isPinned: false,
      order: 5,
    },
    {
      widgetId: 'session-notes',
      size: 'medium',
      isPinned: false,
      order: 6,
    },
  ],
};

/**
 * Financial Counseling Template (Deprecated - use patient-type-specific templates)
 * Generic template for backward compatibility
 */
export const FINANCIAL_COUNSELING_TEMPLATE: WidgetTemplate = {
  id: 'financial',
  name: 'Financial Counseling',
  description: 'Cost explanation and financial planning (no payment collection)',
  stage: 'financial',
  icon: DollarSign,
  widgets: [
    {
      widgetId: 'patient-summary',
      size: 'small',
      isPinned: true,
      order: 1,
    },
    {
      widgetId: 'active-session',
      size: 'small',
      isPinned: true,
      order: 2,
    },
    {
      widgetId: 'payment-summary',
      size: 'medium',
      isPinned: false,
      order: 3,
    },
    {
      widgetId: 'package-selection',
      size: 'medium',
      isPinned: false,
      order: 4,
    },
    {
      widgetId: 'session-notes',
      size: 'medium',
      isPinned: false,
      order: 5,
    },
  ],
};

/**
 * Insurance Discussion Template
 * Insurance pre-auth info and cost explanation (NO payment collection)
 * Counselor explains costs - patient pays at billing desk
 */
export const INSURANCE_DISCUSSION_TEMPLATE: WidgetTemplate = {
  id: 'insurance',
  name: 'Insurance & Cost Discussion',
  description: 'Cost discussion; coverage/pre-auth is handled in CCMS (not mock widgets)',
  stage: 'financial',
  icon: Shield,
  widgets: [
    {
      widgetId: 'patient-summary',
      size: 'small',
      isPinned: true,
      order: 1,
    },
    {
      widgetId: 'active-session',
      size: 'small',
      isPinned: true,
      order: 2,
    },
    {
      widgetId: 'package-selection',
      size: 'medium',
      isPinned: false,
      order: 3,
    },
    {
      widgetId: 'payment-summary',
      size: 'medium',
      isPinned: false,
      order: 4,
    },
    {
      widgetId: 'session-notes',
      size: 'medium',
      isPinned: false,
      order: 5,
    },
  ],
};

/**
 * Cash Flow Template
 * For Cash payment patients - Counselor explains 50% advance requirement
 * Payment collection happens at billing desk, NOT during counseling
 */
export const CASH_FLOW_TEMPLATE: WidgetTemplate = {
  id: 'cash-flow',
  name: 'Cash Payment Counseling',
  description: 'Explain 50% advance requirement (payment at billing desk)',
  stage: 'financial',
  icon: DollarSign,
  widgets: [
    {
      widgetId: 'patient-summary',
      size: 'small',
      isPinned: true,
      order: 1,
    },
    {
      widgetId: 'active-session',
      size: 'small',
      isPinned: true,
      order: 2,
    },
    {
      widgetId: 'package-selection',
      size: 'medium',
      isPinned: false,
      order: 3,
    },
    {
      widgetId: 'advance-payment-calculator',
      size: 'large',
      isPinned: false,
      order: 4,
    },
    {
      widgetId: 'payment-summary',
      size: 'medium',
      isPinned: false,
      order: 5,
    },
    {
      widgetId: 'session-notes',
      size: 'medium',
      isPinned: false,
      order: 6,
    },
  ],
};

/**
 * Government Scheme Flow Template
 * For CGHS, ESH, SGHS, Arograshree patients
 * Counselor explains authorization process and required documents
 * No payment collection - scheme covers costs
 */
export const GOVERNMENT_SCHEME_FLOW_TEMPLATE: WidgetTemplate = {
  id: 'government-scheme-flow',
  name: 'Government Scheme Counseling',
  description: 'Explain scheme coverage; authorization is handled in CCMS',
  stage: 'financial',
  icon: Shield,
  widgets: [
    {
      widgetId: 'patient-summary',
      size: 'small',
      isPinned: true,
      order: 1,
    },
    {
      widgetId: 'active-session',
      size: 'small',
      isPinned: true,
      order: 2,
    },
    {
      widgetId: 'package-selection',
      size: 'medium',
      isPinned: false,
      order: 3,
    },
    {
      widgetId: 'payment-summary',
      size: 'medium',
      isPinned: false,
      order: 4,
    },
    {
      widgetId: 'session-notes',
      size: 'medium',
      isPinned: false,
      order: 5,
    },
  ],
};

/**
 * Camp Flow Template
 * For camp-sponsored patients (zero cost)
 * Counselor verifies sponsorship details
 * No payment collection - fully sponsored
 */
export const CAMP_FLOW_TEMPLATE: WidgetTemplate = {
  id: 'camp-flow',
  name: 'Camp Sponsored Counseling',
  description: 'Verify sponsor details (free surgery)',
  stage: 'financial',
  icon: Activity,
  widgets: [
    {
      widgetId: 'patient-summary',
      size: 'small',
      isPinned: true,
      order: 1,
    },
    {
      widgetId: 'active-session',
      size: 'small',
      isPinned: true,
      order: 2,
    },
    {
      widgetId: 'package-selection',
      size: 'medium',
      isPinned: false,
      order: 3,
    },
    {
      widgetId: 'camp-sponsor-info',
      size: 'large',
      isPinned: false,
      order: 4,
    },
    {
      widgetId: 'session-notes',
      size: 'medium',
      isPinned: false,
      order: 5,
    },
  ],
};

/**
 * Pre-Surgery/Consent Template
 * Focus on consent signing, surgery scheduling, and pre-op planning
 */
export const PRE_SURGERY_TEMPLATE: WidgetTemplate = {
  id: 'pre-surgery',
  name: 'Pre-Surgery Planning',
  description: 'Consent signing, surgery scheduling, pre-op checklist',
  stage: 'pre-surgery',
  icon: FileCheck,
  widgets: [
    {
      widgetId: 'patient-summary',
      size: 'small',
      isPinned: true,
      order: 1,
    },
    {
      widgetId: 'active-session',
      size: 'small',
      isPinned: true,
      order: 2,
    },
    {
      widgetId: 'consent-signing',
      size: 'large',
      isPinned: false,
      order: 3,
    },
    {
      widgetId: 'surgery-scheduling',
      size: 'large',
      isPinned: false,
      order: 4,
    },
    {
      widgetId: 'preop-checklist',
      size: 'medium',
      isPinned: false,
      order: 5,
    },
    {
      widgetId: 'admission-planning',
      size: 'large',
      isPinned: false,
      order: 6,
    },
    {
      widgetId: 'payment-summary',
      size: 'small',
      isPinned: false,
      order: 7,
    },
    {
      widgetId: 'session-notes',
      size: 'medium',
      isPinned: false,
      order: 8,
    },
  ],
};

/**
 * Follow-up Template
 * Simple session for post-op or follow-up visits
 */
export const FOLLOWUP_TEMPLATE: WidgetTemplate = {
  id: 'followup',
  name: 'Follow-up Session',
  description: 'Post-op review and documentation',
  stage: 'followup',
  icon: Activity,
  widgets: [
    {
      widgetId: 'patient-summary',
      size: 'medium',
      isPinned: true,
      order: 1,
    },
    {
      widgetId: 'active-session',
      size: 'small',
      isPinned: true,
      order: 2,
    },
    {
      widgetId: 'session-notes',
      size: 'large',
      isPinned: false,
      order: 3,
    },
    {
      widgetId: 'document-viewer',
      size: 'large',
      isPinned: false,
      order: 4,
    },
    {
      widgetId: 'payment-summary',
      size: 'small',
      isPinned: false,
      order: 5,
    },
  ],
};

/**
 * Admission Scheduling Template
 * Focus on bed reservation and admission planning
 */
export const ADMISSION_TEMPLATE: WidgetTemplate = {
  id: 'admission',
  name: 'Admission Scheduling',
  description: 'Bed reservation, admission date/time, ward selection',
  stage: 'admission',
  icon: Calendar,
  widgets: [
    {
      widgetId: 'patient-summary',
      size: 'small',
      isPinned: true,
      order: 1,
    },
    {
      widgetId: 'active-session',
      size: 'small',
      isPinned: true,
      order: 2,
    },
    {
      widgetId: 'admission-planning',
      size: 'large',
      isPinned: false,
      order: 3,
    },
    {
      widgetId: 'surgery-scheduling',
      size: 'large',
      isPinned: false,
      order: 4,
    },
    {
      widgetId: 'preop-checklist',
      size: 'medium',
      isPinned: false,
      order: 5,
    },
    {
      widgetId: 'payment-summary',
      size: 'medium',
      isPinned: false,
      order: 6,
    },
    {
      widgetId: 'session-notes',
      size: 'medium',
      isPinned: false,
      order: 7,
    },
  ],
};

/**
 * Comprehensive Counseling Template
 * 7-step sequential workflow for complete counseling session
 * Demographics → Pre-Op → IOL → Package → Imaging → Surgery → Documents
 */
export const COMPREHENSIVE_COUNSELING_TEMPLATE: WidgetTemplate = {
  id: 'comprehensive-counseling',
  name: '7-Step Comprehensive Counseling',
  description: 'Complete counselor workflow from pre-op through patient decision',
  stage: 'initial',
  icon: Stethoscope,
  widgets: [
    // Step 1: Pre-Op Instructions (clinical-summary + preoperative-instructions)
    { widgetId: 'patient-summary',            size: 'small',  isPinned: true,  order: 1 },
    { widgetId: 'clinical-summary',           size: 'large',  isPinned: false, order: 2 },
    { widgetId: 'preoperative-instructions',  size: 'large',  isPinned: false, order: 3 },

    // Step 2: IOL Recommendation (conditional)
    { widgetId: 'iol-recommendation',         size: 'large',  isPinned: false, order: 4 },

    // Step 3: Imaging Orders
    { widgetId: 'imaging-order',              size: 'medium', isPinned: false, order: 5 },

    // Step 4: Surgery Scheduling (optional)
    { widgetId: 'surgery-scheduling',         size: 'large',  isPinned: false, order: 6 },

    // Step 5: Payment Mode
    { widgetId: 'payment-mode-selection',     size: 'large',  isPinned: false, order: 7 },

    // Step 6: Patient Decision
    { widgetId: 'patient-decision',           size: 'large',  isPinned: false, order: 8 },

    // Step 7: Session Notes
    { widgetId: 'session-notes',              size: 'medium', isPinned: false, order: 9 },
  ],
};

/**
 * All available templates
 */
export const WIDGET_TEMPLATES: Record<string, WidgetTemplate> = {
  queue: QUEUE_TEMPLATE,
  initial: INITIAL_CONSULTATION_TEMPLATE,
  'comprehensive-counseling': COMPREHENSIVE_COUNSELING_TEMPLATE,
  'package-selection': PACKAGE_SELECTION_TEMPLATE,
  insurance: INSURANCE_DISCUSSION_TEMPLATE,
  financial: FINANCIAL_COUNSELING_TEMPLATE,
  'cash-flow': CASH_FLOW_TEMPLATE,
  'government-scheme-flow': GOVERNMENT_SCHEME_FLOW_TEMPLATE,
  'camp-flow': CAMP_FLOW_TEMPLATE,
  'pre-surgery': PRE_SURGERY_TEMPLATE,
  followup: FOLLOWUP_TEMPLATE,
  admission: ADMISSION_TEMPLATE,
};


/**
 * Get template by ID
 */
export function getTemplate(templateId: string): WidgetTemplate | undefined {
  return WIDGET_TEMPLATES[templateId];
}

/**
 * Get template by session stage
 */
export function getTemplateByStage(stage: SessionStage): WidgetTemplate | undefined {
  // Map stages to templates - Updated for counselor workflow
  const stageToTemplate: Record<SessionStage, string> = {
    queue: 'queue',
    initial: 'initial', // Session start - review patient info
    'clinical-review': 'initial', // Same as initial for counselor
    'package-selection': 'package-selection', // Payment mode + package selection
    'iol-selection': 'package-selection', // Included in package selection
    financial: 'financial', // Generic financial (will be overridden by patient-type-specific)
    consent: 'pre-surgery',
    'pre-surgery': 'pre-surgery',
    scheduling: 'admission',
    admission: 'admission',
    followup: 'followup',
    'post-operative-care': 'followup',
    'follow-up-scheduling': 'followup',
    'outcome-tracking': 'followup',
    completed: 'followup',
  };

  const templateId = stageToTemplate[stage];
  return templateId ? WIDGET_TEMPLATES[templateId] : undefined;
}

/**
 * Get all available templates
 */
export function getAllTemplates(): WidgetTemplate[] {
  return Object.values(WIDGET_TEMPLATES);
}
