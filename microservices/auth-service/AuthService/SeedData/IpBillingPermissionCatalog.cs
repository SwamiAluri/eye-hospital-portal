using AuthService.Models.Domain;

namespace AuthService.SeedData;

/// <summary>
/// System-tenant catalog for IP + billing permission codes from SQL 156
/// plus A5 (<c>ip.safety_token.print</c>).
/// <c>ip.implant.mismatch.override</c> (A2) is already listed in the CCMS
/// seeder block — do not add it here or a greenfield seed would insert twice
/// before SaveChanges.
/// </summary>
internal static class IpBillingPermissionCatalog
{
    internal static IReadOnlyList<Permission> Create(Guid tenantId, DateTime now)
    {
        Permission Perm(
            string code,
            string name,
            string module,
            string action,
            string resourceType,
            string scope,
            string description) => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = code,
            Name = name,
            Module = module,
            Action = action,
            ResourceType = resourceType,
            Scope = scope,
            Description = description,
            IsSystemPermission = true,
            DepartmentSpecific = false,
            IsCustom = false,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
        };

        return
        [
            // IP clinical lifecycle (156)
            Perm("ip.view", "View IP Patients", "ip_management", "view", "patient_journey", "branch",
                "View the inpatient census and patient journeys"),
            Perm("ip.admit", "Admit Patient", "ip_management", "admit", "patient_journey", "branch",
                "Admit an expected patient and assign a bed"),
            Perm("ip.bed.transfer", "Transfer Bed", "ip_management", "transfer", "bed_inventory", "branch",
                "Move an admitted patient to a different bed"),
            Perm("ip.ot.mark_ready", "Mark Ready for OT", "ip_management", "update", "patient_journey", "branch",
                "Mark a patient ready for surgery once pre-op gates pass"),
            Perm("ip.ot.unmark_ready", "Revert Ready for OT", "ip_management", "update", "patient_journey", "branch",
                "Reverse an incorrect Ready for OT with a reason"),
            Perm("ip.ot.send", "Send Patient to OT", "ip_management", "update", "patient_journey", "branch",
                "Send a ready patient to the operating theatre"),
            Perm("ip.ot.accept", "Accept Patient into OT", "ip_management", "update", "patient_journey", "branch",
                "Accept a patient into the theatre"),
            Perm("ip.surgery.start", "Start Surgery", "ip_management", "update", "patient_journey", "branch",
                "Record surgery start"),
            Perm("ip.surgery.complete", "Complete Surgery", "ip_management", "update", "patient_journey", "branch",
                "Record surgery completion"),
            Perm("ip.postop.manage", "Manage Post-Op Recovery", "ip_management", "update", "patient_journey", "branch",
                "Record post-operative recovery and observations"),
            Perm("ip.discharge", "Discharge Patient", "ip_management", "discharge", "patient_journey", "branch",
                "Discharge a patient once clearance gates pass"),
            Perm("ip.discharge.override", "Override Discharge Blocks", "ip_management", "override", "patient_journey", "branch",
                "Discharge despite outstanding blockers, with a reason"),
            // IP-side money (156)
            Perm("ip.billing.collect", "Collect IP Payment", "billing", "create", "opd_bill", "branch",
                "Collect an advance or payment against an IP bill"),
            Perm("ip.billing.refund", "Refund IP Payment", "billing", "refund", "opd_bill", "branch",
                "Raise a refund against an IP bill"),
            Perm("ip.billing.adjust", "Adjust IP Bill", "billing", "update", "opd_bill", "branch",
                "Apply a discount or adjustment to an IP bill"),
            // Billing service codes (156)
            Perm("bill.view", "View Bills", "billing", "view", "opd_bill", "branch",
                "View bills and their line items"),
            Perm("bill.reconciliation.view", "View Charge Reconciliation", "billing", "view", "charge_reconciliation", "branch",
                "Access Charge Reconciliation operational reports (implant/stock/charge exceptions and wastage)"),
            Perm("bill.create", "Create Bill", "billing", "create", "opd_bill", "branch",
                "Create a bill for an admitted patient who has none"),
            Perm("bill.update", "Update Bill", "billing", "update", "opd_bill", "branch",
                "Add charges or payments to an existing bill"),
            Perm("bill.admin", "Administer Billing Rules", "billing", "admin", "billing_rules", "tenant",
                "Manage billing rules, rates and catalog mapping"),
            Perm("opd_bill.view", "View OPD Bill", "billing", "view", "opd_bill", "branch",
                "View OPD and IP bill detail"),
            Perm("opd_bill.refund", "Request OPD Bill Refund", "billing", "refund", "opd_bill", "branch",
                "Request a refund on a bill"),
            Perm("opd_bill.refund.authorize", "Authorise Bill Refund", "billing", "approve", "opd_bill", "branch",
                "Approve a requested refund (second pair of eyes)"),
            // A5 / SQL 172
            Perm("ip.safety_token.print", "Print safety token", "ip_management", "update", "patient_journey", "branch",
                "Print or reprint the inpatient wristband"),
        ];
    }
}
