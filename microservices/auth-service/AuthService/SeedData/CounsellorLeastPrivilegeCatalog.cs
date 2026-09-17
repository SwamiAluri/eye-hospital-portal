namespace AuthService.SeedData;

/// <summary>
/// Phase 2Z PD-RBAC-01 — Counsellor least-privilege permission sets.
/// Derived from documented seeds 142 / 156 / 189 (not from live over-grants).
/// </summary>
public static class CounsellorLeastPrivilegeCatalog
{
    /// <summary>
    /// MPI permissions required by counselling Waiting List Add Patient / session header.
    /// Linked by seeder + migration 191 — not granted via broad user.view.
    /// </summary>
    public static readonly string[] WorkflowPatientPermissionCodes =
    {
        "patient.view",
        "patient.create",
    };

    /// <summary>
    /// Quote → Package select/list only. Linked by seeder + migration 195.
    /// Does not include package_templates.create/update/delete.
    /// </summary>
    public static readonly string[] WorkflowPackageTemplatePermissionCodes =
    {
        "package_templates.read",
    };

    /// <summary>Permissions Counsellor must retain after least-privilege trim.</summary>
    public static readonly string[] RetainedPermissionCodes =
    {
        "counseling_sessions.read",
        "counseling_sessions.create",
        "counseling_sessions.update",
        "counseling_sessions.delete",
        "counseling_sessions.view",
        "counsellor.outpatient_checklist.edit",
        "ward.investigation.enter",
        "ward.investigation.verify",
        "ip.view",
        "bill.view",
        "opd_bill.view",
        "master_data.lookup",
        "dashboard.view",
        "patient.view",
        "patient.create",
        "package_templates.read",
    };

    /// <summary>
    /// Permissions to remove from Counsellor/Counselor roles when present.
    /// These arrived via migration 140 bulk grant + 156 grandfather of clinical
    /// codes for any role holding ward.checklist.edit / ot.safety.sign — not
    /// via the intentional Counsellor bundle in 156 section 4.
    /// </summary>
    public static readonly string[] RemovedFromCounsellorPermissionCodes =
    {
        "ip.admit",
        "ip.bed.transfer",
        "ip.discharge",
        "ip.ot.accept",
        "ip.ot.mark_ready",
        "ip.ot.send",
        "ip.ot.unmark_ready",
        "ip.postop.manage",
        "ip.surgery.complete",
        "ip.surgery.start",
        "ip_management.view",
        "ward.checklist.edit",
        "ot.safety.sign",
        "ot.safety.override",
        "anaesthesia.pac.edit",
        "anaesthesia.monitoring.edit",
        // Phase 3I Slice 6 D1 — supervisory reassign must never remain on Counsellor roles.
        "counseling_sessions.reassign",
    };
}
