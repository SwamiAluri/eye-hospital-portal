using AuthService.Context;
using AuthService.Models.MasterData;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

namespace AuthService.Services
{
    public class MasterValueService : IMasterValueService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<MasterValueService> _logger;

        public MasterValueService(AppDbContext context, ILogger<MasterValueService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<List<MasterGroupDto>> GetGroupsAsync()
        {
            var registry = await _context.EntityTypeRegistries
                .OrderBy(r => r.SortOrder)
                .ToListAsync();

            return registry
                .GroupBy(r => r.GroupKey)
                .Select(g => new MasterGroupDto
                {
                    GroupKey = g.Key,
                    DisplayName = GroupDisplayName(g.Key),
                    EntityTypes = g.Select(r => new EntityTypeDto
                    {
                        EntityType = r.EntityType,
                        DisplayName = r.DisplayName,
                        TabLabel = r.TabLabel,
                        SortOrder = r.SortOrder
                    }).OrderBy(e => e.SortOrder).ToList()
                }).ToList();
        }

        public async Task<MasterValueListResponse> GetByEntityTypeAsync(Guid tenantId, string entityType, bool includeInactive = false, int page = 1, int pageSize = 50)
        {
            var registry = await _context.EntityTypeRegistries
                .FirstOrDefaultAsync(r => r.EntityType == entityType);

            var query = _context.MasterValues
                .Where(v => v.TenantId == tenantId && v.EntityType == entityType);

            if (!includeInactive)
                query = query.Where(v => v.IsActive);

            var totalCount = await query.CountAsync();

            // Clamp pagination params
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 200);

            var items = await query
                .OrderBy(v => v.SortOrder)
                .ThenBy(v => v.Label)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(v => ToDto(v))
                .ToListAsync();

            return new MasterValueListResponse
            {
                EntityType = entityType,
                DisplayName = registry?.DisplayName ?? entityType,
                Total = totalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling((double)totalCount / pageSize),
                Items = items
            };
        }

        public async Task<MasterLookupResponse> GetLookupAsync(Guid tenantId, string entityType)
        {
            var rows = await _context.MasterValues
                .Where(v => v.TenantId == tenantId
                         && v.EntityType == entityType
                         && v.IsActive
                         && v.DeletedAt == null)
                .OrderBy(v => v.SortOrder)
                .ThenBy(v => v.Label)
                .Take(500)
                .ToListAsync();

            var items = rows.Select(v =>
            {
                object? metadataObj = null;
                if (!string.IsNullOrWhiteSpace(v.Metadata) && v.Metadata != "{}")
                {
                    try { metadataObj = JsonSerializer.Deserialize<object>(v.Metadata); } catch { }
                }
                return new MasterLookupOptionDto
                {
                    Code = v.Code,
                    Label = v.Label,
                    SortOrder = v.SortOrder,
                    Metadata = metadataObj
                };
            }).ToList();

            return new MasterLookupResponse
            {
                EntityType = entityType,
                Items = items
            };
        }

        public async Task<MasterValueDto?> GetByIdAsync(Guid tenantId, Guid id)
        {
            var value = await _context.MasterValues
                .FirstOrDefaultAsync(v => v.TenantId == tenantId && v.Id == id);

            return value == null ? null : ToDto(value);
        }

        public async Task<MasterValueDto> CreateAsync(Guid tenantId, string entityType, CreateMasterValueRequest request, Guid createdByUserId)
        {
            // Determine group_key from registry
            var registry = await _context.EntityTypeRegistries
                .FirstOrDefaultAsync(r => r.EntityType == entityType)
                ?? throw new ArgumentException($"Unknown entity type: {entityType}");

            // Check code uniqueness
            var exists = await _context.MasterValues
                .AnyAsync(v => v.TenantId == tenantId && v.EntityType == entityType && v.Code == request.Code.ToUpperInvariant());
            if (exists)
                throw new InvalidOperationException($"Code '{request.Code}' already exists for entity type '{entityType}'.");

            var value = new MasterValue
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                GroupKey = registry.GroupKey,
                EntityType = entityType,
                Code = request.Code.ToUpperInvariant().Trim(),
                Label = request.Label.Trim(),
                Description = request.Description?.Trim(),
                Metadata = string.IsNullOrWhiteSpace(request.Metadata) ? "{}" : request.Metadata,
                SortOrder = request.SortOrder,
                IsActive = true,
                IsSystemLocked = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                CreatedByUserId = createdByUserId,
                UpdatedByUserId = createdByUserId
            };

            _context.MasterValues.Add(value);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Created master value {Code} for entity type {EntityType} (tenant {TenantId})",
                value.Code, entityType, tenantId);

            return ToDto(value);
        }

        public async Task<MasterValueDto> UpdateAsync(Guid tenantId, Guid id, UpdateMasterValueRequest request, Guid updatedByUserId)
        {
            var value = await _context.MasterValues
                .FirstOrDefaultAsync(v => v.TenantId == tenantId && v.Id == id)
                ?? throw new KeyNotFoundException($"Master value {id} not found.");

            value.Label = request.Label.Trim();
            value.Description = request.Description?.Trim();
            if (!IsCatalogSynced(value.Metadata) && !string.IsNullOrWhiteSpace(request.Metadata))
                value.Metadata = request.Metadata;
            if (!IsCatalogSynced(value.Metadata))
                value.SortOrder = request.SortOrder;
            value.UpdatedAt = DateTime.UtcNow;
            value.UpdatedByUserId = updatedByUserId;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Updated master value {Id} (tenant {TenantId})", id, tenantId);
            return ToDto(value);
        }

        public async Task EnableAsync(Guid tenantId, Guid id, Guid updatedByUserId)
        {
            var value = await _context.MasterValues
                .FirstOrDefaultAsync(v => v.TenantId == tenantId && v.Id == id)
                ?? throw new KeyNotFoundException($"Master value {id} not found.");

            if (IsCatalogSynced(value.Metadata))
                throw new InvalidOperationException("Catalog-synced values are enabled or disabled by the Service Catalog sync.");

            value.IsActive = true;
            value.DisabledAt = null;
            value.DisabledByUserId = null;
            value.DisabledReason = null;
            value.UpdatedAt = DateTime.UtcNow;
            value.UpdatedByUserId = updatedByUserId;
            await _context.SaveChangesAsync();
        }

        public async Task DisableAsync(Guid tenantId, Guid id, Guid updatedByUserId, string? reason = null)
        {
            var value = await _context.MasterValues
                .FirstOrDefaultAsync(v => v.TenantId == tenantId && v.Id == id)
                ?? throw new KeyNotFoundException($"Master value {id} not found.");

            if (IsCatalogSynced(value.Metadata))
                throw new InvalidOperationException("Catalog-synced values are enabled or disabled by the Service Catalog sync.");

            value.IsActive = false;
            value.DisabledAt = DateTime.UtcNow;
            value.DisabledByUserId = updatedByUserId;
            value.DisabledReason = reason?.Trim();
            value.UpdatedAt = DateTime.UtcNow;
            value.UpdatedByUserId = updatedByUserId;
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(Guid tenantId, Guid id, Guid deletedByUserId)
        {
            var value = await _context.MasterValues
                .FirstOrDefaultAsync(v => v.TenantId == tenantId && v.Id == id)
                ?? throw new KeyNotFoundException($"Master value {id} not found.");

            if (value.IsSystemLocked)
                throw new InvalidOperationException($"Cannot delete system-locked master value '{value.Code}'.");

            value.DeletedAt = DateTime.UtcNow;
            value.UpdatedAt = DateTime.UtcNow;
            value.UpdatedByUserId = deletedByUserId;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Soft-deleted master value {Id} (tenant {TenantId})", id, tenantId);
        }

        public async Task SeedDefaultsForTenantAsync(Guid tenantId, Guid createdByUserId)
        {
            _logger.LogInformation("Seeding default master values for tenant {TenantId}", tenantId);

            await _context.Database.ExecuteSqlRawAsync(
                $"SELECT set_config('app.current_tenant_id', '{tenantId}', false)");

            // Get entity types already seeded for this tenant to avoid duplicates
            var seededTypes = await _context.MasterValues
                .Where(v => v.TenantId == tenantId)
                .Select(v => v.EntityType)
                .Distinct()
                .ToListAsync();

            var defaults = GetDefaultSeedValues(tenantId, createdByUserId);

            // Only insert entity types that have no existing values for this tenant
            var toInsert = defaults
                .Where(d => !seededTypes.Contains(d.EntityType))
                .ToList();

            if (toInsert.Count == 0)
            {
                _logger.LogInformation("All entity types already seeded for tenant {TenantId} - no changes needed", tenantId);
                return;
            }

            _logger.LogInformation("Adding {Count} master values for tenant {TenantId}", toInsert.Count, tenantId);
            _context.MasterValues.AddRange(toInsert);
            await _context.SaveChangesAsync();
        }

        // ─── Helpers ────────────────────────────────────────────────────────────

        public async Task<List<MasterEntityTypeStatsDto>> GetGroupStatsAsync(Guid tenantId, string groupKey)
        {
            var valueStats = await _context.MasterValues
                .Where(v => v.TenantId == tenantId && v.GroupKey == groupKey)
                .GroupBy(v => v.EntityType)
                .Select(g => new
                {
                    EntityType = g.Key,
                    Total = g.Count(),
                    Active = g.Count(v => v.IsActive),
                    Disabled = g.Count(v => !v.IsActive),
                    SystemLocked = g.Count(v => v.IsSystemLocked)
                })
                .ToListAsync();

            var statsByType = valueStats.ToDictionary(s => s.EntityType, s => s);

            // Include all registry types (zero counts when not yet seeded)
            var registry = await _context.EntityTypeRegistries
                .Where(r => r.GroupKey == groupKey)
                .OrderBy(r => r.SortOrder)
                .ToListAsync();

            return registry.Select(r =>
            {
                statsByType.TryGetValue(r.EntityType, out var s);
                return new MasterEntityTypeStatsDto
                {
                    EntityType = r.EntityType,
                    DisplayName = r.DisplayName,
                    Total = s?.Total ?? 0,
                    Active = s?.Active ?? 0,
                    Disabled = s?.Disabled ?? 0,
                    SystemLocked = s?.SystemLocked ?? 0
                };
            }).ToList();
        }

        private static MasterValueDto ToDto(MasterValue v)
        {
            object? metadataObj = null;
            if (!string.IsNullOrWhiteSpace(v.Metadata) && v.Metadata != "{}")
            {
                try { metadataObj = JsonSerializer.Deserialize<object>(v.Metadata); } catch { }
            }

            return new MasterValueDto
            {
                Id = v.Id,
                EntityType = v.EntityType,
                GroupKey = v.GroupKey,
                Code = v.Code,
                Label = v.Label,
                Description = v.Description,
                Metadata = metadataObj,
                SortOrder = v.SortOrder,
                IsActive = v.IsActive,
                IsSystemLocked = v.IsSystemLocked,
                DisabledAt = v.DisabledAt,
                DisabledReason = v.DisabledReason,
                CreatedAt = v.CreatedAt,
                UpdatedAt = v.UpdatedAt
            };
        }

        private static bool IsCatalogSynced(string metadataJson)
        {
            try
            {
                var node = JsonNode.Parse(metadataJson);
                return node?["syncedFromCatalog"]?.GetValue<bool>() == true;
            }
            catch
            {
                return false;
            }
        }

        private static string GroupDisplayName(string groupKey) => groupKey switch
        {
            "patient_setup"    => "Patient Setup",
            "clinical"         => "Clinical",
            "appointments"     => "Appointments",
            "counsellor"       => "Counsellor",
            "billing_finance"  => "Billing & Finance",
            "insurance"        => "Insurance",
            "inventory"        => "Inventory",
            "pharmacy"         => "Pharmacy",
            "lab_diagnostics"  => "Lab & Diagnostics",
            "ward_ip"          => "Ward & IP",
            "hr_staff"         => "HR & Staff",
            "system"           => "System",
            "operations"       => "Operations",
            _                  => groupKey
        };

        private static List<MasterValue> GetDefaultSeedValues(Guid tenantId, Guid createdByUserId)
        {
            var now = DateTime.UtcNow;
            const string EyeMeta = "{\"isEyeRelevant\":true}";

            MasterValue Make(string group, string type, string code, string label,
                int sort = 0, bool locked = false, string metadata = "{}") =>
                new MasterValue
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    GroupKey = group,
                    EntityType = type,
                    Code = code,
                    Label = label,
                    SortOrder = sort,
                    IsSystemLocked = locked,
                    Metadata = metadata,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                    CreatedByUserId = createdByUserId,
                    UpdatedByUserId = createdByUserId
                };

            return new List<MasterValue>
            {
                // ── Patient Setup ───────────────────────────────────────────────
                Make("patient_setup","patient.title","MR","Mr.",1),
                Make("patient_setup","patient.title","MRS","Mrs.",2),
                Make("patient_setup","patient.title","MS","Ms.",3),
                Make("patient_setup","patient.title","DR","Dr.",4),
                Make("patient_setup","patient.title","PROF","Prof.",5),
                Make("patient_setup","patient.title","BABY","Baby",6),
                Make("patient_setup","patient.title","MASTER","Master",7),

                Make("patient_setup","patient.blood_group","A_POS","A+",1,true),
                Make("patient_setup","patient.blood_group","A_NEG","A-",2,true),
                Make("patient_setup","patient.blood_group","B_POS","B+",3,true),
                Make("patient_setup","patient.blood_group","B_NEG","B-",4,true),
                Make("patient_setup","patient.blood_group","AB_POS","AB+",5,true),
                Make("patient_setup","patient.blood_group","AB_NEG","AB-",6,true),
                Make("patient_setup","patient.blood_group","O_POS","O+",7,true),
                Make("patient_setup","patient.blood_group","O_NEG","O-",8,true),
                Make("patient_setup","patient.blood_group","UNKNOWN","Unknown",9,true),

                Make("patient_setup","patient.patient_type","CASH","Cash",1,false,@"{""legacyPatientType"":""Cash"",""description"":""Direct payment by patient"",""category"":""direct"",""requiresAdvancePayment"":true,""advancePercentage"":50,""requiredDocuments"":[""ID Proof"",""Address Proof""]}"),
                Make("patient_setup","patient.patient_type","INSURANCE","Insurance",2,false,@"{""legacyPatientType"":""Insurance"",""description"":""Insurance company cashless treatment"",""category"":""direct"",""requiresPreApproval"":true,""requiredDocuments"":[""Insurance Card"",""Policy Document"",""ID Proof"",""Employer Letter""],""zeroAdvancePayment"":true}"),
                Make("patient_setup","patient.patient_type","COPAY","Co-Pay",3,false,@"{""legacyPatientType"":""CoPay"",""description"":""Insurance with patient co-payment"",""category"":""direct"",""requiresPreApproval"":true,""requiredDocuments"":[""Insurance Card"",""ID Proof""]}"),
                Make("patient_setup","patient.patient_type","ESH","ESH",4,false,@"{""legacyPatientType"":""ESH"",""description"":""ESH government scheme"",""category"":""government"",""requiresPreApproval"":true,""requiredDocuments"":[""ESH Card"",""Employee ID"",""Salary Slip""],""zeroAdvancePayment"":true}"),
                Make("patient_setup","patient.patient_type","CGHS","CGHS",5,false,@"{""legacyPatientType"":""CGHS"",""description"":""CGHS government scheme"",""category"":""government"",""requiresPreApproval"":true,""requiredDocuments"":[""CGHS Card"",""Referral from CGHS Dispensary""],""zeroAdvancePayment"":true}"),
                Make("patient_setup","patient.patient_type","AROGYASHREE","Arogyashree",6,false,@"{""legacyPatientType"":""Arograshree"",""description"":""Karnataka state health scheme for BPL families"",""category"":""government"",""requiresPreApproval"":true,""requiredDocuments"":[""Income Certificate"",""Ration Card"",""ID Proof""],""zeroAdvancePayment"":true}"),
                Make("patient_setup","patient.patient_type","SGHS","SGHS",7,false,@"{""legacyPatientType"":""SGHS"",""description"":""State government employee health scheme"",""category"":""government"",""requiresPreApproval"":true,""requiredDocuments"":[""SGHS Card"",""Employee ID""],""zeroAdvancePayment"":true}"),
                Make("patient_setup","patient.patient_type","CAMP","Camp",8,false,@"{""legacyPatientType"":""Camp"",""description"":""Free surgery camp sponsored by NGO/CSR"",""category"":""special"",""requiredDocuments"":[""Camp Registration Form"",""Income Certificate""],""zeroAdvancePayment"":true}"),
                Make("patient_setup","patient.patient_type","RAILWAY","Railway",9,false,@"{""legacyPatientType"":""Railway"",""description"":""Railway employee health scheme (RELHS)"",""category"":""government"",""zeroAdvancePayment"":true,""requiredDocuments"":[]}"),
                Make("patient_setup","patient.patient_type","FREE","Free / Charity",10,false,@"{""legacyPatientType"":""Free"",""description"":""Free treatment — charity or sponsored case"",""category"":""special"",""zeroAdvancePayment"":true,""requiredDocuments"":[]}"),
                Make("patient_setup","patient.patient_type","TPA","TPA",11,false,@"{""legacyPatientType"":""TPA"",""description"":""Third-party administrator cashless"",""category"":""direct"",""requiresPreApproval"":true,""requiredDocuments"":[""Insurance Card"",""ID Proof""],""zeroAdvancePayment"":true}"),

                Make("patient_setup","patient.gender","MALE","Male",1,true),
                Make("patient_setup","patient.gender","FEMALE","Female",2,true),
                Make("patient_setup","patient.gender","OTHER","Other",3,true),

                Make("patient_setup","patient.marital_status","SINGLE","Single",1),
                Make("patient_setup","patient.marital_status","MARRIED","Married",2),
                Make("patient_setup","patient.marital_status","DIVORCED","Divorced",3),
                Make("patient_setup","patient.marital_status","WIDOWED","Widowed",4),
                Make("patient_setup","patient.marital_status","SEPARATED","Separated",5),

                Make("patient_setup","patient.religion","HINDU","Hindu",1),
                Make("patient_setup","patient.religion","MUSLIM","Muslim",2),
                Make("patient_setup","patient.religion","CHRISTIAN","Christian",3),
                Make("patient_setup","patient.religion","SIKH","Sikh",4),
                Make("patient_setup","patient.religion","BUDDHIST","Buddhist",5),
                Make("patient_setup","patient.religion","JAIN","Jain",6),
                Make("patient_setup","patient.religion","OTHER","Other",7),

                Make("patient_setup","patient.id_proof_type","AADHAAR","Aadhaar Card",1),
                Make("patient_setup","patient.id_proof_type","PAN","PAN Card",2),
                Make("patient_setup","patient.id_proof_type","PASSPORT","Passport",3),
                Make("patient_setup","patient.id_proof_type","VOTER_ID","Voter ID",4),
                Make("patient_setup","patient.id_proof_type","DL","Driving License",5),
                Make("patient_setup","patient.id_proof_type","EMPLOYEE_ID","Employee ID",6),
                Make("patient_setup","patient.id_proof_type","CGHS_CARD","CGHS Card",7),

                Make("patient_setup","patient.relationship","SELF","Self",1),
                Make("patient_setup","patient.relationship","SPOUSE","Spouse",2),
                Make("patient_setup","patient.relationship","CHILD","Child",3),
                Make("patient_setup","patient.relationship","PARENT","Parent",4),
                Make("patient_setup","patient.relationship","SIBLING","Sibling",5),
                Make("patient_setup","patient.relationship","GUARDIAN","Guardian",6),
                Make("patient_setup","patient.relationship","OTHER","Other",7),

                Make("patient_setup","patient.nationality","INDIAN","Indian",1),
                Make("patient_setup","patient.nationality","NRI","NRI",2),
                Make("patient_setup","patient.nationality","FOREIGNER","Foreigner",3),

                Make("patient_setup","patient.occupation","EMPLOYED","Employed",1),
                Make("patient_setup","patient.occupation","SELF_EMP","Self-Employed",2),
                Make("patient_setup","patient.occupation","BUSINESS","Business",3),
                Make("patient_setup","patient.occupation","STUDENT","Student",4),
                Make("patient_setup","patient.occupation","HOMEMAKER","Homemaker",5),
                Make("patient_setup","patient.occupation","RETIRED","Retired",6),
                Make("patient_setup","patient.occupation","FARMER","Farmer",7),
                Make("patient_setup","patient.occupation","PROFESSIONAL","Professional",8),
                Make("patient_setup","patient.occupation","UNEMPLOYED","Unemployed",9),
                Make("patient_setup","patient.occupation","OTHER","Other",10),

                // ── Clinical (surgery_type + iol_catalog seeded via Service Catalog sync) ──

                Make("clinical","clinical.anesthesia_type","TOPICAL","Topical",1,false,@"{""category"":""Topical""}"),
                Make("clinical","clinical.anesthesia_type","LOCAL","Local Infiltration",2,false,@"{""category"":""Local""}"),
                Make("clinical","clinical.anesthesia_type","PERIBULBAR","Peribulbar Block",3,false,@"{""category"":""Regional""}"),
                Make("clinical","clinical.anesthesia_type","RETROBULBAR","Retrobulbar Block",4,false,@"{""category"":""Regional""}"),
                Make("clinical","clinical.anesthesia_type","GENERAL","General Anesthesia",5,false,@"{""category"":""General""}"),
                Make("clinical","clinical.anesthesia_type","SEDATION","Conscious Sedation",6,false,@"{""category"":""Combined""}"),

                Make("clinical","clinical.surgical_procedure","PHACO_FOLDABLE","Phaco + Foldable IOL",1),
                Make("clinical","clinical.surgical_procedure","PHACO_RIGID","Phaco + Rigid IOL",2),
                Make("clinical","clinical.surgical_procedure","SICS_IOL","SICS + IOL",3),
                Make("clinical","clinical.surgical_procedure","TRABECULECTOMY","Trabeculectomy with MMC",4),
                Make("clinical","clinical.surgical_procedure","VITRECTOMY_23G","23G Vitrectomy",5),
                Make("clinical","clinical.surgical_procedure","VITRECTOMY_25G","25G Vitrectomy",6),
                Make("clinical","clinical.surgical_procedure","LASER_ENDO","Endolaser Photocoagulation",7),
                Make("clinical","clinical.surgical_procedure","SF6_GAS","SF6 Gas Tamponade",8),
                Make("clinical","clinical.surgical_procedure","C3F8_GAS","C3F8 Gas Tamponade",9),
                Make("clinical","clinical.surgical_procedure","SILICON_OIL","Silicon Oil Injection",10),

                Make("clinical","clinical.intraop_finding","POSTERIOR_CAP_RUPTURE","Posterior Capsule Rupture",1),
                Make("clinical","clinical.intraop_finding","VITREOUS_LOSS","Vitreous Loss",2),
                Make("clinical","clinical.intraop_finding","DROPPED_NUCLEUS","Dropped Nucleus",3),
                Make("clinical","clinical.intraop_finding","IRIS_PROLAPSE","Iris Prolapse",4),
                Make("clinical","clinical.intraop_finding","CORNEAL_EDEMA","Corneal Edema",5),
                Make("clinical","clinical.intraop_finding","DENSE_NUCLEUS","Dense Nucleus",6),
                Make("clinical","clinical.intraop_finding","ZONULAR_WEAKNESS","Zonular Weakness",7),
                Make("clinical","clinical.intraop_finding","SMALL_PUPIL","Small Pupil",8),
                Make("clinical","clinical.intraop_finding","BLEEDING","Intra-op Bleeding",9),
                Make("clinical","clinical.intraop_finding","NORMAL","Normal Procedure",10),

                Make("clinical","clinical.complication","NONE","None",1),
                Make("clinical","clinical.complication","ENDOPHTHALMITIS","Endophthalmitis",2),
                Make("clinical","clinical.complication","RETINAL_DETACH","Retinal Detachment",3),
                Make("clinical","clinical.complication","ELEVATED_IOP","Elevated IOP",4),
                Make("clinical","clinical.complication","WOUND_LEAK","Wound Leak",5),
                Make("clinical","clinical.complication","HYPHEMA","Hyphema",6),
                Make("clinical","clinical.complication","IOL_DISLOCATION","IOL Dislocation",7),
                Make("clinical","clinical.complication","UVEITIS","Post-op Uveitis",8),
                Make("clinical","clinical.complication","CME","Cystoid Macular Edema (CME)",9),
                Make("clinical","clinical.complication","REFRACTIVE_ERROR","Significant Refractive Error",10),

                Make("clinical","clinical.anesthesia_technique","TOPICAL_ONLY","Topical Only",1),
                Make("clinical","clinical.anesthesia_technique","PERIBULBAR","Peribulbar Block",2),
                Make("clinical","clinical.anesthesia_technique","RETROBULBAR","Retrobulbar Block",3),
                Make("clinical","clinical.anesthesia_technique","GA","General Anesthesia",4),
                Make("clinical","clinical.anesthesia_technique","SEDATION_TOPICAL","Sedation + Topical",5),

                Make("clinical","clinical.postop_checklist","VITALS_STABLE","Vitals Stable",1),
                Make("clinical","clinical.postop_checklist","EYE_PADDED","Eye Padded",2),
                Make("clinical","clinical.postop_checklist","MEDICATION_GIVEN","Medication Given",3),
                Make("clinical","clinical.postop_checklist","DIET_ADVISED","Diet Advice Given",4),
                Make("clinical","clinical.postop_checklist","DISCHARGE_NOTE","Discharge Note Issued",5),
                Make("clinical","clinical.postop_checklist","FOLLOW_SCHEDULED","Follow-Up Appointment Set",6),

                Make("clinical","clinical.preop_clearance","FIT_FOR_LA","Fit for Local Anesthesia",1),
                Make("clinical","clinical.preop_clearance","FIT_FOR_GA","Fit for General Anesthesia",2),
                Make("clinical","clinical.preop_clearance","CONDITIONAL","Conditional Clearance",3),
                Make("clinical","clinical.preop_clearance","DEFERRED","Deferred - Pending Tests",4),
                Make("clinical","clinical.preop_clearance","NOT_FIT","Not Fit for Surgery",5),

                Make("clinical","clinical.eye_notation","OD","OD (Right Eye)",1,true),
                Make("clinical","clinical.eye_notation","OS","OS (Left Eye)",2,true),
                Make("clinical","clinical.eye_notation","OU","OU (Both Eyes)",3,true),
                Make("clinical","clinical.eye_notation","OD_OS","OD/OS",4,true),

                Make("clinical","clinical.scan_type","OCT","OCT (Optical Coherence Tomography)",1),
                Make("clinical","clinical.scan_type","FUNDUS","Fundus Photography",2),
                Make("clinical","clinical.scan_type","FLUORESCEIN","Fluorescein Angiography",3),
                Make("clinical","clinical.scan_type","BIOMETRY","Biometry (IOL Master)",4),
                Make("clinical","clinical.scan_type","TOPOGRAPHY","Corneal Topography",5),
                Make("clinical","clinical.scan_type","ULTRASOUND","B-Scan Ultrasound",6),
                Make("clinical","clinical.scan_type","VF","Visual Field Test",7),
                Make("clinical","clinical.scan_type","ERG","Electroretinography (ERG)",8),
                Make("clinical","clinical.scan_type","VEP","Visual Evoked Potential (VEP)",9),

                // HPI template categories (pills in metadata)
                Make("clinical","clinical.hpi_category","onset","Onset",1,false,@"{""pills"":[""Sudden"",""Gradual"",""Since childhood"",""Since yesterday"",""Since weeks"",""Since months""]}"),
                Make("clinical","clinical.hpi_category","duration","Duration",2,false,@"{""pills"":[""Hours"",""Days"",""Weeks"",""Months"",""Years"",""Intermittent""]}"),
                Make("clinical","clinical.hpi_category","quality","Quality",3,false,@"{""pills"":[""Blurring"",""Pain"",""Redness"",""Discharge"",""Floaters"",""Flashes"",""Diplopia""]}"),
                Make("clinical","clinical.hpi_category","severity","Severity",4,false,@"{""pills"":[""Mild"",""Moderate"",""Severe"",""Worse in morning"",""Worse in evening""]}"),
                Make("clinical","clinical.hpi_category","timing","Timing",5,false,@"{""pills"":[""Constant"",""Intermittent"",""Progressive"",""Stable"",""Improving""]}"),
                Make("clinical","clinical.hpi_category","context","Context",6,false,@"{""pills"":[""After trauma"",""Post-surgery"",""After screen use"",""After injury"",""No trigger""]}"),
                Make("clinical","clinical.hpi_category","modifiers","Modifying factors",7,false,@"{""pills"":[""Better with rest"",""Worse with reading"",""Relieved by drops"",""Not relieved by OTC""]}"),
                Make("clinical","clinical.hpi_category","associated","Associated symptoms",8,false,@"{""pills"":[""Headache"",""Nausea"",""Photophobia"",""Lacrimation"",""Halos"",""Night blindness""]}"),

                // PE quick-note templates
                Make("clinical","clinical.pe_template","anterior","Anterior Segment",1,false,@"{""sections"":[""Lids"",""Conjunctiva"",""Cornea"",""AC"",""Iris"",""Lens""]}"),
                Make("clinical","clinical.pe_template","posterior","Posterior Segment",2,false,@"{""sections"":[""Vitreous"",""Disc"",""Macula"",""Vessels"",""Periphery""]}"),

                // ── Appointments ─────────────────────────────────────────────────
                Make("appointments","appointment.type","OPD","OPD Consultation",1),
                Make("appointments","appointment.type","REVIEW","Review",2),
                Make("appointments","appointment.type","SURGERY","Surgery",3),
                Make("appointments","appointment.type","CAMP","Camp",4),
                Make("appointments","appointment.type","TELECONSULT","Tele-Consultation",5),

                Make("appointments","appointment.consultation_type","FIRST_VISIT","First Visit",1),
                Make("appointments","appointment.consultation_type","FOLLOW_UP","Follow-Up",2),
                Make("appointments","appointment.consultation_type","POST_OP","Post-Op",3),
                Make("appointments","appointment.consultation_type","EMERGENCY","Emergency",4),
                Make("appointments","appointment.consultation_type","SECOND_OPINION","Second Opinion",5),

                Make("appointments","appointment.priority","ROUTINE","Routine",1),
                Make("appointments","appointment.priority","URGENT","Urgent",2),
                Make("appointments","appointment.priority","EMERGENCY","Emergency",3),

                Make("appointments","appointment.cancel_reason","PATIENT_REQUEST","Patient Request",1),
                Make("appointments","appointment.cancel_reason","DOCTOR_UNAVAIL","Doctor Unavailable",2),
                Make("appointments","appointment.cancel_reason","NO_SHOW","No Show",3),
                Make("appointments","appointment.cancel_reason","DUPLICATE","Duplicate Appointment",4),
                Make("appointments","appointment.cancel_reason","RESCHEDULED","Rescheduled",5),
                Make("appointments","appointment.cancel_reason","OTHER","Other",6),

                Make("appointments","appointment.status","scheduled","Scheduled",1,false,@"{""color"":""blue""}"),
                Make("appointments","appointment.status","confirmed","Confirmed",2,false,@"{""color"":""green""}"),
                Make("appointments","appointment.status","in-progress","In Progress",3,false,@"{""color"":""yellow""}"),
                Make("appointments","appointment.status","completed","Completed",4,false,@"{""color"":""gray""}"),
                Make("appointments","appointment.status","cancelled","Cancelled",5,false,@"{""color"":""red""}"),
                Make("appointments","appointment.status","no-show","No Show",6,false,@"{""color"":""red""}"),

                // ── Operations (OPD routing) ───────────────────────────────────
                Make("operations","operations.routing_reason","INITIAL_REFRACTION","Initial refraction",1),
                Make("operations","operations.routing_reason","POST_INVESTIGATION","Post-investigation",2),
                Make("operations","operations.routing_reason","DOCTOR_REQUESTED","Doctor requested",3),
                Make("operations","operations.routing_reason","PRE_SURGERY_MEASUREMENT","Pre-surgery measurement",4),
                Make("operations","operations.routing_reason","COUNSELLOR_REFRACTION","Counsellor refraction",5),
                Make("operations","operations.routing_reason","OPTICAL_DISPENSING","Optical dispensing",6),

                Make("operations","operations.station","reception","Reception",1,false,@"{""routableFromFrontdesk"":false}"),
                Make("operations","operations.station","optometrist","Optometrist",2,false,@"{""routableFromFrontdesk"":true}"),
                Make("operations","operations.station","doctor","Doctor",3,false,@"{""routableFromFrontdesk"":true}"),
                Make("operations","operations.station","counselor","Counsellor",4,false,@"{""routableFromFrontdesk"":true}"),
                Make("operations","operations.station","imaging","Imaging",5,false,@"{""routableFromFrontdesk"":false}"),
                Make("operations","operations.station","billing","Billing",6,false,@"{""routableFromFrontdesk"":false}"),
                Make("operations","operations.station","pharmacy","Pharmacy",7,false,@"{""routableFromFrontdesk"":false}"),
                Make("operations","operations.station","optical","Optical",8,false,@"{""routableFromFrontdesk"":false}"),
                Make("operations","operations.station","completed","Completed",9,false,@"{""routableFromFrontdesk"":false}"),

                // ── Counsellor ───────────────────────────────────────────────────
                Make("counsellor","counsellor.session_type","INITIAL","Initial Counseling",1),
                Make("counsellor","counsellor.session_type","FOLLOW_UP","Follow-Up",2),
                Make("counsellor","counsellor.session_type","PRE_OP","Pre-Op Counseling",3),
                Make("counsellor","counsellor.session_type","POST_OP","Post-Op Counseling",4),
                Make("counsellor","counsellor.session_type","PACKAGE","Package Finalization",5),

                Make("counsellor","counsellor.surgery_package","BASIC","Basic Package",1),
                Make("counsellor","counsellor.surgery_package","STANDARD","Standard Package",2),
                Make("counsellor","counsellor.surgery_package","PREMIUM","Premium Package",3),
                Make("counsellor","counsellor.surgery_package","CORPORATE","Corporate Package",4),
                Make("counsellor","counsellor.surgery_package","GOVT","Government Scheme",5),

                Make("counsellor","counsellor.callback_type","SCHEDULED","Scheduled Callback",1),
                Make("counsellor","counsellor.callback_type","REMINDER","Reminder Call",2),
                Make("counsellor","counsellor.callback_type","FOLLOW_UP","Follow-Up Call",3),
                Make("counsellor","counsellor.callback_type","NO_SHOW","No-Show Follow-Up",4),
                Make("counsellor","counsellor.callback_type","URGENT","Urgent Callback",5),

                Make("counsellor","counsellor.reminder_type","PRE_OP_DAY","Pre-Op Day Reminder",1),
                Make("counsellor","counsellor.reminder_type","APPOINTMENT","Appointment Reminder",2),
                Make("counsellor","counsellor.reminder_type","FOLLOW_UP","Follow-Up Reminder",3),
                Make("counsellor","counsellor.reminder_type","PAYMENT_DUE","Payment Due Reminder",4),
                Make("counsellor","counsellor.reminder_type","RESULT_READY","Result Ready",5),

                Make("counsellor","counsellor.comm_channel","PHONE","Phone Call",1),
                Make("counsellor","counsellor.comm_channel","SMS","SMS",2),
                Make("counsellor","counsellor.comm_channel","WHATSAPP","WhatsApp",3),
                Make("counsellor","counsellor.comm_channel","EMAIL","Email",4),
                Make("counsellor","counsellor.comm_channel","IN_PERSON","In Person",5),

                Make("counsellor","counsellor.patient_intention","WillingNow","Ready Now — Schedule Today",1,false,@"{""category"":""willing""}"),
                Make("counsellor","counsellor.patient_intention","WillingWeek","Within 1 Week",2,false,@"{""category"":""willing""}"),
                Make("counsellor","counsellor.patient_intention","WillingTwoWeeks","Within 2 Weeks",3,false,@"{""category"":""willing""}"),
                Make("counsellor","counsellor.patient_intention","WillingMonth","Within 1 Month",4,false,@"{""category"":""willing""}"),
                Make("counsellor","counsellor.patient_intention","WillingQuarter","Within 3 Months",5,false,@"{""category"":""willing""}"),
                Make("counsellor","counsellor.patient_intention","WillingSixMonths","After 6 Months",6,false,@"{""category"":""willing""}"),
                Make("counsellor","counsellor.patient_intention","WillingCallToConfirm","Will Call to Confirm",7,false,@"{""category"":""willing""}"),
                Make("counsellor","counsellor.patient_intention","Undecided","Undecided",8,false,@"{""category"":""not_ready""}"),
                Make("counsellor","counsellor.patient_intention","WaitingFinancial","Financial Hold",9,false,@"{""category"":""not_ready""}"),
                Make("counsellor","counsellor.patient_intention","WaitingFear","Fear / Hesitant",10,false,@"{""category"":""not_ready""}"),
                Make("counsellor","counsellor.patient_intention","SecondOpinion","Second Opinion",11,false,@"{""category"":""not_ready""}"),
                Make("counsellor","counsellor.patient_intention","Declined","Declined Surgery",12,false,@"{""category"":""not_ready""}"),
                Make("counsellor","counsellor.patient_intention","ReferredElsewhere","Referred Elsewhere",13,false,@"{""category"":""not_ready""}"),

                // ── Billing & Finance ────────────────────────────────────────────
                Make("billing_finance","billing.payment_mode","CASH","Cash",1),
                Make("billing_finance","billing.payment_mode","CREDIT","Credit",2),
                Make("billing_finance","billing.payment_mode","CARD","Card (Debit/Credit)",3),
                Make("billing_finance","billing.payment_mode","UPI","UPI",4),
                Make("billing_finance","billing.payment_mode","NEFT","NEFT",5),
                Make("billing_finance","billing.payment_mode","RTGS","RTGS",6),
                Make("billing_finance","billing.payment_mode","CHEQUE","Cheque",7),
                Make("billing_finance","billing.payment_mode","INSURANCE","Insurance",8),
                Make("billing_finance","billing.payment_mode","DD","Demand Draft",9),
                Make("billing_finance","billing.payment_mode","ONLINE","Online Transfer",10),

                Make("billing_finance","billing.bill_item_type","CONSULTATION","Consultation Fee",1),
                Make("billing_finance","billing.bill_item_type","PROCEDURE","Procedure",2),
                Make("billing_finance","billing.bill_item_type","MEDICATION","Medication",3),
                Make("billing_finance","billing.bill_item_type","DIAGNOSTIC","Diagnostic Test",4),
                Make("billing_finance","billing.bill_item_type","ROOM_CHARGE","Room Charge",5),
                Make("billing_finance","billing.bill_item_type","NURSING","Nursing Charge",6),
                Make("billing_finance","billing.bill_item_type","SURGICAL","Surgical Charge",7),
                Make("billing_finance","billing.bill_item_type","ANESTHESIA","Anesthesia Charge",8),
                Make("billing_finance","billing.bill_item_type","MISC","Miscellaneous",9),

                Make("billing_finance","billing.transaction_type","PAYMENT","Payment",1),
                Make("billing_finance","billing.transaction_type","ADVANCE","Advance",2),
                Make("billing_finance","billing.transaction_type","REFUND","Refund",3),
                Make("billing_finance","billing.transaction_type","DISCOUNT","Discount",4),
                Make("billing_finance","billing.transaction_type","WRITE_OFF","Write-Off",5),

                // ── Insurance ─────────────────────────────────────────────────────
                Make("insurance","insurance.provider","STAR_HEALTH","Star Health Insurance",1,false,@"{""type"":""private""}"),
                Make("insurance","insurance.provider","NEW_INDIA","New India Assurance",2,false,@"{""type"":""public""}"),
                Make("insurance","insurance.provider","ICICI_LOMBARD","ICICI Lombard",3,false,@"{""type"":""private""}"),
                Make("insurance","insurance.provider","HDFC_ERGO","HDFC Ergo",4,false,@"{""type"":""private""}"),
                Make("insurance","insurance.provider","BAJAJ_ALLIANZ","Bajaj Allianz",5,false,@"{""type"":""private""}"),
                Make("insurance","insurance.provider","ORIENTAL","Oriental Insurance",6,false,@"{""type"":""public""}"),
                Make("insurance","insurance.provider","NATIONAL","National Insurance",7,false,@"{""type"":""public""}"),
                Make("insurance","insurance.provider","UNITED_INDIA","United India Insurance",8,false,@"{""type"":""public""}"),

                Make("insurance","insurance.tpa_provider","MEDI_ASSIST","Medi Assist",1),
                Make("insurance","insurance.tpa_provider","VIDAL_HEALTH","Vidal Health TPA",2),
                Make("insurance","insurance.tpa_provider","PARAMOUNT","Paramount Health",3),
                Make("insurance","insurance.tpa_provider","GOOD_HEALTH","Good Health TPA",4),
                Make("insurance","insurance.tpa_provider","HEALTH_INDIA","Health India TPA",5),
                Make("insurance","insurance.tpa_provider","FAMILY_HEALTH","Family Health Plan",6),
                Make("insurance","insurance.tpa_provider","ERICSON","Ericson TPA",7),

                Make("insurance","insurance.govt_scheme","CGHS","CGHS",1),
                Make("insurance","insurance.govt_scheme","ECHS","ECHS (Ex-Servicemen)",2),
                Make("insurance","insurance.govt_scheme","PMJAY","PM-JAY (Ayushman Bharat)",3),
                Make("insurance","insurance.govt_scheme","ESI","ESI Scheme",4),
                Make("insurance","insurance.govt_scheme","AROGYASHREE","Arogyashree",5),
                Make("insurance","insurance.govt_scheme","SGHS","State Govt Health Scheme",6),

                Make("insurance","insurance.type","MEDICLAIM","Mediclaim",1,false,@"{""isCashless"":false}"),
                Make("insurance","insurance.type","CASHLESS","Cashless",2,false,@"{""isCashless"":true}"),
                Make("insurance","insurance.type","REIMBURSEMENT","Reimbursement",3,false,@"{""isCashless"":false}"),
                Make("insurance","insurance.type","COPAY","Co-Payment",4,false,@"{""isCashless"":true}"),
                Make("insurance","insurance.type","GOVT","Government Scheme",5,false,@"{""isCashless"":true}"),

                Make("insurance","insurance.accommodation_class","general","General",1),
                Make("insurance","insurance.accommodation_class","semi-private","Semi-Private",2),
                Make("insurance","insurance.accommodation_class","private","Private",3),
                Make("insurance","insurance.accommodation_class","icu","ICU",4),

                // ── Inventory ─────────────────────────────────────────────────────
                Make("inventory","inventory.item_type","MEDICINE","Medicine",1),
                Make("inventory","inventory.item_type","SURGICAL","Surgical Supply",2),
                Make("inventory","inventory.item_type","EQUIPMENT","Equipment",3),
                Make("inventory","inventory.item_type","CONSUMABLE","Consumable",4),
                Make("inventory","inventory.item_type","IMPLANT","Implant",5),
                Make("inventory","inventory.item_type","STATIONERY","Stationery",6),
                Make("inventory","inventory.item_type","LINEN","Linen",7),

                Make("inventory","inventory.uom","NOS","Nos (Numbers)",1),
                Make("inventory","inventory.uom","BOX","Box",2),
                Make("inventory","inventory.uom","STRIP","Strip",3),
                Make("inventory","inventory.uom","VIAL","Vial",4),
                Make("inventory","inventory.uom","AMPOULE","Ampoule",5),
                Make("inventory","inventory.uom","ML","ml",6),
                Make("inventory","inventory.uom","L","Litre",7),
                Make("inventory","inventory.uom","MG","mg",8),
                Make("inventory","inventory.uom","GM","gm",9),
                Make("inventory","inventory.uom","KG","kg",10),
                Make("inventory","inventory.uom","PAIR","Pair",11),
                Make("inventory","inventory.uom","SET","Set",12),

                Make("inventory","inventory.purchase_category","PHARMACY","Pharmacy",1),
                Make("inventory","inventory.purchase_category","OT_SURGERY","OT & Surgery",2),
                Make("inventory","inventory.purchase_category","CONSUMABLES","Consumables",3),
                Make("inventory","inventory.purchase_category","OPTICAL","Optical",4),
                Make("inventory","inventory.purchase_category","LABORATORY","Laboratory",5),
                Make("inventory","inventory.purchase_category","STATIONERY","Stationery",6),
                Make("inventory","inventory.purchase_category","EQUIPMENT","Equipment",7),
                Make("inventory","inventory.purchase_category","GENERAL_HOSPITAL","General Hospital",8),

                Make("inventory","inventory.vendor_category","PHARMA","Pharmaceutical",1),
                Make("inventory","inventory.vendor_category","SURGICAL","Surgical Supplies",2),
                Make("inventory","inventory.vendor_category","EQUIPMENT","Equipment",3),
                Make("inventory","inventory.vendor_category","OPTICAL","Optical Supplies",4),
                Make("inventory","inventory.vendor_category","GENERAL","General Supplies",5),

                Make("inventory","inventory.gst_rate","GST_0","0% GST",1,false,@"{""rate"":0}"),
                Make("inventory","inventory.gst_rate","GST_5","5% GST",2,false,@"{""rate"":5}"),
                Make("inventory","inventory.gst_rate","GST_12","12% GST",3,false,@"{""rate"":12}"),
                Make("inventory","inventory.gst_rate","GST_18","18% GST",4,false,@"{""rate"":18}"),
                Make("inventory","inventory.gst_rate","GST_28","28% GST",5,false,@"{""rate"":28}"),

                Make("inventory","inventory.storage_condition","ROOM_TEMP","Room Temperature (15-25°C)",1),
                Make("inventory","inventory.storage_condition","COOL","Cool (8-15°C)",2),
                Make("inventory","inventory.storage_condition","REFRIGERATE","Refrigerate (2-8°C)",3),
                Make("inventory","inventory.storage_condition","FREEZE","Freeze (-20°C)",4),
                Make("inventory","inventory.storage_condition","DRY","Dry Place",5),
                Make("inventory","inventory.storage_condition","DARK","Dark / Light-Protected",6),

                Make("inventory","inventory.payment_term","IMMEDIATE","Immediate (0 days)",1,false,@"{""days"":0}"),
                Make("inventory","inventory.payment_term","NET_15","Net 15 days",2,false,@"{""days"":15}"),
                Make("inventory","inventory.payment_term","NET_30","Net 30 days",3,false,@"{""days"":30}"),
                Make("inventory","inventory.payment_term","NET_45","Net 45 days",4,false,@"{""days"":45}"),
                Make("inventory","inventory.payment_term","NET_60","Net 60 days",5,false,@"{""days"":60}"),
                Make("inventory","inventory.payment_term","NET_90","Net 90 days",6,false,@"{""days"":90}"),

                // ── Pharmacy ──────────────────────────────────────────────────────
                Make("pharmacy","pharmacy.drug_form","TABLET","Tablet",1),
                Make("pharmacy","pharmacy.drug_form","CAPSULE","Capsule",2),
                Make("pharmacy","pharmacy.drug_form","SYRUP","Syrup",3),
                Make("pharmacy","pharmacy.drug_form","DROPS","Eye Drops",4),
                Make("pharmacy","pharmacy.drug_form","OINTMENT","Ointment",5),
                Make("pharmacy","pharmacy.drug_form","INJECTION","Injection",6),
                Make("pharmacy","pharmacy.drug_form","PATCH","Patch",7),
                Make("pharmacy","pharmacy.drug_form","INHALER","Inhaler",8),
                Make("pharmacy","pharmacy.drug_form","GEL","Gel",9),
                Make("pharmacy","pharmacy.drug_form","SUSPENSION","Suspension",10),

                Make("pharmacy","pharmacy.drug_route","ORAL","Oral (PO)",1),
                Make("pharmacy","pharmacy.drug_route","TOPICAL_EYE","Topical - Eye",2),
                Make("pharmacy","pharmacy.drug_route","INTRAVITREAL","Intravitreal (IVT)",3),
                Make("pharmacy","pharmacy.drug_route","IV","Intravenous (IV)",4),
                Make("pharmacy","pharmacy.drug_route","IM","Intramuscular (IM)",5),
                Make("pharmacy","pharmacy.drug_route","SC","Subcutaneous (SC)",6),
                Make("pharmacy","pharmacy.drug_route","SUBCONJ","Subconjunctival",7),

                Make("pharmacy","pharmacy.dosage_frequency","OD","Once Daily (OD)",1,false,@"{""timesPerDay"":1}"),
                Make("pharmacy","pharmacy.dosage_frequency","BD","Twice Daily (BD)",2,false,@"{""timesPerDay"":2}"),
                Make("pharmacy","pharmacy.dosage_frequency","TDS","Three Times Daily (TDS)",3,false,@"{""timesPerDay"":3}"),
                Make("pharmacy","pharmacy.dosage_frequency","QID","Four Times Daily (QID)",4,false,@"{""timesPerDay"":4}"),
                Make("pharmacy","pharmacy.dosage_frequency","HS","At Bedtime (HS)",5,false,@"{""timesPerDay"":1}"),
                Make("pharmacy","pharmacy.dosage_frequency","SOS","As Needed (SOS)",6,false,@"{""timesPerDay"":0}"),
                Make("pharmacy","pharmacy.dosage_frequency","WEEKLY","Weekly",7,false,@"{""timesPerDay"":0}"),
                Make("pharmacy","pharmacy.dosage_frequency","MONTHLY","Monthly",8,false,@"{""timesPerDay"":0}"),

                Make("pharmacy","pharmacy.drug_schedule","H","Schedule H (Prescription)",1),
                Make("pharmacy","pharmacy.drug_schedule","H1","Schedule H1 (Controlled)",2),
                Make("pharmacy","pharmacy.drug_schedule","X","Schedule X (Narcotic)",3),
                Make("pharmacy","pharmacy.drug_schedule","OTC","OTC (Over the Counter)",4),
                Make("pharmacy","pharmacy.drug_schedule","G","Schedule G",5),

                // ── Lab & Diagnostics ────────────────────────────────────────────
                Make("lab_diagnostics","lab.specimen_type","BLOOD","Blood",1),
                Make("lab_diagnostics","lab.specimen_type","URINE","Urine",2),
                Make("lab_diagnostics","lab.specimen_type","TISSUE","Tissue Biopsy",3),
                Make("lab_diagnostics","lab.specimen_type","FLUID","Aqueous Fluid",4),
                Make("lab_diagnostics","lab.specimen_type","SWAB","Conjunctival Swab",5),
                Make("lab_diagnostics","lab.specimen_type","TEARS","Tear Sample",6),

                Make("lab_diagnostics","lab.imaging_modality","OCT","OCT",1),
                Make("lab_diagnostics","lab.imaging_modality","FUNDUS","Fundus Camera",2),
                Make("lab_diagnostics","lab.imaging_modality","FA","Fluorescein Angiography",3),
                Make("lab_diagnostics","lab.imaging_modality","BSCAN","B-Scan Ultrasound",4),
                Make("lab_diagnostics","lab.imaging_modality","TOPOGRAPHY","Corneal Topography",5),
                Make("lab_diagnostics","lab.imaging_modality","PENTACAM","Pentacam",6),

                Make("lab_diagnostics","lab.ep_type","ERG","Electroretinography (ERG)",1),
                Make("lab_diagnostics","lab.ep_type","VEP","Visual Evoked Potential (VEP)",2),
                Make("lab_diagnostics","lab.ep_type","EOG","Electro-oculography (EOG)",3),

                // L-COL-01D — LMS specimen rejection reasons (operational, not diagnoses)
                Make("lab_diagnostics","lms.specimen_rejection_reason","PATIENT_IDENTITY_MISMATCH","Patient identity mismatch",1),
                Make("lab_diagnostics","lms.specimen_rejection_reason","SPECIMEN_MISMATCH","Specimen does not match order",2),
                Make("lab_diagnostics","lms.specimen_rejection_reason","SPECIMEN_QUALITY_UNACCEPTABLE","Specimen quality unacceptable",3),
                Make("lab_diagnostics","lms.specimen_rejection_reason","INSUFFICIENT_SPECIMEN","Insufficient specimen",4),
                Make("lab_diagnostics","lms.specimen_rejection_reason","WRONG_CONTAINER","Incorrect specimen container",5),
                Make("lab_diagnostics","lms.specimen_rejection_reason","DAMAGED_CONTAINER","Container damaged or compromised",6),
                Make("lab_diagnostics","lms.specimen_rejection_reason","LABELING_ERROR","Specimen labeling error",7),
                Make("lab_diagnostics","lms.specimen_rejection_reason","TRANSPORT_CONDITION_FAILURE","Transport condition failure",8),
                Make("lab_diagnostics","lms.specimen_rejection_reason","SPECIMEN_CONTAMINATION_SUSPECTED","Specimen contamination suspected",9),
                Make("lab_diagnostics","lms.specimen_rejection_reason","OTHER_GOVERNED_REASON","Other governed rejection reason",10),

                // ── Ward & IP ─────────────────────────────────────────────────────
                Make("ward_ip","ward.ward_type","GENERAL","General Ward",1),
                Make("ward_ip","ward.ward_type","SEMI_PRIVATE","Semi-Private",2),
                Make("ward_ip","ward.ward_type","PRIVATE","Private Room",3),
                Make("ward_ip","ward.ward_type","ICU","ICU",4),
                Make("ward_ip","ward.ward_type","DAY_CARE","Day Care",5),
                Make("ward_ip","ward.ward_type","PEDIATRIC","Pediatric Ward",6),

                Make("ward_ip","ward.bed_type","REGULAR","Regular Bed",1),
                Make("ward_ip","ward.bed_type","OT","OT Table",2),
                Make("ward_ip","ward.bed_type","RECLINER","Recliner Chair",3),
                Make("ward_ip","ward.bed_type","STRETCHER","Stretcher",4),

                Make("ward_ip","ward.admission_type","ELECTIVE","Elective",1),
                Make("ward_ip","ward.admission_type","EMERGENCY","Emergency",2),
                Make("ward_ip","ward.admission_type","DAY_CARE","Day Care",3),
                Make("ward_ip","ward.admission_type","REFERRAL","Referral",4),

                // ── HR & Staff ────────────────────────────────────────────────────
                Make("hr_staff","hr.employment_type","PERMANENT","Permanent",1),
                Make("hr_staff","hr.employment_type","CONTRACT","Contract",2),
                Make("hr_staff","hr.employment_type","PART_TIME","Part-Time",3),
                Make("hr_staff","hr.employment_type","CONSULTANT","Consultant",4),
                Make("hr_staff","hr.employment_type","INTERN","Intern",5),
                Make("hr_staff","hr.employment_type","VISITING","Visiting Doctor",6),

                Make("hr_staff","hr.qualification_type","MBBS","MBBS",1),
                Make("hr_staff","hr.qualification_type","MD","MD",2),
                Make("hr_staff","hr.qualification_type","MS","MS",3),
                Make("hr_staff","hr.qualification_type","DNB","DNB",4),
                Make("hr_staff","hr.qualification_type","DO","DO (Ophthalmology)",5),
                Make("hr_staff","hr.qualification_type","PHARM_D","Pharm.D",6),
                Make("hr_staff","hr.qualification_type","BOPTOM","BOptom",7),
                Make("hr_staff","hr.qualification_type","BSC_NURS","B.Sc Nursing",8),
                Make("hr_staff","hr.qualification_type","GNM","GNM",9),
                Make("hr_staff","hr.qualification_type","OTHER","Other",10),

                Make("hr_staff","hr.leave_type","CASUAL","Casual Leave",1),
                Make("hr_staff","hr.leave_type","SICK","Sick Leave",2),
                Make("hr_staff","hr.leave_type","EARNED","Earned Leave",3),
                Make("hr_staff","hr.leave_type","MATERNITY","Maternity Leave",4),
                Make("hr_staff","hr.leave_type","PATERNITY","Paternity Leave",5),
                Make("hr_staff","hr.leave_type","COMP_OFF","Compensatory Off",6),
                Make("hr_staff","hr.leave_type","LWP","Leave Without Pay",7),

                Make("hr_staff","hr.shift_type","MORNING","Morning Shift",1),
                Make("hr_staff","hr.shift_type","AFTERNOON","Afternoon Shift",2),
                Make("hr_staff","hr.shift_type","NIGHT","Night Shift",3),
                Make("hr_staff","hr.shift_type","GENERAL","General Shift",4),
                Make("hr_staff","hr.shift_type","SPLIT","Split Shift",5),

                Make("hr_staff","hr.performance_rating","EXCELLENT","Excellent (5)",1),
                Make("hr_staff","hr.performance_rating","GOOD","Good (4)",2),
                Make("hr_staff","hr.performance_rating","SATISFACTORY","Satisfactory (3)",3),
                Make("hr_staff","hr.performance_rating","NEEDS_IMPROV","Needs Improvement",4),
                Make("hr_staff","hr.performance_rating","POOR","Poor (1)",5),

                Make("hr_staff","hr.credential_type","MEDICAL_LICENSE","Medical License",1),
                Make("hr_staff","hr.credential_type","DEA","DEA Certificate",2),
                Make("hr_staff","hr.credential_type","BOARD_CERT","Board Certification",3),
                Make("hr_staff","hr.credential_type","CPR","CPR Certification",4),
                Make("hr_staff","hr.credential_type","HOSPITAL_PRIV","Hospital Privileges",5),
                Make("hr_staff","hr.credential_type","OTHER","Other",6),

                // ── Medical history (B8) ───────────────────────────────────────────
                Make("clinical","medical_history.chronic_condition","DM2","Diabetes Type 2",1),
                Make("clinical","medical_history.chronic_condition","HTN","Hypertension",2),
                Make("clinical","medical_history.chronic_condition","ASTHMA","Asthma",3),
                Make("clinical","medical_history.chronic_condition","GLAUCOMA","Glaucoma",4,false,EyeMeta),
                Make("clinical","medical_history.chronic_condition","CATARACT","Cataracts",5,false,EyeMeta),
                Make("clinical","medical_history.chronic_condition","DR","Diabetic Retinopathy",6,false,EyeMeta),
                Make("clinical","medical_history.chronic_condition","OTHER","Other",99),

                Make("clinical","medical_history.medication","METFORMIN","Metformin",1),
                Make("clinical","medical_history.medication","LISINOPRIL","Lisinopril",2),
                Make("clinical","medical_history.medication","ATORVASTATIN","Atorvastatin",3),
                Make("clinical","medical_history.medication","INSULIN","Insulin",4),
                Make("clinical","medical_history.medication","OTHER","Other",99),

                Make("clinical","medical_history.surgery","CATARACT","Cataract Surgery",1),
                Make("clinical","medical_history.surgery","LASIK","LASIK",2),
                Make("clinical","medical_history.surgery","VITRECTOMY","Vitrectomy",3),
                Make("clinical","medical_history.surgery","OTHER","Other",99),

                Make("clinical","medical_history.family_condition","DIABETES","Diabetes",1),
                Make("clinical","medical_history.family_condition","HTN","Hypertension",2),
                Make("clinical","medical_history.family_condition","GLAUCOMA","Glaucoma",3,false,EyeMeta),
                Make("clinical","medical_history.family_condition","OTHER","Other",99),

                Make("clinical","medical_history.immunization","COVID19","COVID-19",1),
                Make("clinical","medical_history.immunization","INFLUENZA","Influenza",2),
                Make("clinical","medical_history.immunization","TETANUS","Tetanus",3),
                Make("clinical","medical_history.immunization","OTHER","Other",99),

                Make("clinical","medical_history.medication_route","ORAL","Oral",1),
                Make("clinical","medical_history.medication_route","EYE_DROPS","Eye Drops",2,false,EyeMeta),
                Make("clinical","medical_history.medication_route","TOPICAL","Topical",3,false,EyeMeta),
                Make("clinical","medical_history.medication_route","OTHER","Other",99),

                Make("clinical","medical_history.family_relationship","MOTHER","Mother",1),
                Make("clinical","medical_history.family_relationship","FATHER","Father",2),
                Make("clinical","medical_history.family_relationship","SISTER","Sister",3),
                Make("clinical","medical_history.family_relationship","BROTHER","Brother",4),
                Make("clinical","medical_history.family_relationship","OTHER","Other",99),

                Make("clinical","medical_history.smoking_status","NEVER","Never",1),
                Make("clinical","medical_history.smoking_status","FORMER","Former",2),
                Make("clinical","medical_history.smoking_status","CURRENT_LIGHT","Current - Light (<10/day)",3),
                Make("clinical","medical_history.smoking_status","CURRENT_MOD","Current - Moderate (10-20/day)",4),
                Make("clinical","medical_history.smoking_status","CURRENT_HEAVY","Current - Heavy (>20/day)",5),

                Make("clinical","medical_history.alcohol_use","NONE","None",1),
                Make("clinical","medical_history.alcohol_use","OCCASIONAL","Occasional (1-2 drinks/week)",2),
                Make("clinical","medical_history.alcohol_use","MODERATE","Moderate (3-7 drinks/week)",3),
                Make("clinical","medical_history.alcohol_use","HEAVY","Heavy (>7 drinks/week)",4),

                // ── System ────────────────────────────────────────────────────────
                Make("system","system.department","ADMISSIONS","Admissions",1),
                Make("system","system.department","BILLING","Billing",2),
                Make("system","system.department","LAB","Laboratory",3),
                Make("system","system.department","OT","Operation Theatre",4),
                Make("system","system.department","PHARMACY","Pharmacy",5),
                Make("system","system.department","RADIOLOGY","Radiology",6),
                Make("system","system.department","NURSING","Nursing",7),
                Make("system","system.department","ANESTHESIA","Anesthesia",8),
                Make("system","system.department","COUNSELLING","Counselling",9),
                Make("system","system.department","OPTICAL","Optical",10),
                Make("system","system.department","HR","HR / Admin",11),
                Make("system","system.department","IT","IT",12),

                Make("system","system.timezone","IST","India Standard Time (IST)",1,false,@"{""offset"":""+05:30"",""tz"":""Asia/Kolkata""}"),
                Make("system","system.timezone","UTC","UTC",2,false,@"{""offset"":""+00:00"",""tz"":""UTC""}"),
                Make("system","system.timezone","EST","Eastern Standard Time (EST)",3,false,@"{""offset"":""-05:00"",""tz"":""America/New_York""}"),
                Make("system","system.timezone","PST","Pacific Standard Time (PST)",4,false,@"{""offset"":""-08:00"",""tz"":""America/Los_Angeles""}"),
                Make("system","system.timezone","GST","Gulf Standard Time (GST)",5,false,@"{""offset"":""+04:00"",""tz"":""Asia/Dubai""}"),

                Make("system","system.currency","INR","Indian Rupee (₹)",1,false,@"{""symbol"":""₹"",""iso"":""INR""}"),
                Make("system","system.currency","USD","US Dollar ($)",2,false,@"{""symbol"":""$"",""iso"":""USD""}"),
                Make("system","system.currency","AED","UAE Dirham (AED)",3,false,@"{""symbol"":""AED"",""iso"":""AED""}"),

                Make("system","system.language","EN","English",1,false,@"{""locale"":""en""}"),
                Make("system","system.language","HI","Hindi",2,false,@"{""locale"":""hi""}"),
                Make("system","system.language","TE","Telugu",3,false,@"{""locale"":""te""}"),
                Make("system","system.language","TA","Tamil",4,false,@"{""locale"":""ta""}"),
                Make("system","system.language","KN","Kannada",5,false,@"{""locale"":""kn""}"),
                Make("system","system.language","ML","Malayalam",6,false,@"{""locale"":""ml""}"),

                Make("system","system.checklist_default","CONSENT_SIGNED","Consent Form Signed",1),
                Make("system","system.checklist_default","ID_VERIFIED","ID Verified",2),
                Make("system","system.checklist_default","ALLERGIES_CHECKED","Allergies Checked",3),
                Make("system","system.checklist_default","VITALS_RECORDED","Vitals Recorded",4),
                Make("system","system.checklist_default","PAYMENT_CLEARED","Payment Cleared",5),
            };
        }
    }
}

