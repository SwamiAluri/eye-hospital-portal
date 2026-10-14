/**
 * Structural capability registry for Enterprise LMS L0.
 * Navigation existence ≠ workflow implementation.
 */

export type LmsCapabilityStatus = 'placeholder' | 'not_implemented' | 'implemented';

export type LmsCapabilityDefinition = {
  id: string;
  title: string;
  href: string;
  description: string;
  status: LmsCapabilityStatus;
};

export const LMS_CAPABILITIES: LmsCapabilityDefinition[] = [
  {
    id: 'overview',
    title: 'Overview',
    href: '/dashboard/lms',
    description: 'Enterprise LMS workspace landing and future operational indicators.',
    status: 'placeholder',
  },
  {
    id: 'work-queue',
    title: 'Work Queue',
    href: '/dashboard/lms/work-queue',
    description: 'Role/work-based operational queues (assignment rules deferred).',
    status: 'not_implemented',
  },
  {
    id: 'orders',
    title: 'Orders',
    href: '/dashboard/lms/orders',
    description: 'Laboratory order intake and order lifecycle.',
    status: 'implemented',
  },
  {
    id: 'collection',
    title: 'Collection',
    href: '/dashboard/lms/collection',
    description: 'Collection planning and shared branch collection work queue (L-COL-01B).',
    status: 'implemented',
  },
  {
    id: 'specimens',
    title: 'Specimens',
    href: '/dashboard/lms/specimens',
    description: 'Specimen detail after Complete Collection (L-COL-01C). Receiving deferred.',
    status: 'implemented',
  },
  {
    id: 'testing',
    title: 'Testing',
    href: '/dashboard/lms/testing',
    description: 'Testing work queue and manual Result Draft entry (L-TST-01A).',
    status: 'implemented',
  },
  {
    id: 'testing-workbench',
    title: 'Testing Workbench',
    href: '/dashboard/lms/testing/workbench',
    description: 'Testing work queue (L-TST-01A).',
    status: 'implemented',
  },
  {
    id: 'testing-runs',
    title: 'Analytical Runs',
    href: '/dashboard/lms/testing/runs',
    description: 'Analytical run management.',
    status: 'not_implemented',
  },
  {
    id: 'testing-manual-results',
    title: 'Manual Results',
    href: '/dashboard/lms/testing/manual-results',
    description: 'Manual Result Draft entry (L-TST-01A).',
    status: 'implemented',
  },
  {
    id: 'testing-instrument-results',
    title: 'Instrument Results',
    href: '/dashboard/lms/testing/instrument-results',
    description: 'Instrument / analyzer result intake.',
    status: 'not_implemented',
  },
  {
    id: 'testing-exceptions',
    title: 'Testing Exceptions',
    href: '/dashboard/lms/testing/exceptions',
    description: 'Analytical exceptions and holds.',
    status: 'not_implemented',
  },
  {
    id: 'results',
    title: 'Results & Authorization',
    href: '/dashboard/lms/results',
    description: 'Technical verification and clinical authorization.',
    status: 'not_implemented',
  },
  {
    id: 'results-verification',
    title: 'Verification',
    href: '/dashboard/lms/results/verification',
    description: 'Technical verification queue (Draft → Technical Verified).',
    status: 'implemented',
  },
  {
    id: 'results-authorization',
    title: 'Authorization',
    href: '/dashboard/lms/results/authorization',
    description:
      'Clinical authorization queue (Technical Verified → Clinically Authorized). Not Final/Released.',
    status: 'implemented',
  },
  {
    id: 'results-authorized',
    title: 'Authorized Results',
    href: '/dashboard/lms/results/authorized',
    description:
      'ClinicallyAuthorized Results discovery for Result Detail / Critical classification entry. Not Final/Released/Published/patient-visible.',
    status: 'implemented',
  },
  {
    id: 'results-critical',
    title: 'Critical Results',
    href: '/dashboard/lms/results/critical',
    description: 'Critical-result events and acknowledgment.',
    status: 'implemented',
  },
  {
    id: 'results-amendments',
    title: 'Amendments',
    href: '/dashboard/lms/results/amendments',
    description: 'Result / report amendment workflow.',
    status: 'not_implemented',
  },
  {
    id: 'reports',
    title: 'Reports',
    href: '/dashboard/lms/reports',
    description:
      'Draft + Finalize + Release metadata, Report Number, Official PDF generate, and staff Official PDF download. Patient publication not implemented.',
    status: 'implemented',
  },
  {
    id: 'referrals',
    title: 'Referrals',
    href: '/dashboard/lms/referrals',
    description: 'Referral laboratory partners and send-outs.',
    status: 'not_implemented',
  },
  {
    id: 'quality',
    title: 'Quality',
    href: '/dashboard/lms/quality',
    description: 'QC, nonconformities, CAPA, equipment, reagents, competency.',
    status: 'not_implemented',
  },
  {
    id: 'quality-qc',
    title: 'QC',
    href: '/dashboard/lms/quality/qc',
    description: 'Quality control.',
    status: 'not_implemented',
  },
  {
    id: 'quality-nonconformities',
    title: 'Nonconformities',
    href: '/dashboard/lms/quality/nonconformities',
    description: 'Quality nonconformity tracking.',
    status: 'not_implemented',
  },
  {
    id: 'quality-capa',
    title: 'CAPA',
    href: '/dashboard/lms/quality/capa',
    description: 'Corrective and preventive action.',
    status: 'not_implemented',
  },
  {
    id: 'quality-equipment',
    title: 'Equipment',
    href: '/dashboard/lms/quality/equipment',
    description: 'Laboratory equipment registry.',
    status: 'not_implemented',
  },
  {
    id: 'quality-reagents',
    title: 'Reagents',
    href: '/dashboard/lms/quality/reagents',
    description: 'Reagent lot tracking.',
    status: 'not_implemented',
  },
  {
    id: 'quality-competency',
    title: 'Competency',
    href: '/dashboard/lms/quality/competency',
    description: 'Staff competency records.',
    status: 'not_implemented',
  },
  {
    id: 'operations',
    title: 'Operations',
    href: '/dashboard/lms/operations',
    description: 'Operational controls and laboratory operations desk.',
    status: 'not_implemented',
  },
  {
    id: 'billing',
    title: 'Billing',
    href: '/dashboard/lms/billing',
    description: 'Commercial handoff to Billing (Billing remains ledger SoT).',
    status: 'not_implemented',
  },
  {
    id: 'analytics',
    title: 'Analytics',
    href: '/dashboard/lms/analytics',
    description: 'Laboratory operational analytics.',
    status: 'not_implemented',
  },
  {
    id: 'configuration',
    title: 'Configuration',
    href: '/dashboard/lms/configuration',
    description: 'Catalogue, panels, specimen types, intervals, TAT, sites, partners.',
    status: 'not_implemented',
  },
  {
    id: 'configuration-test-catalogue',
    title: 'Test Catalogue',
    href: '/dashboard/lms/configuration/test-catalogue',
    description: 'Governed Enterprise LMS catalogue (L-CAT-01B).',
    status: 'implemented',
  },
  {
    id: 'configuration-panels',
    title: 'Panels',
    href: '/dashboard/lms/configuration/panels',
    description: 'Panel/profile catalogue items (L-CAT-01B).',
    status: 'implemented',
  },
  {
    id: 'configuration-specimen-types',
    title: 'Specimen Types',
    href: '/dashboard/lms/configuration/specimen-types',
    description: 'Specimen type master data.',
    status: 'not_implemented',
  },
  {
    id: 'configuration-reference-intervals',
    title: 'Reference Intervals',
    href: '/dashboard/lms/configuration/reference-intervals',
    description: 'Reference interval configuration.',
    status: 'not_implemented',
  },
  {
    id: 'configuration-tat-rules',
    title: 'TAT Rules',
    href: '/dashboard/lms/configuration/tat-rules',
    description: 'Turnaround-time rule configuration.',
    status: 'not_implemented',
  },
  {
    id: 'configuration-sites-sections',
    title: 'Sites / Sections',
    href: '/dashboard/lms/configuration/sites-sections',
    description: 'Laboratory site and section configuration.',
    status: 'not_implemented',
  },
  {
    id: 'configuration-referral-partners',
    title: 'Referral Partners',
    href: '/dashboard/lms/configuration/referral-partners',
    description: 'External referral partner configuration.',
    status: 'not_implemented',
  },
  {
    id: 'administration',
    title: 'Administration',
    href: '/dashboard/lms/administration',
    description: 'Enterprise LMS administration.',
    status: 'not_implemented',
  },
];

export function getLmsCapabilityByHref(href: string): LmsCapabilityDefinition | undefined {
  return LMS_CAPABILITIES.find((c) => c.href === href);
}
