using AuthService.Context;
using AuthService.Models.Domain;
using Microsoft.EntityFrameworkCore;

namespace AuthService.SeedData
{
    public static class PermissionSeeder
    {
        public static async Task SeedPermissionsAsync(AppDbContext context)
        {
            var tenantId = Guid.Parse("00000000-0000-0000-0000-000000000000");
            
            var permissions = new List<Permission>
            {
                // Patient Management (24 permissions)
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_record.create", Name = "Create Patient Record", Module = "patient_management", Action = "create", ResourceType = "patient_record", Scope = "branch", Description = "Create new patient records in the system", IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_record.read", Name = "View Patient Record", Module = "patient_management", Action = "read", ResourceType = "patient_record", Scope = "own", Description = "View patient records with department-level access", IsSystemPermission = true, DepartmentSpecific = true, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_record.update", Name = "Update Patient Record", Module = "patient_management", Action = "update", ResourceType = "patient_record", Scope = "own", Description = "Update patient records with department-level access", IsSystemPermission = true, DepartmentSpecific = true, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_record.delete", Name = "Delete Patient Record", Module = "patient_management", Action = "delete", ResourceType = "patient_record", Scope = "branch", Description = "Soft delete patient records", IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_demographics.create", Name = "Create Patient Demographics", Module = "patient_management", Action = "create", ResourceType = "patient_demographics", Scope = "branch", Description = "Create patient demographic information", IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_demographics.read", Name = "View Patient Demographics", Module = "patient_management", Action = "read", ResourceType = "patient_demographics", Scope = "own", Description = "View patient demographic information", IsSystemPermission = true, DepartmentSpecific = true, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_demographics.update", Name = "Update Patient Demographics", Module = "patient_management", Action = "update", ResourceType = "patient_demographics", Scope = "own", Description = "Update patient demographic information", IsSystemPermission = true, DepartmentSpecific = true, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_demographics.delete", Name = "Delete Patient Demographics", Module = "patient_management", Action = "delete", ResourceType = "patient_demographics", Scope = "branch", Description = "Delete patient demographic information", IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_contact.create", Name = "Create Patient Contact", Module = "patient_management", Action = "create", ResourceType = "patient_contact", Scope = "branch", Description = "Create patient contact information", IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_contact.read", Name = "View Patient Contact", Module = "patient_management", Action = "read", ResourceType = "patient_contact", Scope = "own", Description = "View patient contact information", IsSystemPermission = true, DepartmentSpecific = true, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_contact.update", Name = "Update Patient Contact", Module = "patient_management", Action = "update", ResourceType = "patient_contact", Scope = "own", Description = "Update patient contact information", IsSystemPermission = true, DepartmentSpecific = true, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_contact.delete", Name = "Delete Patient Contact", Module = "patient_management", Action = "delete", ResourceType = "patient_contact", Scope = "branch", Description = "Delete patient contact information", IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_consent.create", Name = "Create Patient Consent", Module = "patient_management", Action = "create", ResourceType = "patient_consent", Scope = "branch", Description = "Create patient consent forms", IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_consent.read", Name = "View Patient Consent", Module = "patient_management", Action = "read", ResourceType = "patient_consent", Scope = "own", Description = "View patient consent forms", IsSystemPermission = true, DepartmentSpecific = true, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_consent.update", Name = "Update Patient Consent", Module = "patient_management", Action = "update", ResourceType = "patient_consent", Scope = "own", Description = "Update patient consent forms", IsSystemPermission = true, DepartmentSpecific = true, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_consent.delete", Name = "Delete Patient Consent", Module = "patient_management", Action = "delete", ResourceType = "patient_consent", Scope = "branch", Description = "Delete patient consent forms", IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_document.upload", Name = "Upload Patient Document", Module = "patient_management", Action = "upload", ResourceType = "patient_document", Scope = "own", Description = "Upload patient documents and records", IsSystemPermission = true, DepartmentSpecific = true, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_document.read", Name = "View Patient Document", Module = "patient_management", Action = "read", ResourceType = "patient_document", Scope = "own", Description = "View patient documents", IsSystemPermission = true, DepartmentSpecific = true, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_document.download", Name = "Download Patient Document", Module = "patient_management", Action = "download", ResourceType = "patient_document", Scope = "own", Description = "Download patient documents", IsSystemPermission = true, DepartmentSpecific = true, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_document.delete", Name = "Delete Patient Document", Module = "patient_management", Action = "delete", ResourceType = "patient_document", Scope = "branch", Description = "Delete patient documents", IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_preferences.create", Name = "Create Patient Preferences", Module = "patient_management", Action = "create", ResourceType = "patient_preferences", Scope = "own", Description = "Create patient preferences and settings", IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_preferences.read", Name = "View Patient Preferences", Module = "patient_management", Action = "read", ResourceType = "patient_preferences", Scope = "own", Description = "View patient preferences", IsSystemPermission = true, DepartmentSpecific = true, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_preferences.update", Name = "Update Patient Preferences", Module = "patient_management", Action = "update", ResourceType = "patient_preferences", Scope = "own", Description = "Update patient preferences", IsSystemPermission = true, DepartmentSpecific = true, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "patient.patient_preferences.delete", Name = "Delete Patient Preferences", Module = "patient_management", Action = "delete", ResourceType = "patient_preferences", Scope = "own", Description = "Delete patient preferences", IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
            };
            
            // ── CCMS permissions (P6) ──────────────────────────────────────────
            var ccmsPerms = new List<Permission>
            {
                // Coverage Cases
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.coverage_case.create",  Name = "Create Coverage Case",             Module = "ccms", Action = "create",          ResourceType = "coverage_case",         Scope = "branch", Description = "Open a new CCMS coverage case for a patient session",          IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.coverage_case.read",    Name = "View Coverage Case",               Module = "ccms", Action = "read",            ResourceType = "coverage_case",         Scope = "branch", Description = "View coverage case details, state and timeline",               IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.coverage_case.update",  Name = "Update Coverage Case",             Module = "ccms", Action = "update",          ResourceType = "coverage_case",         Scope = "branch", Description = "Edit coverage case fields (payer, policy, notes)",              IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                // Eligibility
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.eligibility.create",    Name = "Record Eligibility Check",         Module = "ccms", Action = "create",          ResourceType = "eligibility_check",     Scope = "branch", Description = "Add an eligibility check result for a case",                    IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.eligibility.read",      Name = "View Eligibility Checks",          Module = "ccms", Action = "read",            ResourceType = "eligibility_check",     Scope = "branch", Description = "View eligibility check history for a case",                     IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                // Visit Policies
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.visit_policy.create",   Name = "Add Visit Policy",                 Module = "ccms", Action = "create",          ResourceType = "visit_policy",          Scope = "branch", Description = "Add an insurance policy to a session or case",                  IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.visit_policy.read",     Name = "View Visit Policies",              Module = "ccms", Action = "read",            ResourceType = "visit_policy",          Scope = "branch", Description = "View all policies attached to a session or case",               IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.visit_policy.update",   Name = "Edit Visit Policy",                Module = "ccms", Action = "update",          ResourceType = "visit_policy",          Scope = "branch", Description = "Edit policy details and set primary",                           IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.visit_policy.delete",   Name = "Delete Visit Policy",              Module = "ccms", Action = "delete",          ResourceType = "visit_policy",          Scope = "branch", Description = "Remove a policy from a session or case",                        IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                // Authorization
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.authorization.create",          Name = "Generate Pre-Authorization",        Module = "ccms", Action = "create",          ResourceType = "authorization",         Scope = "branch", Description = "Generate a new pre-authorisation request",                     IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.authorization.read",            Name = "View Pre-Authorization",            Module = "ccms", Action = "read",            ResourceType = "authorization",         Scope = "branch", Description = "View pre-auth details and TPA responses",                       IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.authorization.submit",          Name = "Submit Pre-Authorization",          Module = "ccms", Action = "submit",          ResourceType = "authorization",         Scope = "branch", Description = "Mark a pre-auth as submitted to TPA / insurer",                 IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.authorization.record_response", Name = "Record TPA Response",               Module = "ccms", Action = "record_response",  ResourceType = "authorization",         Scope = "branch", Description = "Record approval, partial, rejection or clarification from TPA",  IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                // Clarifications
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.clarification.create",  Name = "Add Clarification Query",          Module = "ccms", Action = "create",          ResourceType = "clarification",         Scope = "branch", Description = "Record a TPA query against a pre-authorisation",                IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.clarification.respond", Name = "Respond to Clarification",         Module = "ccms", Action = "respond",         ResourceType = "clarification",         Scope = "branch", Description = "Provide hospital response to a TPA clarification query",         IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.clarification.write",   Name = "Write Clarifications",             Module = "ccms", Action = "write",           ResourceType = "clarification",         Scope = "branch", Description = "Phase 2 alias: create or respond to clarifications",             IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.preauth.create",        Name = "Create Pre-Auth (alias)",          Module = "ccms", Action = "create",          ResourceType = "authorization",         Scope = "branch", Description = "Alias of ccms.authorization.create",                            IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.preauth.submit",        Name = "Submit Pre-Auth (alias)",          Module = "ccms", Action = "submit",          ResourceType = "authorization",         Scope = "branch", Description = "Alias of ccms.authorization.submit",                            IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.preauth.process",       Name = "Process Pre-Auth (alias)",         Module = "ccms", Action = "process",         ResourceType = "authorization",         Scope = "branch", Description = "Alias of ccms.authorization.record_response",                   IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.enhancement.create",    Name = "Create Enhancement",               Module = "ccms", Action = "create",          ResourceType = "enhancement",           Scope = "branch", Description = "Create an enhancement request",                                 IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.enhancement.decide",    Name = "Decide Enhancement",               Module = "ccms", Action = "decide",          ResourceType = "enhancement",           Scope = "branch", Description = "Approve or reject an enhancement request",                      IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.enhancement.write",     Name = "Write Enhancements",               Module = "ccms", Action = "write",           ResourceType = "enhancement",           Scope = "branch", Description = "Phase 2 alias: create or decide enhancements",                  IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                // Claims
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.claim.create",          Name = "Create Claim Packet",              Module = "ccms", Action = "create",          ResourceType = "claim",                 Scope = "branch", Description = "Create a claim packet for billing",                             IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.claim.read",            Name = "View Claim",                       Module = "ccms", Action = "read",            ResourceType = "claim",                 Scope = "branch", Description = "View claim packets and their status",                           IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.claim.submit",          Name = "Submit Claim",                     Module = "ccms", Action = "submit",          ResourceType = "claim",                 Scope = "branch", Description = "Submit claim to TPA or insurer",                                IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.claim.write",           Name = "Write Claims (alias)",             Module = "ccms", Action = "write",           ResourceType = "claim",                 Scope = "branch", Description = "Phase 2 alias covering claim create/submit",                    IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.claim.acknowledge",     Name = "Acknowledge Claim",                Module = "ccms", Action = "acknowledge",     ResourceType = "claim",                 Scope = "branch", Description = "Record TPA acknowledgement of a claim",                         IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ip.emergency_fc.apply",      Name = "Apply Emergency FC",               Module = "ip_management", Action = "apply", ResourceType = "emergency_fc",          Scope = "branch", Description = "Apply Emergency Financial Clearance on an IP journey",          IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ip.implant.mismatch.override", Name = "Override IOL mismatch",          Module = "ip_management", Action = "override", ResourceType = "patient_journey",     Scope = "branch", Description = "Record an implant when power or model differs from the planned lens", IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                // Settlements
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.settlement.create",    Name = "Record Settlement",                Module = "ccms", Action = "create",          ResourceType = "settlement",            Scope = "branch", Description = "Record a payment receipt against a claim",                      IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.settlement.read",      Name = "View Settlements",                 Module = "ccms", Action = "read",            ResourceType = "settlement",            Scope = "branch", Description = "View settlement history and amounts",                           IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.settlement.reconcile", Name = "Reconcile Settlement",             Module = "ccms", Action = "reconcile",       ResourceType = "settlement",            Scope = "branch", Description = "Mark a coverage case as reconciled after full settlement",      IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                // Billing
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.billing.allocate",     Name = "Allocate Bill",                    Module = "ccms", Action = "allocate",        ResourceType = "billing",               Scope = "branch", Description = "Run insurance vs patient share allocation on a final bill",      IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.billing.read",         Name = "View Billing Allocation",           Module = "ccms", Action = "read",            ResourceType = "billing",               Scope = "branch", Description = "View billing summary and line-item allocation breakdown",        IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                // Master Data
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.master_data.read",     Name = "View CCMS Master Data",            Module = "ccms", Action = "read",            ResourceType = "master_data",           Scope = "global", Description = "View insurance providers, TPA providers, coverage packages",    IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.master_data.manage",   Name = "Manage CCMS Master Data",          Module = "ccms", Action = "manage",          ResourceType = "master_data",           Scope = "global", Description = "Create, edit and delete insurance providers, packages",          IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                // Reporting
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.report.dashboard",     Name = "View CCMS Dashboard",              Module = "ccms", Action = "read",            ResourceType = "report_dashboard",      Scope = "global", Description = "View the CCMS analytics dashboard",                             IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.report.aging",         Name = "View Aging Report",                Module = "ccms", Action = "read",            ResourceType = "report_aging",          Scope = "global", Description = "View claims aging and TAT analysis reports",                    IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                // Workflow admin
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.workflow.fire",        Name = "Fire Workflow Trigger",            Module = "ccms", Action = "fire",            ResourceType = "workflow",              Scope = "branch", Description = "Manually fire a workflow state transition on a coverage case",  IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Permission { Id = Guid.NewGuid(), TenantId = tenantId, Code = "ccms.workflow.admin",       Name = "CCMS Workflow Admin",              Module = "ccms", Action = "admin",           ResourceType = "workflow",              Scope = "global", Description = "Admin access: view all workflow instances, force-override states", IsSystemPermission = true, DepartmentSpecific = false, IsCustom = false, IsActive = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
            };
            permissions.AddRange(ccmsPerms);

            // IP + billing codes from SQL 156 plus A5 (ip.safety_token.print).
            // A2 (ip.implant.mismatch.override) is already in the CCMS block above.
            // NOT EXISTS is Code+TenantId in the loop below — keep SQL 156/171/172.
            permissions.AddRange(IpBillingPermissionCatalog.Create(tenantId, DateTime.UtcNow));

            // Add permissions that don't exist
            foreach (var permission in permissions)
            {
                var exists = await context.Permissions
                    .AnyAsync(p => p.TenantId == permission.TenantId && p.Code == permission.Code);
                
                if (!exists)
                {
                    await context.Permissions.AddAsync(permission);
                }
            }
            
            await context.SaveChangesAsync();
            
            Console.WriteLine($"✓ Seeded {permissions.Count} permissions (incl. CCMS Phase 2 aliases and IP/billing) for system tenant");
        }

        /// <summary>
        /// Copies missing CCMS Phase-2 alias permissions to every live tenant
        /// and attaches them to roles that already have any ccms.* permission
        /// so they appear in JWTs after next login.
        /// </summary>
        public static async Task SeedPhase2AliasesForAllTenantsAsync(AppDbContext context)
        {
            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var aliasCodes = new[]
            {
                "ccms.clarification.write",
                "ccms.preauth.create",
                "ccms.preauth.submit",
                "ccms.preauth.process",
                "ccms.enhancement.write",
                "ccms.enhancement.create",
                "ccms.enhancement.decide",
                "ccms.claim.write",
            };

            // Ensure system-tenant aliases exist first.
            await SeedPermissionsAsync(context);

            var tenantIds = await context.Tenants
                .Where(t => t.IsActive)
                .Select(t => t.Id)
                .ToListAsync();
            tenantIds.Add(systemTenant);
            tenantIds = tenantIds.Distinct().ToList();

            var systemAliases = await context.Permissions
                .Where(p => p.TenantId == systemTenant && aliasCodes.Contains(p.Code) && p.IsActive)
                .ToListAsync();

            foreach (var tenantId in tenantIds)
            {
                foreach (var src in systemAliases)
                {
                    var exists = await context.Permissions
                        .AnyAsync(p => p.TenantId == tenantId && p.Code == src.Code);
                    if (exists) continue;

                    await context.Permissions.AddAsync(new Permission
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        Code = src.Code,
                        Name = src.Name,
                        Module = src.Module,
                        Action = src.Action,
                        ResourceType = src.ResourceType,
                        Scope = src.Scope,
                        Description = src.Description,
                        IsSystemPermission = true,
                        DepartmentSpecific = false,
                        IsCustom = false,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                    });
                }
            }

            await context.SaveChangesAsync();

            var roleIdsWithCcms = await context.RolePermissions
                .Where(rp => rp.Permission.IsActive && rp.Permission.Code.StartsWith("ccms."))
                .Select(rp => rp.RoleId)
                .Distinct()
                .ToListAsync();

            var aliasPermIds = await context.Permissions
                .Where(p => aliasCodes.Contains(p.Code) && p.IsActive)
                .Select(p => p.Id)
                .ToListAsync();

            foreach (var roleId in roleIdsWithCcms)
            {
                foreach (var permId in aliasPermIds)
                {
                    var linked = await context.RolePermissions
                        .AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permId);
                    if (linked) continue;

                    await context.RolePermissions.AddAsync(new Models.Domain.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = roleId,
                        PermissionId = permId,
                        CreatedAt = DateTime.UtcNow,
                    });
                }
            }

            await context.SaveChangesAsync();
            Console.WriteLine($"✓ Phase 2 CCMS aliases ensured for {tenantIds.Count} tenants and {roleIdsWithCcms.Count} CCMS roles");
        }
    }
}
