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

            // IP + billing codes from SQL 156 plus A5 (ip.safety_token.print) and SQL 197 (ip.vitals.read).
            // A2 (ip.implant.mismatch.override) is already in the CCMS block above.
            // NOT EXISTS is Code+TenantId in the loop below — keep SQL 156/171/172.
            permissions.AddRange(IpBillingPermissionCatalog.Create(tenantId, DateTime.UtcNow));

            // Counselling desk session codes (SQL 189) — required by CounselingController + FE nav.
            permissions.AddRange(CounselingSessionsPermissionCatalog.Create(tenantId, DateTime.UtcNow));

            // Counselling session documents (SQL 202) — Session Documents + Patient 360 counselling path.
            permissions.AddRange(SessionDocumentsPermissionCatalog.Create(tenantId, DateTime.UtcNow));

            // SQL 198: Patient 360 OCT metadata read. Role links are applied separately.
            permissions.Add(new Permission
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Code = DiagnosticOctReadPermissionCatalog.Code,
                Name = DiagnosticOctReadPermissionCatalog.Name,
                Module = DiagnosticOctReadPermissionCatalog.Module,
                Action = DiagnosticOctReadPermissionCatalog.Action,
                ResourceType = DiagnosticOctReadPermissionCatalog.ResourceType,
                Scope = DiagnosticOctReadPermissionCatalog.Scope,
                Description = DiagnosticOctReadPermissionCatalog.Description,
                IsSystemPermission = true,
                DepartmentSpecific = false,
                IsCustom = false,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });

            // SQL 199: Patient 360 medication history read. Role links are applied separately.
            permissions.Add(new Permission
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Code = Patient360MedicationReadPermissionCatalog.Code,
                Name = Patient360MedicationReadPermissionCatalog.Name,
                Module = Patient360MedicationReadPermissionCatalog.Module,
                Action = Patient360MedicationReadPermissionCatalog.Action,
                ResourceType = Patient360MedicationReadPermissionCatalog.ResourceType,
                Scope = Patient360MedicationReadPermissionCatalog.Scope,
                Description = Patient360MedicationReadPermissionCatalog.Description,
                IsSystemPermission = true,
                DepartmentSpecific = false,
                IsCustom = false,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            });

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
            
            Console.WriteLine($"✓ Seeded {permissions.Count} permissions (incl. CCMS Phase 2 aliases, IP/billing, counselling sessions) for system tenant");
        }

        /// <summary>
        /// Ensures counseling_sessions.* exist and are linked to Counsellor/Counselor roles
        /// so JWT claims include them after next login (Phase 2Z nav + API access).
        /// </summary>
        public static async Task SeedCounselingSessionsPermissionsForCounsellorRolesAsync(AppDbContext context)
        {
            await SeedPermissionsAsync(context);

            var counsellorRoleIds = await context.Roles
                .Where(r => r.NormalizedName == "COUNSELLOR" || r.NormalizedName == "COUNSELOR")
                .Select(r => r.Id)
                .ToListAsync();

            if (counsellorRoleIds.Count == 0)
            {
                Console.WriteLine("⚠ No Counsellor/Counselor roles found — counseling_sessions role links skipped");
                return;
            }

            var permIds = await context.Permissions
                .Where(p => CounselingSessionsPermissionCatalog.Codes.Contains(p.Code) && p.IsActive)
                .Select(p => p.Id)
                .ToListAsync();

            foreach (var roleId in counsellorRoleIds)
            {
                foreach (var permId in permIds)
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
            Console.WriteLine($"✓ counseling_sessions.* linked to {counsellorRoleIds.Count} Counsellor role(s)");
        }

        /// <summary>
        /// Phase 3I Slice 6 D1 — seed counseling_sessions.reassign and grant to ADMIN only.
        /// Does not grant Counsellor/Counselor. Does not change Assign/Claim (.update) grants.
        /// Idempotent. Permission-based supervisors outside ADMIN receive the code via IAM role editing.
        /// </summary>
        public static async Task SeedCounselingSessionReassignPermissionsAsync(AppDbContext context)
        {
            await SeedPermissionsAsync(context);

            var code = CounselingSessionsPermissionCatalog.ReassignPermissionCode;
            var permIds = await context.Permissions
                .Where(p => p.Code == code && p.IsActive)
                .Select(p => p.Id)
                .ToListAsync();

            if (permIds.Count == 0)
            {
                Console.WriteLine("⚠ counseling_sessions.reassign missing — role links skipped");
                return;
            }

            var roleNames = CounselingSessionsPermissionCatalog.ReassignRoleNormalizedNames;
            var roleIds = await context.Roles
                .Where(r => r.NormalizedName != null && roleNames.Contains(r.NormalizedName))
                .Select(r => r.Id)
                .ToListAsync();

            var linked = 0;
            foreach (var roleId in roleIds)
            {
                foreach (var permId in permIds)
                {
                    var already = await context.RolePermissions
                        .AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permId);
                    if (already) continue;

                    await context.RolePermissions.AddAsync(new Models.Domain.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = roleId,
                        PermissionId = permId,
                        CreatedAt = DateTime.UtcNow,
                    });
                    linked++;
                }
            }

            if (linked > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ counseling_sessions.reassign linked ({linked} new row(s)) to {roleIds.Count} ADMIN role(s); Counsellor excluded");
        }

        /// <summary>
        /// PD-RBAC-01: strip unjustified IP/Ward/OT mutation grants from Counsellor roles.
        /// Idempotent. Does not touch session ownership data.
        /// </summary>
        public static async Task ApplyCounsellorLeastPrivilegeAsync(AppDbContext context)
        {
            var counsellorRoleIds = await context.Roles
                .Where(r => r.NormalizedName == "COUNSELLOR" || r.NormalizedName == "COUNSELOR")
                .Select(r => r.Id)
                .ToListAsync();

            if (counsellorRoleIds.Count == 0)
            {
                Console.WriteLine("Counsellor least-privilege: no Counsellor roles found");
                return;
            }

            var removePermIds = await context.Permissions
                .Where(p => CounsellorLeastPrivilegeCatalog.RemovedFromCounsellorPermissionCodes.Contains(p.Code))
                .Select(p => p.Id)
                .ToListAsync();

            var toRemove = await context.RolePermissions
                .Where(rp => counsellorRoleIds.Contains(rp.RoleId) && removePermIds.Contains(rp.PermissionId))
                .ToListAsync();

            if (toRemove.Count > 0)
            {
                context.RolePermissions.RemoveRange(toRemove);
                await context.SaveChangesAsync();
            }

            Console.WriteLine($"Counsellor least-privilege: removed {toRemove.Count} role_permission row(s) from {counsellorRoleIds.Count} role(s)");
        }

        /// <summary>
        /// Workflow RBAC: ensure Counsellor roles have patient.view + patient.create
        /// for session header / suggest / Add Patient registration (existing PatientsController contracts).
        /// Seeds missing patient.create/view catalog rows if absent (controller already requires these codes).
        /// Does not grant user.view, patient.update, or patient.admin. Idempotent.
        /// </summary>
        public static async Task SeedCounsellorPatientWorkflowPermissionsAsync(AppDbContext context)
        {
            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var now = DateTime.UtcNow;

            async Task EnsurePermissionAsync(string code, string name, string action, string description)
            {
                var exists = await context.Permissions
                    .AnyAsync(p => p.Code == code && p.IsActive);
                if (exists) return;

                await context.Permissions.AddAsync(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = systemTenant,
                    Code = code,
                    Name = name,
                    Module = "patient",
                    Action = action,
                    ResourceType = "patient",
                    Scope = "branch",
                    Description = description,
                    IsSystemPermission = true,
                    DepartmentSpecific = false,
                    IsCustom = false,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                await context.SaveChangesAsync();
            }

            await EnsurePermissionAsync(
                "patient.view",
                "View Patients",
                "view",
                "View patient records, suggest, and demographics needed for clinical workflows");
            await EnsurePermissionAsync(
                "patient.create",
                "Create Patients",
                "create",
                "Register new patients (MPI create) including counselling Add Patient registration");

            var counsellorRoleIds = await context.Roles
                .Where(r => r.NormalizedName == "COUNSELLOR" || r.NormalizedName == "COUNSELOR")
                .Select(r => r.Id)
                .ToListAsync();

            if (counsellorRoleIds.Count == 0)
            {
                Console.WriteLine("⚠ No Counsellor/Counselor roles — patient.view/create links skipped");
                return;
            }

            var permIds = await context.Permissions
                .Where(p => CounsellorLeastPrivilegeCatalog.WorkflowPatientPermissionCodes.Contains(p.Code) && p.IsActive)
                .Select(p => p.Id)
                .ToListAsync();

            if (permIds.Count == 0)
            {
                Console.WriteLine("⚠ patient.view/patient.create permissions missing — cannot link to Counsellor");
                return;
            }

            var linked = 0;
            foreach (var roleId in counsellorRoleIds)
            {
                foreach (var permId in permIds)
                {
                    var exists = await context.RolePermissions
                        .AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permId);
                    if (exists) continue;

                    await context.RolePermissions.AddAsync(new Models.Domain.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = roleId,
                        PermissionId = permId,
                        CreatedAt = DateTime.UtcNow,
                    });
                    linked++;
                }
            }

            if (linked > 0)
                await context.SaveChangesAsync();

            Console.WriteLine($"✓ patient.view/create linked ({linked} new role_permission row(s)) to {counsellorRoleIds.Count} Counsellor role(s)");
        }

        /// <summary>
        /// Workflow RBAC: ensure Counsellor roles have package_templates.read so Quote → Package
        /// can list/select approved counselling_package_templates (existing controller contract).
        /// Does not grant package_templates.create/update/delete. Idempotent.
        /// </summary>
        public static async Task SeedCounsellorPackageTemplateReadPermissionAsync(AppDbContext context)
        {
            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var now = DateTime.UtcNow;
            const string code = "package_templates.read";

            var exists = await context.Permissions.AnyAsync(p => p.Code == code && p.IsActive);
            if (!exists)
            {
                await context.Permissions.AddAsync(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = systemTenant,
                    Code = code,
                    Name = "Read Package Templates",
                    Module = "counselling",
                    Action = "read",
                    ResourceType = "package_template",
                    Scope = "tenant",
                    Description =
                        "List and select approved counselling package templates for quoting (not package administration)",
                    IsSystemPermission = true,
                    DepartmentSpecific = false,
                    IsCustom = false,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                await context.SaveChangesAsync();
            }

            var counsellorRoleIds = await context.Roles
                .Where(r => r.NormalizedName == "COUNSELLOR" || r.NormalizedName == "COUNSELOR")
                .Select(r => r.Id)
                .ToListAsync();

            if (counsellorRoleIds.Count == 0)
            {
                Console.WriteLine("⚠ No Counsellor/Counselor roles — package_templates.read links skipped");
                return;
            }

            var permIds = await context.Permissions
                .Where(p =>
                    CounsellorLeastPrivilegeCatalog.WorkflowPackageTemplatePermissionCodes.Contains(p.Code)
                    && p.IsActive)
                .Select(p => p.Id)
                .ToListAsync();

            if (permIds.Count == 0)
            {
                Console.WriteLine("⚠ package_templates.read missing — cannot link to Counsellor");
                return;
            }

            var linked = 0;
            foreach (var roleId in counsellorRoleIds)
            {
                foreach (var permId in permIds)
                {
                    var existsLink = await context.RolePermissions
                        .AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permId);
                    if (existsLink) continue;

                    await context.RolePermissions.AddAsync(new Models.Domain.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = roleId,
                        PermissionId = permId,
                        CreatedAt = DateTime.UtcNow,
                    });
                    linked++;
                }
            }

            if (linked > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ package_templates.read linked ({linked} new role_permission row(s)) to {counsellorRoleIds.Count} Counsellor role(s)");
        }

        /// <summary>
        /// Counselling Session Documents + Patient 360 Counselling discovery/content.
        /// Seeds session_documents.read/create/verify/delete if absent and links to
        /// Counsellor/Counselor only. Idempotent. Does not grant Front Office / Receptionist.
        /// Does not change creator-ownership soft-delete rules. Does not grant session_notes.*.
        /// </summary>
        public static async Task SeedCounsellorSessionDocumentsPermissionsAsync(AppDbContext context)
        {
            await SeedPermissionsAsync(context);

            var counsellorRoleIds = await context.Roles
                .Where(r => r.NormalizedName == "COUNSELLOR" || r.NormalizedName == "COUNSELOR")
                .Select(r => r.Id)
                .ToListAsync();

            if (counsellorRoleIds.Count == 0)
            {
                Console.WriteLine("⚠ No Counsellor/Counselor roles — session_documents.* links skipped");
                return;
            }

            var codes = CounsellorLeastPrivilegeCatalog.WorkflowSessionDocumentPermissionCodes;
            var permIds = await context.Permissions
                .Where(p => codes.Contains(p.Code) && p.IsActive)
                .Select(p => p.Id)
                .ToListAsync();

            if (permIds.Count == 0)
            {
                Console.WriteLine("⚠ session_documents.* permissions missing — cannot link to Counsellor");
                return;
            }

            var linked = 0;
            var now = DateTime.UtcNow;
            foreach (var roleId in counsellorRoleIds)
            {
                foreach (var permId in permIds)
                {
                    var existsLink = await context.RolePermissions
                        .AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permId);
                    if (existsLink) continue;

                    await context.RolePermissions.AddAsync(new Models.Domain.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = roleId,
                        PermissionId = permId,
                        CreatedAt = now,
                    });
                    linked++;
                }
            }

            if (linked > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ session_documents.* linked ({linked} new role_permission row(s)) to {counsellorRoleIds.Count} Counsellor role(s)");
        }

        /// <summary>
        /// Counselling recording transcription uses the existing transcription.start and
        /// transcription.view permissions. Migration 49 grants them to a role named Counselor;
        /// live roles are also Counsellor. Idempotent. Does not grant translate or edit.
        /// Ownership and branch checks stay in TranscriptionService.
        /// </summary>
        public static async Task SeedCounsellorTranscriptionPermissionsAsync(AppDbContext context)
        {
            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var now = DateTime.UtcNow;
            var codes = new[]
            {
                ("transcription.start", "Start Transcription", "create", "Start transcription for a counselling recording the counsellor may access"),
                ("transcription.view", "View Transcripts", "read", "View transcription status and transcript text for an authorized counselling recording"),
            };

            foreach (var (code, name, action, description) in codes)
            {
                var exists = await context.Permissions.AnyAsync(p => p.Code == code && p.IsActive);
                if (exists) continue;
                await context.Permissions.AddAsync(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = systemTenant,
                    Code = code,
                    Name = name,
                    Module = "Counseling",
                    Action = action,
                    ResourceType = "Transcription",
                    Scope = "branch",
                    Description = description,
                    IsSystemPermission = true,
                    DepartmentSpecific = false,
                    IsCustom = false,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
            }

            await context.SaveChangesAsync();

            var counsellorRoleIds = await context.Roles
                .Where(r => r.NormalizedName == "COUNSELLOR" || r.NormalizedName == "COUNSELOR")
                .Select(r => r.Id)
                .ToListAsync();
            if (counsellorRoleIds.Count == 0)
            {
                Console.WriteLine("⚠ No Counsellor/Counselor roles — transcription.start/view links skipped");
                return;
            }

            var permIds = await context.Permissions
                .Where(p => (p.Code == "transcription.start" || p.Code == "transcription.view") && p.IsActive)
                .Select(p => p.Id)
                .ToListAsync();

            var linked = 0;
            foreach (var roleId in counsellorRoleIds)
            {
                foreach (var permId in permIds)
                {
                    var existsLink = await context.RolePermissions
                        .AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permId);
                    if (existsLink) continue;
                    await context.RolePermissions.AddAsync(new Models.Domain.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = roleId,
                        PermissionId = permId,
                        CreatedAt = now,
                    });
                    linked++;
                }
            }

            if (linked > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ transcription.start/view linked ({linked} new role_permission row(s)) to {counsellorRoleIds.Count} Counsellor role(s)");
        }

        /// <summary>
        /// Phase 2Z-RBAC: seed bill.reconciliation.view and grant to CR operational roles.
        /// Does not grant Counsellor. Does not remove bill.view from any role. Idempotent.
        /// </summary>
        public static async Task SeedBillReconciliationViewPermissionsAsync(AppDbContext context)
        {
            await SeedPermissionsAsync(context);

            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var now = DateTime.UtcNow;
            var code = BillReconciliationPermissionCatalog.ViewPermissionCode;

            var exists = await context.Permissions.AnyAsync(p => p.Code == code && p.IsActive);
            if (!exists)
            {
                await context.Permissions.AddAsync(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = systemTenant,
                    Code = code,
                    Name = "View Charge Reconciliation",
                    Module = "billing",
                    Action = "view",
                    ResourceType = "charge_reconciliation",
                    Scope = "branch",
                    Description =
                        "Access Charge Reconciliation operational reports (implant/stock/charge exceptions and wastage)",
                    IsSystemPermission = true,
                    DepartmentSpecific = false,
                    IsCustom = false,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                await context.SaveChangesAsync();
            }

            var permIds = await context.Permissions
                .Where(p => p.Code == code && p.IsActive)
                .Select(p => p.Id)
                .ToListAsync();

            if (permIds.Count == 0)
            {
                Console.WriteLine("⚠ bill.reconciliation.view missing — role links skipped");
                return;
            }

            var roleNames = BillReconciliationPermissionCatalog.OperationalRoleNormalizedNames;
            var roleIds = await context.Roles
                .Where(r => r.NormalizedName != null && roleNames.Contains(r.NormalizedName))
                .Select(r => r.Id)
                .ToListAsync();

            // Fallback: some DBs store NormalizedName with underscores
            if (roleIds.Count < roleNames.Length)
            {
                var underscored = roleNames.Select(n => n.Replace(' ', '_')).ToArray();
                var extra = await context.Roles
                    .Where(r => r.NormalizedName != null && underscored.Contains(r.NormalizedName))
                    .Select(r => r.Id)
                    .ToListAsync();
                roleIds = roleIds.Union(extra).ToList();
            }

            var linked = 0;
            foreach (var roleId in roleIds)
            {
                foreach (var permId in permIds)
                {
                    var already = await context.RolePermissions
                        .AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permId);
                    if (already) continue;

                    await context.RolePermissions.AddAsync(new Models.Domain.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = roleId,
                        PermissionId = permId,
                        CreatedAt = DateTime.UtcNow,
                    });
                    linked++;
                }
            }

            if (linked > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ bill.reconciliation.view linked ({linked} new row(s)) to {roleIds.Count} operational role(s); Counsellor excluded");
        }

        /// <summary>
        /// SQL 197: seed ip.vitals.read and grant only the approved Patient 360 roles.
        /// Does not grant census, checklist, anaesthesia, or post-op holders. Idempotent.
        /// </summary>
        public static async Task SeedIpVitalsReadPermissionsAsync(AppDbContext context)
        {
            await SeedPermissionsAsync(context);

            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var now = DateTime.UtcNow;
            var code = IpVitalsReadPermissionCatalog.Code;

            var exists = await context.Permissions.AnyAsync(p =>
                p.TenantId == systemTenant && p.Code == code && p.IsActive);
            if (!exists)
            {
                await context.Permissions.AddAsync(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = systemTenant,
                    Code = code,
                    Name = IpVitalsReadPermissionCatalog.Name,
                    Module = IpVitalsReadPermissionCatalog.Module,
                    Action = IpVitalsReadPermissionCatalog.Action,
                    ResourceType = IpVitalsReadPermissionCatalog.ResourceType,
                    Scope = IpVitalsReadPermissionCatalog.Scope,
                    Description = IpVitalsReadPermissionCatalog.Description,
                    IsSystemPermission = true,
                    DepartmentSpecific = false,
                    IsCustom = false,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                await context.SaveChangesAsync();
            }

            var permIds = await context.Permissions
                .Where(p => p.TenantId == systemTenant && p.Code == code && p.IsActive)
                .Select(p => p.Id)
                .ToListAsync();

            if (permIds.Count == 0)
            {
                Console.WriteLine("⚠ ip.vitals.read missing — role links skipped");
                return;
            }

            var approved = IpVitalsReadPermissionCatalog.ApprovedRoleNormalizedNames;
            var roles = await context.Roles
                .Where(r => r.IsActive && r.DeletedAt == null)
                .ToListAsync();
            var roleIds = roles
                .Where(r => approved.Contains((r.NormalizedName ?? r.Name ?? "").Trim().ToUpperInvariant()))
                .Select(r => r.Id)
                .Distinct()
                .ToList();

            var linked = 0;
            foreach (var roleId in roleIds)
            {
                foreach (var permId in permIds)
                {
                    var already = await context.RolePermissions
                        .AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permId);
                    if (already) continue;

                    await context.RolePermissions.AddAsync(new Models.Domain.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = roleId,
                        PermissionId = permId,
                        CreatedAt = now,
                    });
                    linked++;
                }
            }

            if (linked > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ ip.vitals.read linked ({linked} new row(s)) to {roleIds.Count} approved role(s)");
        }

        /// <summary>
        /// SQL 198: seed diagnostic.oct.read and grant only existing approved roles.
        /// Does not create OPTOMETRIST or any other role. Idempotent.
        /// </summary>
        public static async Task SeedDiagnosticOctReadPermissionsAsync(AppDbContext context)
        {
            await SeedPermissionsAsync(context);

            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var now = DateTime.UtcNow;
            var code = DiagnosticOctReadPermissionCatalog.Code;

            var exists = await context.Permissions.AnyAsync(p =>
                p.TenantId == systemTenant && p.Code == code && p.IsActive);
            if (!exists)
            {
                await context.Permissions.AddAsync(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = systemTenant,
                    Code = code,
                    Name = DiagnosticOctReadPermissionCatalog.Name,
                    Module = DiagnosticOctReadPermissionCatalog.Module,
                    Action = DiagnosticOctReadPermissionCatalog.Action,
                    ResourceType = DiagnosticOctReadPermissionCatalog.ResourceType,
                    Scope = DiagnosticOctReadPermissionCatalog.Scope,
                    Description = DiagnosticOctReadPermissionCatalog.Description,
                    IsSystemPermission = true,
                    DepartmentSpecific = false,
                    IsCustom = false,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                await context.SaveChangesAsync();
            }

            var permIds = await context.Permissions
                .Where(p => p.TenantId == systemTenant && p.Code == code && p.IsActive)
                .Select(p => p.Id)
                .ToListAsync();

            if (permIds.Count == 0)
            {
                Console.WriteLine("⚠ diagnostic.oct.read missing — role links skipped");
                return;
            }

            var approved = DiagnosticOctReadPermissionCatalog.ApprovedRoleNormalizedNames;
            var roles = await context.Roles
                .Where(r => r.IsActive && r.DeletedAt == null)
                .ToListAsync();
            var roleIds = roles
                .Where(r => approved.Contains((r.NormalizedName ?? r.Name ?? "").Trim().ToUpperInvariant()))
                .Select(r => r.Id)
                .Distinct()
                .ToList();

            var linked = 0;
            foreach (var roleId in roleIds)
            {
                foreach (var permId in permIds)
                {
                    var already = await context.RolePermissions
                        .AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permId);
                    if (already) continue;

                    await context.RolePermissions.AddAsync(new Models.Domain.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = roleId,
                        PermissionId = permId,
                        CreatedAt = now,
                    });
                    linked++;
                }
            }

            if (linked > 0)
                await context.SaveChangesAsync();

            var optometristGranted = roles.Any(r =>
                string.Equals((r.NormalizedName ?? r.Name ?? "").Trim(), "OPTOMETRIST", StringComparison.OrdinalIgnoreCase));
            if (!optometristGranted)
                Console.WriteLine("OPTOMETRIST role is not provisioned in app_roles; permission grant was not created for that role.");

            Console.WriteLine(
                $"✓ diagnostic.oct.read linked ({linked} new row(s)) to {roleIds.Count} existing approved role(s)");
        }

        /// <summary>
        /// SQL 199: seed patient360.medication.read and grant only existing approved roles.
        /// Does not create roles. Idempotent.
        /// </summary>
        public static async Task SeedPatient360MedicationReadPermissionsAsync(AppDbContext context)
        {
            await SeedPermissionsAsync(context);

            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var now = DateTime.UtcNow;
            var code = Patient360MedicationReadPermissionCatalog.Code;

            var exists = await context.Permissions.AnyAsync(p =>
                p.TenantId == systemTenant && p.Code == code && p.IsActive);
            if (!exists)
            {
                await context.Permissions.AddAsync(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = systemTenant,
                    Code = code,
                    Name = Patient360MedicationReadPermissionCatalog.Name,
                    Module = Patient360MedicationReadPermissionCatalog.Module,
                    Action = Patient360MedicationReadPermissionCatalog.Action,
                    ResourceType = Patient360MedicationReadPermissionCatalog.ResourceType,
                    Scope = Patient360MedicationReadPermissionCatalog.Scope,
                    Description = Patient360MedicationReadPermissionCatalog.Description,
                    IsSystemPermission = true,
                    DepartmentSpecific = false,
                    IsCustom = false,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                await context.SaveChangesAsync();
            }

            var permIds = await context.Permissions
                .Where(p => p.TenantId == systemTenant && p.Code == code && p.IsActive)
                .Select(p => p.Id)
                .ToListAsync();

            if (permIds.Count == 0)
            {
                Console.WriteLine("⚠ patient360.medication.read missing — role links skipped");
                return;
            }

            var approved = Patient360MedicationReadPermissionCatalog.ApprovedRoleNormalizedNames;
            var roles = await context.Roles
                .Where(r => r.IsActive && r.DeletedAt == null)
                .ToListAsync();
            var roleIds = roles
                .Where(r => approved.Contains((r.NormalizedName ?? r.Name ?? "").Trim().ToUpperInvariant()))
                .Select(r => r.Id)
                .Distinct()
                .ToList();

            var linked = 0;
            foreach (var roleId in roleIds)
            {
                foreach (var permId in permIds)
                {
                    var already = await context.RolePermissions
                        .AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permId);
                    if (already) continue;

                    await context.RolePermissions.AddAsync(new Models.Domain.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = roleId,
                        PermissionId = permId,
                        CreatedAt = now,
                    });
                    linked++;
                }
            }

            if (linked > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ patient360.medication.read linked ({linked} new row(s)) to {roleIds.Count} existing approved role(s)");
        }

        /// <summary>
        /// SQL 200: seed patient360.diagnosis.read and grant only existing approved roles.
        /// Does not create roles. Idempotent.
        /// </summary>
        public static async Task SeedPatient360DiagnosisReadPermissionsAsync(AppDbContext context)
        {
            await SeedPermissionsAsync(context);

            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var now = DateTime.UtcNow;
            var code = Patient360DiagnosisReadPermissionCatalog.Code;

            var exists = await context.Permissions.AnyAsync(p =>
                p.TenantId == systemTenant && p.Code == code && p.IsActive);
            if (!exists)
            {
                await context.Permissions.AddAsync(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = systemTenant,
                    Code = code,
                    Name = Patient360DiagnosisReadPermissionCatalog.Name,
                    Module = Patient360DiagnosisReadPermissionCatalog.Module,
                    Action = Patient360DiagnosisReadPermissionCatalog.Action,
                    ResourceType = Patient360DiagnosisReadPermissionCatalog.ResourceType,
                    Scope = Patient360DiagnosisReadPermissionCatalog.Scope,
                    Description = Patient360DiagnosisReadPermissionCatalog.Description,
                    IsSystemPermission = true,
                    DepartmentSpecific = false,
                    IsCustom = false,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                await context.SaveChangesAsync();
            }

            var permIds = await context.Permissions
                .Where(p => p.TenantId == systemTenant && p.Code == code && p.IsActive)
                .Select(p => p.Id)
                .ToListAsync();

            if (permIds.Count == 0)
            {
                Console.WriteLine("⚠ patient360.diagnosis.read missing — role links skipped");
                return;
            }

            var approved = Patient360DiagnosisReadPermissionCatalog.ApprovedRoleNormalizedNames;
            var roles = await context.Roles
                .Where(r => r.IsActive && r.DeletedAt == null)
                .ToListAsync();
            var roleIds = roles
                .Where(r => approved.Contains((r.NormalizedName ?? r.Name ?? "").Trim().ToUpperInvariant()))
                .Select(r => r.Id)
                .Distinct()
                .ToList();

            var linked = 0;
            foreach (var roleId in roleIds)
            {
                foreach (var permId in permIds)
                {
                    var already = await context.RolePermissions
                        .AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permId);
                    if (already) continue;

                    await context.RolePermissions.AddAsync(new Models.Domain.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = roleId,
                        PermissionId = permId,
                        CreatedAt = now,
                    });
                    linked++;
                }
            }

            if (linked > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ patient360.diagnosis.read linked ({linked} new row(s)) to {roleIds.Count} existing approved role(s)");
        }

        /// <summary>
        /// SQL 201: link the existing patient.create permission to the six approved named roles.
        /// Does not create or update the permission. Does not create, rename, or delete roles.
        /// Does not remove grants held by any other role. Idempotent.
        /// </summary>
        public static async Task SeedPatientCreateRoleGrantsAsync(AppDbContext context)
        {
            var now = DateTime.UtcNow;
            var code = PatientCreateRoleGrantCatalog.Code;
            var permIds = await context.Permissions
                .Where(p => p.Code == code && p.IsActive)
                .Select(p => p.Id)
                .ToListAsync();

            if (permIds.Count == 0)
            {
                Console.WriteLine("⚠ patient.create missing — approved role links skipped");
                return;
            }

            var approved = PatientCreateRoleGrantCatalog.ApprovedRoleNormalizedNames;
            var roles = await context.Roles
                .Where(r => r.IsActive && r.DeletedAt == null)
                .ToListAsync();
            var roleIds = roles
                .Where(r => approved.Contains((r.NormalizedName ?? r.Name ?? "").Trim().ToUpperInvariant()))
                .Select(r => r.Id)
                .Distinct()
                .ToList();

            var linked = 0;
            foreach (var roleId in roleIds)
            {
                foreach (var permId in permIds)
                {
                    var already = await context.RolePermissions
                        .AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permId);
                    if (already) continue;

                    await context.RolePermissions.AddAsync(new Models.Domain.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = roleId,
                        PermissionId = permId,
                        CreatedAt = now,
                    });
                    linked++;
                }
            }

            if (linked > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ patient.create linked ({linked} new row(s)) to {roleIds.Count} existing approved role(s)");
        }

        /// <summary>
        /// L0 Laboratory UAT: ensure laboratory.view / patient.view / patient.update exist
        /// (existing FE gate + LabReportsController contracts) and grant them to Lab Technician
        /// and Lab Manager roles. Does not invent new permission codes or create roles. Idempotent.
        /// Admin unrestricted access is role-based wildcard in PermissionService — not granted here.
        /// </summary>
        public static async Task SeedLaboratoryL0UatPermissionsAsync(AppDbContext context)
        {
            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var now = DateTime.UtcNow;

            foreach (var def in LaboratoryL0UatPermissionCatalog.PermissionDefinitions)
            {
                var exists = await context.Permissions
                    .AnyAsync(p => p.Code == def.Code && p.IsActive);
                if (exists) continue;

                await context.Permissions.AddAsync(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = systemTenant,
                    Code = def.Code,
                    Name = def.Name,
                    Module = def.Module,
                    Action = def.Action,
                    ResourceType = def.ResourceType,
                    Scope = "branch",
                    Description = def.Description,
                    IsSystemPermission = true,
                    DepartmentSpecific = false,
                    IsCustom = false,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
            }

            await context.SaveChangesAsync();

            var permIds = await context.Permissions
                .Where(p => LaboratoryL0UatPermissionCatalog.RequiredPermissionCodes.Contains(p.Code) && p.IsActive)
                .Select(p => p.Id)
                .ToListAsync();

            if (permIds.Count == 0)
            {
                Console.WriteLine("⚠ Laboratory L0 UAT permissions missing — role links skipped");
                return;
            }

            var approved = LaboratoryL0UatPermissionCatalog.ApprovedRoleNormalizedNames;
            var roles = await context.Roles
                .Where(r => r.IsActive && r.DeletedAt == null)
                .ToListAsync();
            var roleIds = roles
                .Where(r => approved.Contains((r.NormalizedName ?? r.Name ?? "").Trim().ToUpperInvariant()))
                .Select(r => r.Id)
                .Distinct()
                .ToList();

            if (roleIds.Count == 0)
            {
                Console.WriteLine("⚠ No Lab Technician/Lab Manager roles — L0 UAT permission links skipped");
                return;
            }

            var linked = 0;
            foreach (var roleId in roleIds)
            {
                foreach (var permId in permIds)
                {
                    var already = await context.RolePermissions
                        .AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permId);
                    if (already) continue;

                    await context.RolePermissions.AddAsync(new Models.Domain.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = roleId,
                        PermissionId = permId,
                        CreatedAt = now,
                    });
                    linked++;
                }
            }

            if (linked > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ Laboratory L0 UAT permissions linked ({linked} new row(s)) to {roleIds.Count} Lab role(s)");
        }

        /// <summary>
        /// Enterprise LMS L0: ensure <c>lms.view</c> exists in the permission catalog.
        /// Does not grant to Lab Technician / Lab Manager (legacy laboratory.view remains separate).
        /// Role mapping is a Product Owner decision.
        /// </summary>
        public static async Task SeedEnterpriseLmsL0PermissionsAsync(AppDbContext context)
        {
            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var now = DateTime.UtcNow;
            var added = 0;

            foreach (var def in EnterpriseLmsL0PermissionCatalog.PermissionDefinitions)
            {
                var exists = await context.Permissions
                    .AnyAsync(p => p.Code == def.Code && p.IsActive);
                if (exists) continue;

                await context.Permissions.AddAsync(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = systemTenant,
                    Code = def.Code,
                    Name = def.Name,
                    Module = def.Module,
                    Action = def.Action,
                    ResourceType = def.ResourceType,
                    Scope = "branch",
                    Description = def.Description,
                    IsSystemPermission = true,
                    DepartmentSpecific = false,
                    IsCustom = false,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                added++;
            }

            if (added > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ Enterprise LMS L0 permission catalog ensured (lms.view; {added} new row(s); no role grants)");
        }

        /// <summary>
        /// L-CAT-01B: ensure catalogue permission codes exist. No role grants (PD-CAT-02).
        /// </summary>
        public static async Task SeedEnterpriseLmsCataloguePermissionsAsync(AppDbContext context)
        {
            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var now = DateTime.UtcNow;
            var added = 0;

            foreach (var def in EnterpriseLmsCataloguePermissionCatalog.PermissionDefinitions)
            {
                var exists = await context.Permissions
                    .AnyAsync(p => p.Code == def.Code && p.IsActive);
                if (exists) continue;

                await context.Permissions.AddAsync(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = systemTenant,
                    Code = def.Code,
                    Name = def.Name,
                    Module = def.Module,
                    Action = def.Action,
                    ResourceType = def.ResourceType,
                    Scope = "branch",
                    Description = def.Description,
                    IsSystemPermission = true,
                    DepartmentSpecific = false,
                    IsCustom = false,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                added++;
            }

            if (added > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ Enterprise LMS catalogue permissions ensured ({added} new row(s); no role grants)");
        }

        /// <summary>
        /// L-ORD-01B: ensure order permission codes exist. No role grants (PD-ORD-15).
        /// </summary>
        public static async Task SeedEnterpriseLmsOrdersPermissionsAsync(AppDbContext context)
        {
            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var now = DateTime.UtcNow;
            var added = 0;

            foreach (var def in EnterpriseLmsOrdersPermissionCatalog.PermissionDefinitions)
            {
                var exists = await context.Permissions
                    .AnyAsync(p => p.Code == def.Code && p.IsActive);
                if (exists) continue;

                await context.Permissions.AddAsync(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = systemTenant,
                    Code = def.Code,
                    Name = def.Name,
                    Module = def.Module,
                    Action = def.Action,
                    ResourceType = def.ResourceType,
                    Scope = "branch",
                    Description = def.Description,
                    IsSystemPermission = true,
                    DepartmentSpecific = false,
                    IsCustom = false,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                added++;
            }

            if (added > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ Enterprise LMS order permissions ensured ({added} new row(s); no role grants)");
        }

        /// <summary>
        /// L-COL-01B: ensure collection permission codes exist. No role grants (PD-COL-17).
        /// </summary>
        public static async Task SeedEnterpriseLmsCollectionPermissionsAsync(AppDbContext context)
        {
            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var now = DateTime.UtcNow;
            var added = 0;

            foreach (var def in EnterpriseLmsCollectionPermissionCatalog.PermissionDefinitions)
            {
                var exists = await context.Permissions
                    .AnyAsync(p => p.Code == def.Code && p.IsActive);
                if (exists) continue;

                await context.Permissions.AddAsync(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = systemTenant,
                    Code = def.Code,
                    Name = def.Name,
                    Module = def.Module,
                    Action = def.Action,
                    ResourceType = def.ResourceType,
                    Scope = "branch",
                    Description = def.Description,
                    IsSystemPermission = true,
                    DepartmentSpecific = false,
                    IsCustom = false,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                added++;
            }

            if (added > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ Enterprise LMS collection permissions ensured ({added} new row(s); no role grants)");
        }

        /// <summary>
        /// L-COL-01C: ensure specimen permission codes exist. No role grants (PD-COL-SPC-16).
        /// </summary>
        public static async Task SeedEnterpriseLmsSpecimenPermissionsAsync(AppDbContext context)
        {
            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var now = DateTime.UtcNow;
            var added = 0;

            foreach (var def in EnterpriseLmsSpecimenPermissionCatalog.PermissionDefinitions)
            {
                var exists = await context.Permissions
                    .AnyAsync(p => p.Code == def.Code && p.IsActive);
                if (exists) continue;

                await context.Permissions.AddAsync(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = systemTenant,
                    Code = def.Code,
                    Name = def.Name,
                    Module = def.Module,
                    Action = def.Action,
                    ResourceType = def.ResourceType,
                    Scope = "branch",
                    Description = def.Description,
                    IsSystemPermission = true,
                    DepartmentSpecific = false,
                    IsCustom = false,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                added++;
            }

            if (added > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ Enterprise LMS specimen permissions ensured ({added} new row(s); no role grants)");
        }

        /// <summary>
        /// L-TST-01A: ensure testing permission codes exist. No role grants (PD-TST-15).
        /// </summary>
        public static async Task SeedEnterpriseLmsTestingPermissionsAsync(AppDbContext context)
        {
            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var now = DateTime.UtcNow;
            var added = 0;

            foreach (var def in EnterpriseLmsTestingPermissionCatalog.PermissionDefinitions)
            {
                var exists = await context.Permissions
                    .AnyAsync(p => p.Code == def.Code && p.IsActive);
                if (exists) continue;

                await context.Permissions.AddAsync(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = systemTenant,
                    Code = def.Code,
                    Name = def.Name,
                    Module = def.Module,
                    Action = def.Action,
                    ResourceType = def.ResourceType,
                    Scope = "branch",
                    Description = def.Description,
                    IsSystemPermission = true,
                    DepartmentSpecific = false,
                    IsCustom = false,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                added++;
            }

            if (added > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ Enterprise LMS testing permissions ensured ({added} new row(s); no role grants)");
        }

        /// <summary>
        /// L-PORTAL-01 Gate A: ensure portal.invite.create exists. No role grants (Gate B not authorized).
        /// </summary>
        public static async Task SeedPortalInvitePermissionsAsync(AppDbContext context)
        {
            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var now = DateTime.UtcNow;
            var added = 0;

            foreach (var def in PortalInvitePermissionCatalog.PermissionDefinitions)
            {
                var exists = await context.Permissions
                    .AnyAsync(p => p.Code == def.Code && p.IsActive);
                if (exists) continue;

                await context.Permissions.AddAsync(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = systemTenant,
                    Code = def.Code,
                    Name = def.Name,
                    Module = def.Module,
                    Action = def.Action,
                    ResourceType = def.ResourceType,
                    Scope = "branch",
                    Description = def.Description,
                    IsSystemPermission = true,
                    DepartmentSpecific = false,
                    IsCustom = false,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                added++;
            }

            if (added > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ Portal invite permissions ensured ({added} new row(s); no role grants)");
        }

        /// <summary>
        /// L-PORTAL-01 Gate B: link existing portal.invite.create to RECEPTIONIST and COUNSELLOR only.
        /// Does not create or update the permission. Does not create, rename, or delete roles.
        /// Does not remove grants held by any other role. Idempotent. No Admin RolePermission rows.
        /// </summary>
        public static async Task SeedPortalInviteRoleGrantsAsync(AppDbContext context)
        {
            var now = DateTime.UtcNow;
            var code = PortalInviteRoleGrantCatalog.Code;
            var permIds = await context.Permissions
                .Where(p => p.Code == code && p.IsActive)
                .Select(p => p.Id)
                .ToListAsync();

            if (permIds.Count == 0)
            {
                Console.WriteLine("⚠ portal.invite.create missing — approved role links skipped");
                return;
            }

            var approved = PortalInviteRoleGrantCatalog.ApprovedRoleNormalizedNames;
            var roles = await context.Roles
                .Where(r => r.IsActive && r.DeletedAt == null)
                .ToListAsync();
            var roleIds = roles
                .Where(r => approved.Contains((r.NormalizedName ?? "").Trim().ToUpperInvariant()))
                .Select(r => r.Id)
                .Distinct()
                .ToList();

            var linked = 0;
            foreach (var roleId in roleIds)
            {
                foreach (var permId in permIds)
                {
                    var already = await context.RolePermissions
                        .AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permId);
                    if (already) continue;

                    await context.RolePermissions.AddAsync(new Models.Domain.RolePermission
                    {
                        Id = Guid.NewGuid(),
                        RoleId = roleId,
                        PermissionId = permId,
                        CreatedAt = now,
                    });
                    linked++;
                }
            }

            if (linked > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ portal.invite.create linked ({linked} new row(s)) to {roleIds.Count} existing approved role(s)");
        }

        /// <summary>
        /// L-REP-01: ensure report permission codes exist. No role grants (PD-REP-21).
        /// Finalize/Release/Download are catalogue-only; capabilities not implemented in foundation.
        /// </summary>
        public static async Task SeedEnterpriseLmsReportsPermissionsAsync(AppDbContext context)
        {
            var systemTenant = Guid.Parse("00000000-0000-0000-0000-000000000000");
            var now = DateTime.UtcNow;
            var added = 0;

            foreach (var def in EnterpriseLmsReportsPermissionCatalog.PermissionDefinitions)
            {
                var exists = await context.Permissions
                    .AnyAsync(p => p.Code == def.Code && p.IsActive);
                if (exists) continue;

                await context.Permissions.AddAsync(new Permission
                {
                    Id = Guid.NewGuid(),
                    TenantId = systemTenant,
                    Code = def.Code,
                    Name = def.Name,
                    Module = def.Module,
                    Action = def.Action,
                    ResourceType = def.ResourceType,
                    Scope = "branch",
                    Description = def.Description,
                    IsSystemPermission = true,
                    DepartmentSpecific = false,
                    IsCustom = false,
                    IsActive = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                });
                added++;
            }

            if (added > 0)
                await context.SaveChangesAsync();

            Console.WriteLine(
                $"✓ Enterprise LMS reports permissions ensured ({added} new row(s); no role grants)");
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
