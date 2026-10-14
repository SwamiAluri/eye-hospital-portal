using AuthService.Context;
using AuthService.Models.MasterData;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AuthService.Services
{
    /// <summary>
    /// Feature-flag-aware lookup wrapper for master data.
    /// When a group flag is ON → reads from master.master_value.
    /// When OFF or on error → falls back to the hardcoded static list.
    /// </summary>
    public class MasterDataLookupService : IMasterDataLookupService
    {
        private readonly AppDbContext _context;
        private readonly IFeatureFlagService _flags;
        private readonly ILogger<MasterDataLookupService> _logger;

        public MasterDataLookupService(
            AppDbContext context,
            IFeatureFlagService flags,
            ILogger<MasterDataLookupService> logger)
        {
            _context = context;
            _flags = flags;
            _logger = logger;
        }

        public async Task<IReadOnlyList<string>> GetLabelsAsync(
            Guid tenantId,
            string entityType,
            IReadOnlyList<string> fallback)
        {
            var groupKey = ResolveGroupKey(entityType);
            if (groupKey == null || !_flags.IsMasterDataGroupEnabled(groupKey))
                return fallback;

            try
            {
                var labels = await _context.MasterValues
                    .Where(v => v.TenantId == tenantId
                             && v.EntityType == entityType
                             && v.IsActive
                             && v.DeletedAt == null)
                    .OrderBy(v => v.SortOrder)
                    .ThenBy(v => v.Label)
                    .Select(v => v.Label)
                    .ToListAsync();

                if (labels.Count == 0)
                {
                    _logger.LogWarning(
                        "MasterDataLookup: no active values for {EntityType} (tenant {TenantId}), using fallback",
                        entityType, tenantId);
                    return fallback;
                }

                return labels;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "MasterDataLookup: error fetching {EntityType}, using fallback", entityType);
                return fallback;
            }
        }

        public async Task<IReadOnlyDictionary<string, string>> GetCodeLabelMapAsync(
            Guid tenantId,
            string entityType,
            IReadOnlyDictionary<string, string> fallback)
        {
            var groupKey = ResolveGroupKey(entityType);
            if (groupKey == null || !_flags.IsMasterDataGroupEnabled(groupKey))
                return fallback;

            try
            {
                var map = await _context.MasterValues
                    .Where(v => v.TenantId == tenantId
                             && v.EntityType == entityType
                             && v.IsActive
                             && v.DeletedAt == null)
                    .OrderBy(v => v.SortOrder)
                    .ThenBy(v => v.Label)
                    .ToDictionaryAsync(v => v.Code, v => v.Label);

                return map.Count > 0 ? map : fallback;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "MasterDataLookup: error fetching code-label map for {EntityType}, using fallback", entityType);
                return fallback;
            }
        }

        public async Task<IReadOnlyList<MasterValue>> GetValuesAsync(
            Guid tenantId,
            string entityType,
            IReadOnlyList<string>? labelFallback = null)
        {
            var groupKey = ResolveGroupKey(entityType);
            if (groupKey == null || !_flags.IsMasterDataGroupEnabled(groupKey))
                return [];

            try
            {
                return await _context.MasterValues
                    .Where(v => v.TenantId == tenantId
                             && v.EntityType == entityType
                             && v.IsActive
                             && v.DeletedAt == null)
                    .OrderBy(v => v.SortOrder)
                    .ThenBy(v => v.Label)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "MasterDataLookup: error fetching values for {EntityType}", entityType);
                return [];
            }
        }

        private static string? ResolveGroupKey(string entityType) =>
            EntityTypeGroupMap.TryGetValue(entityType, out var g) ? g : null;

        // Entity types aligned with master.entity_type_registry (snake_case group_key).
        private static readonly Dictionary<string, string> EntityTypeGroupMap = new(StringComparer.OrdinalIgnoreCase)
        {
            // Patient Setup
            { "patient.title",           "patient_setup" },
            { "patient.blood_group",     "patient_setup" },
            { "patient.patient_type",    "patient_setup" },
            { "patient.gender",          "patient_setup" },
            { "patient.marital_status",  "patient_setup" },
            { "patient.religion",        "patient_setup" },
            { "patient.occupation",      "patient_setup" },
            { "patient.id_proof_type",   "patient_setup" },
            { "patient.relationship",    "patient_setup" },
            { "patient.nationality",     "patient_setup" },

            // Clinical
            { "clinical.surgery_type",        "clinical" },
            { "clinical.anesthesia_type",     "clinical" },
            { "clinical.surgical_procedure",  "clinical" },
            { "clinical.intraop_finding",     "clinical" },
            { "clinical.complication",        "clinical" },
            { "clinical.anesthesia_technique","clinical" },
            { "clinical.iol_catalog",         "clinical" },
            { "clinical.postop_checklist",    "clinical" },
            { "clinical.preop_clearance",     "clinical" },
            { "clinical.eye_notation",        "clinical" },
            { "clinical.scan_type",           "clinical" },
            { "medical_history.chronic_condition",   "clinical" },
            { "medical_history.medication",          "clinical" },
            { "medical_history.surgery",             "clinical" },
            { "medical_history.family_condition",    "clinical" },
            { "medical_history.immunization",        "clinical" },
            { "medical_history.medication_route",    "clinical" },
            { "medical_history.family_relationship", "clinical" },
            { "medical_history.smoking_status",      "clinical" },
            { "medical_history.alcohol_use",         "clinical" },

            // Appointments
            { "appointment.type",             "appointments" },
            { "appointment.consultation_type","appointments" },
            { "appointment.priority",         "appointments" },
            { "appointment.cancel_reason",    "appointments" },
            { "appointment.status",           "appointments" },

            // Counsellor
            { "counsellor.session_type",    "counsellor" },
            { "counsellor.surgery_package", "counsellor" },
            { "counsellor.callback_type",   "counsellor" },
            { "counsellor.reminder_type",   "counsellor" },
            { "counsellor.comm_channel",    "counsellor" },
            { "counsellor.patient_intention","counsellor" },

            // Billing & Finance
            { "billing.payment_mode",     "billing_finance" },
            { "billing.bill_item_type",   "billing_finance" },
            { "billing.transaction_type", "billing_finance" },

            // Insurance
            { "insurance.provider",     "insurance" },
            { "insurance.tpa_provider", "insurance" },
            { "insurance.govt_scheme",  "insurance" },
            { "insurance.type",         "insurance" },
            { "insurance.accommodation_class", "insurance" },

            // Inventory
            { "inventory.item_type",         "inventory" },
            { "inventory.uom",               "inventory" },
            { "inventory.purchase_category", "inventory" },
            { "inventory.vendor_category",   "inventory" },
            { "inventory.gst_rate",          "inventory" },
            { "inventory.storage_condition", "inventory" },
            { "inventory.payment_term",      "inventory" },

            // Pharmacy
            { "pharmacy.drug_form",        "pharmacy" },
            { "pharmacy.drug_route",       "pharmacy" },
            { "pharmacy.dosage_frequency", "pharmacy" },
            { "pharmacy.drug_schedule",    "pharmacy" },

            // Lab & Diagnostics
            { "lab.specimen_type",    "lab_diagnostics" },
            { "lab.imaging_modality", "lab_diagnostics" },
            { "lab.ep_type",          "lab_diagnostics" },
            { "lms.specimen_rejection_reason", "lab_diagnostics" },

            // Ward & IP
            { "ward.ward_type",      "ward_ip" },
            { "ward.bed_type",       "ward_ip" },
            { "ward.admission_type", "ward_ip" },

            // HR & Staff
            { "hr.employment_type",    "hr_staff" },
            { "hr.qualification_type", "hr_staff" },
            { "hr.leave_type",         "hr_staff" },
            { "hr.shift_type",         "hr_staff" },
            { "hr.performance_rating", "hr_staff" },
            { "hr.credential_type",    "hr_staff" },

            // System
            { "system.department",        "system" },
            { "system.timezone",          "system" },
            { "system.currency",          "system" },
            { "system.language",          "system" },
            { "system.checklist_default", "system" },

            // Operations
            { "operations.service_room",   "operations" },
            { "operations.routing_reason", "operations" },
            { "operations.station",        "operations" },
        };
    }
}
