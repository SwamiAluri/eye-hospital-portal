/**
 * Master data entity integration registry (F0).
 * CI script `verify-master-integration.ts` enforces wiring rules per status.
 *
 * Status:
 * - wired: must appear in frontend via useMasterValues / dedicated hook
 * - catalog-owned: billable SKUs — Service Catalog (not master CRUD alone)
 * - hardcoded: intentional TS constants (document owner module)
 * - planned: seeded in master UI; integration scheduled (B* phases)
 * - deprecated: legacy API path; do not add new consumers
 */

export type MasterIntegrationStatus =
  | 'wired'
  | 'catalog-owned'
  | 'hardcoded'
  | 'planned'
  | 'deprecated';

export interface MasterEntityIntegration {
  entityType: string;
  groupKey: string;
  status: MasterIntegrationStatus;
  /** Primary modules / screens */
  usedBy: string[];
  notes?: string;
}

export const MASTER_ENTITY_INTEGRATIONS: MasterEntityIntegration[] = [
  // ── Patient setup ──────────────────────────────────────────────────────────
  { entityType: 'patient.title', groupKey: 'patient_setup', status: 'wired', usedBy: ['patients/new', 'MasterValuesSelect'] },
  { entityType: 'patient.blood_group', groupKey: 'patient_setup', status: 'wired', usedBy: ['patients/new'] },
  { entityType: 'patient.patient_type', groupKey: 'patient_setup', status: 'wired', usedBy: ['PaymentModeSelectionWidget', 'PatientTypeRulesPanel', 'usePaymentCoverageOptions', 'CounsellingTabPanel', 'derivePaymentType'] },
  { entityType: 'patient.gender', groupKey: 'patient_setup', status: 'wired', usedBy: ['patients/new', 'MasterValuesSelect'] },
  { entityType: 'patient.marital_status', groupKey: 'patient_setup', status: 'wired', usedBy: ['patients/new'] },
  { entityType: 'patient.religion', groupKey: 'patient_setup', status: 'wired', usedBy: ['patients/new'] },
  { entityType: 'patient.occupation', groupKey: 'patient_setup', status: 'wired', usedBy: ['patients/new'] },
  { entityType: 'patient.id_proof_type', groupKey: 'patient_setup', status: 'wired', usedBy: ['patients/new', 'MasterValuesSelect'] },
  { entityType: 'patient.relationship', groupKey: 'patient_setup', status: 'wired', usedBy: ['patients/new', 'MasterValuesSelect', 'VisitPolicyForm'] },
  { entityType: 'patient.nationality', groupKey: 'patient_setup', status: 'wired', usedBy: ['patients/new'] },

  // ── Clinical ───────────────────────────────────────────────────────────────
  {
    entityType: 'clinical.surgery_type',
    groupKey: 'clinical',
    status: 'catalog-owned',
    usedBy: ['Counsellor procedures', 'useCounsellorProcedureVariants'],
    notes: 'Labels mirrored from Service Catalog sync; prices in catalog',
  },
  {
    entityType: 'clinical.iol_catalog',
    groupKey: 'clinical',
    status: 'catalog-owned',
    usedBy: ['Counsellor IOL', 'useClinicalIolWithPricing'],
    notes: 'Synced from catalog IOL masters',
  },
  { entityType: 'clinical.anesthesia_type', groupKey: 'clinical', status: 'wired', usedBy: ['FinalizeOtModal', 'FinalizeSurgeryDrawer', 'useAnesthesiaTypeMaster'] },
  { entityType: 'clinical.surgical_procedure', groupKey: 'clinical', status: 'wired', usedBy: ['operation-theatre', 'useOtIntraOpPresets'] },
  { entityType: 'clinical.intraop_finding', groupKey: 'clinical', status: 'wired', usedBy: ['operation-theatre', 'useOtIntraOpPresets'] },
  { entityType: 'clinical.complication', groupKey: 'clinical', status: 'wired', usedBy: ['operation-theatre', 'useOtIntraOpPresets'] },
  { entityType: 'clinical.anesthesia_technique', groupKey: 'clinical', status: 'wired', usedBy: ['operation-theatre', 'useOtIntraOpPresets'] },
  { entityType: 'clinical.postop_checklist', groupKey: 'clinical', status: 'wired', usedBy: ['PostOpFollowUpWidget', 'usePostopChecklist'] },
  { entityType: 'clinical.preop_clearance', groupKey: 'clinical', status: 'wired', usedBy: ['PreOpTab RespondSectionInlineModal'] },
  { entityType: 'clinical.eye_notation', groupKey: 'clinical', status: 'wired', usedBy: ['ReferralOrdersTab'] },
  { entityType: 'clinical.scan_type', groupKey: 'clinical', status: 'wired', usedBy: ['ReferralOrdersTab'] },

  // ── Appointments ───────────────────────────────────────────────────────────
  { entityType: 'appointment.type', groupKey: 'appointments', status: 'wired', usedBy: ['AppointmentFormModal', 'UnifiedAppointmentBooking', 'appointments page'] },
  { entityType: 'appointment.consultation_type', groupKey: 'appointments', status: 'wired', usedBy: ['AppointmentFormModal', 'UnifiedAppointmentBooking'] },
  { entityType: 'appointment.priority', groupKey: 'appointments', status: 'wired', usedBy: ['WalkInBookingDialog', 'AppointmentsFilterPanel', 'appointments page'] },
  { entityType: 'appointment.cancel_reason', groupKey: 'appointments', status: 'wired', usedBy: ['AppointmentCancelDialog'] },
  { entityType: 'appointment.status', groupKey: 'appointments', status: 'wired', usedBy: ['AppointmentsFilterPanel', 'appointments page'] },

  // ── Operations (routing) ───────────────────────────────────────────────────
  { entityType: 'operations.station', groupKey: 'operations', status: 'wired', usedBy: ['frontdesk', 'CheckInModal', 'useOperationsStations'] },
  { entityType: 'operations.routing_reason', groupKey: 'operations', status: 'wired', usedBy: ['optometry queue', 'useRoutingReasons'] },
  { entityType: 'operations.service_room', groupKey: 'operations', status: 'wired', usedBy: ['optometry queue rooms API'] },

  // ── Counsellor ─────────────────────────────────────────────────────────────
  { entityType: 'counsellor.session_type', groupKey: 'counsellor', status: 'wired', usedBy: ['SessionTypeSelect', 'AddPatientModal', 'ReQueueModal', 'CounsellingTabPanel repeat start'] },
  {
    entityType: 'counsellor.surgery_package',
    groupKey: 'counsellor',
    status: 'deprecated',
    usedBy: ['Replaced by counselling_package_templates / CounsellingPackageWorkspace'],
    notes: 'Legacy master dropdown removed in counselling redesign; registry row kept for migration history only',
  },
  { entityType: 'counsellor.settings', groupKey: 'counsellor', status: 'wired', usedBy: ['CounsellingPackagesAdmin settings panel', '/counselling-package-templates/settings'] },
  { entityType: 'counselling_package_templates', groupKey: 'counsellor', status: 'wired', usedBy: ['CounsellingPackagesAdmin', 'CounsellingPackageFormDialog', 'use-counselling-packages', 'useCounsellingEstimate'] },
  { entityType: 'counsellor.callback_type', groupKey: 'counsellor', status: 'wired', usedBy: ['ContactLogModal callback scheduling'] },
  { entityType: 'counsellor.reminder_type', groupKey: 'counsellor', status: 'wired', usedBy: ['SendReminderModal'] },
  { entityType: 'counsellor.comm_channel', groupKey: 'counsellor', status: 'wired', usedBy: ['ContactLogModal', 'SendReminderModal'] },
  { entityType: 'counsellor.patient_intention', groupKey: 'counsellor', status: 'wired', usedBy: ['PatientDecisionWidget'] },

  // ── Billing ────────────────────────────────────────────────────────────────
  { entityType: 'billing.payment_mode', groupKey: 'billing_finance', status: 'wired', usedBy: ['usePaymentModes', 'CheckInModal', 'PaymentCollectionWidget', 'inventory GRN/returns'] },
  { entityType: 'billing.bill_item_type', groupKey: 'billing_finance', status: 'wired', usedBy: ['ItemizedBillingDialog', 'useBillItemTypes'] },
  { entityType: 'billing.transaction_type', groupKey: 'billing_finance', status: 'wired', usedBy: ['PaymentCollectionWidget', 'useTransactionTypes'] },

  // ── Insurance ────────────────────────────────────────────────────────────
  {
    entityType: 'insurance.provider',
    groupKey: 'insurance',
    status: 'wired',
    usedBy: [
      'patients/new',
      'CounsellingPaymentSection',
      'CoveragePreauthPanel',
      'PolicyExtractionReview',
      'CCMS payer alignment',
    ],
  },
  { entityType: 'insurance.tpa_provider', groupKey: 'insurance', status: 'wired', usedBy: ['CoveragePreauthPanel', 'VisitPolicyForm', 'useTpaProviderMaster'] },
  { entityType: 'insurance.govt_scheme', groupKey: 'insurance', status: 'wired', usedBy: ['CoveragePreauthPanel', 'useGovtSchemeMaster'] },
  { entityType: 'insurance.type', groupKey: 'insurance', status: 'wired', usedBy: ['ccms/cases', 'useInsuranceTypeMaster'] },
  { entityType: 'insurance.accommodation_class', groupKey: 'insurance', status: 'wired', usedBy: ['VisitPolicyForm'] },

  // ── Inventory ────────────────────────────────────────────────────────────
  { entityType: 'inventory.purchase_category', groupKey: 'inventory', status: 'wired', usedBy: ['GRN', 'returns', 'ExtractionGrnReview'] },
  { entityType: 'inventory.item_type', groupKey: 'inventory', status: 'wired', usedBy: ['admin/inventory/items'] },
  { entityType: 'inventory.uom', groupKey: 'inventory', status: 'wired', usedBy: ['admin/inventory/items'] },
  { entityType: 'inventory.vendor_category', groupKey: 'inventory', status: 'wired', usedBy: ['admin/inventory/vendors', 'useVendorCategories'] },
  { entityType: 'inventory.gst_rate', groupKey: 'inventory', status: 'wired', usedBy: ['admin/inventory/items'] },
  { entityType: 'inventory.storage_condition', groupKey: 'inventory', status: 'wired', usedBy: ['admin/inventory/items', 'useStorageConditions'] },
  { entityType: 'inventory.payment_term', groupKey: 'inventory', status: 'wired', usedBy: ['rfq PO modal', 'vendors banking', 'usePaymentTerms'] },

  // ── Pharmacy / Lab / Ward / HR / System ───────────────────────────────────
  { entityType: 'pharmacy.drug_form', groupKey: 'pharmacy', status: 'wired', usedBy: ['PrescriptionFormModal'] },
  { entityType: 'pharmacy.drug_route', groupKey: 'pharmacy', status: 'wired', usedBy: ['PrescriptionFormModal'] },
  { entityType: 'pharmacy.dosage_frequency', groupKey: 'pharmacy', status: 'wired', usedBy: ['PrescriptionFormModal'] },
  { entityType: 'pharmacy.drug_schedule', groupKey: 'pharmacy', status: 'wired', usedBy: ['admin/inventory/items'] },
  { entityType: 'lab.specimen_type', groupKey: 'lab_diagnostics', status: 'wired', usedBy: ['LabTestIntegrationWidget', 'useSpecimenTypes'] },
  { entityType: 'lab.imaging_modality', groupKey: 'lab_diagnostics', status: 'wired', usedBy: ['ReferralOrdersTab imaging', 'useImagingModalities'] },
  { entityType: 'lab.ep_type', groupKey: 'lab_diagnostics', status: 'wired', usedBy: ['ElectrophysiologyForm', 'useEpTypes'] },
  {
    entityType: 'lms.specimen_rejection_reason',
    groupKey: 'lab_diagnostics',
    status: 'wired',
    usedBy: ['LMS Specimen Reject (LaboratoryApi /lms/specimens/rejection-reasons)'],
  },
  { entityType: 'ward.ward_type', groupKey: 'ward_ip', status: 'wired', usedBy: ['AdmissionPlanningWidget'] },
  { entityType: 'ward.bed_type', groupKey: 'ward_ip', status: 'wired', usedBy: ['AdmissionPlanningWidget'] },
  { entityType: 'ward.admission_type', groupKey: 'ward_ip', status: 'wired', usedBy: ['PreOpTab admit form'] },
  { entityType: 'hr.employment_type', groupKey: 'hr_staff', status: 'wired', usedBy: ['admin/employees', 'useEmploymentTypes'] },
  { entityType: 'hr.qualification_type', groupKey: 'hr_staff', status: 'wired', usedBy: ['UserForm', 'useQualificationTypes'] },
  { entityType: 'hr.leave_type', groupKey: 'hr_staff', status: 'wired', usedBy: ['admin/leave', 'useLeaveTypes'] },
  { entityType: 'hr.shift_type', groupKey: 'hr_staff', status: 'wired', usedBy: ['admin/attendance', 'useShiftTypes'] },
  { entityType: 'hr.performance_rating', groupKey: 'hr_staff', status: 'wired', usedBy: ['performance-reviews/[id]', 'usePerformanceRatings'] },
  { entityType: 'hr.credential_type', groupKey: 'hr_staff', status: 'wired', usedBy: ['admin/licenses', 'useCredentialTypes'] },
  { entityType: 'system.department', groupKey: 'system', status: 'wired', usedBy: ['EnhancedDepartmentFormModal', 'admin/attendance', 'useDepartmentMaster'] },
  { entityType: 'system.timezone', groupKey: 'system', status: 'wired', usedBy: ['SystemSettingsManagement'] },
  { entityType: 'system.currency', groupKey: 'system', status: 'wired', usedBy: ['SystemSettingsManagement'] },
  { entityType: 'system.language', groupKey: 'system', status: 'wired', usedBy: ['SystemSettingsManagement'] },
  { entityType: 'system.checklist_default', groupKey: 'system', status: 'wired', usedBy: ['onboarding/[id]', 'useChecklistDefaults'] },

  // ── Non-master catalogs (documented for admin clarity) ─────────────────────
  {
    entityType: 'service_catalog.procedure_variant',
    groupKey: 'clinical',
    status: 'catalog-owned',
    usedBy: ['Counsellor procedures', 'ItemizedBilling'],
    notes: 'CRUD via /api/servicecatalog/admin/* (S2); sync-master → clinical.surgery_type',
  },
  {
    entityType: 'service_catalog.investigation',
    groupKey: 'clinical',
    status: 'catalog-owned',
    usedBy: ['Counsellor investigations', 'DIAGNOSTICS/INVESTIGATIONS categories'],
    notes: 'Sourced from Service Catalog DIAGNOSTICS + INVESTIGATIONS (B2); legacy master-catalog retired',
  },
  {
    entityType: 'optometry.exam_enums',
    groupKey: 'clinical',
    status: 'hardcoded',
    usedBy: ['AS/PS mega-tabs', 'anterior-segment-form-options.ts'],
    notes: 'Code-owned clinical enums (A3a); parity via field-parity-manifest',
  },
  { entityType: 'medical_history.chronic_condition', groupKey: 'clinical', status: 'wired', usedBy: ['medical-history-list-sections', 'useChronicConditionOptions'] },
  { entityType: 'medical_history.medication', groupKey: 'clinical', status: 'wired', usedBy: ['medical-history-list-sections', 'useMedicationOptions'] },
  { entityType: 'medical_history.surgery', groupKey: 'clinical', status: 'wired', usedBy: ['medical-history-list-sections', 'useSurgeryHistoryOptions'] },
  { entityType: 'medical_history.family_condition', groupKey: 'clinical', status: 'wired', usedBy: ['medical-history-list-sections', 'useFamilyConditionOptions'] },
  { entityType: 'medical_history.immunization', groupKey: 'clinical', status: 'wired', usedBy: ['medical-history-list-sections', 'useImmunizationOptions'] },
  { entityType: 'medical_history.medication_route', groupKey: 'clinical', status: 'wired', usedBy: ['medical-history-list-sections', 'useMedicationRouteOptions'] },
  { entityType: 'medical_history.family_relationship', groupKey: 'clinical', status: 'wired', usedBy: ['medical-history-list-sections', 'useFamilyRelationshipOptions'] },
  { entityType: 'medical_history.smoking_status', groupKey: 'clinical', status: 'wired', usedBy: ['LifestyleDisabilitySection', 'useSmokingSegmentOptions'] },
  { entityType: 'medical_history.alcohol_use', groupKey: 'clinical', status: 'wired', usedBy: ['LifestyleDisabilitySection', 'useAlcoholSegmentOptions'] },
];

/** Entity types that must have a useMasterValues('…') reference in apps/hospital-portal-web/src */
export const WIRED_MASTER_ENTITY_TYPES = MASTER_ENTITY_INTEGRATIONS.filter(
  (e) => e.status === 'wired',
).map((e) => e.entityType);

export function getMasterEntityIntegration(entityType: string): MasterEntityIntegration | undefined {
  return MASTER_ENTITY_INTEGRATIONS.find((e) => e.entityType === entityType);
}

export const MASTER_INTEGRATION_STATUS_STYLES: Record<MasterIntegrationStatus, string> = {
  wired: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'catalog-owned': 'bg-sky-50 text-sky-700 border-sky-100',
  hardcoded: 'bg-amber-50 text-amber-700 border-amber-100',
  planned: 'bg-violet-50 text-violet-700 border-violet-100',
  deprecated: 'bg-slate-100 text-slate-500 border-slate-200',
};
