using AuthService.SeedData;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Phase 2Z PD-RBAC-01 — Counsellor least-privilege baseline (documented seeds 142/156/189).
/// </summary>
public class CounsellorLeastPrivilegeCatalogTests
{
    [Fact]
    public void Baseline_includes_counselling_workflow_and_documented_reads()
    {
        var baseline = CounsellorLeastPrivilegeCatalog.RetainedPermissionCodes;
        Assert.Contains("counseling_sessions.read", baseline);
        Assert.Contains("counseling_sessions.create", baseline);
        Assert.Contains("counseling_sessions.update", baseline);
        Assert.Contains("counseling_sessions.delete", baseline);
        Assert.Contains("counseling_sessions.view", baseline);
        Assert.Contains("counsellor.outpatient_checklist.edit", baseline);
        Assert.Contains("ip.view", baseline);
        Assert.Contains("bill.view", baseline);
        Assert.Contains("opd_bill.view", baseline);
        Assert.Contains("ward.investigation.enter", baseline);
        Assert.Contains("ward.investigation.verify", baseline);
        Assert.Contains("master_data.lookup", baseline);
        Assert.Contains("dashboard.view", baseline);
        // Phase 2Z workflow RBAC: MPI read + register for Add Patient / session header
        Assert.Contains("patient.view", baseline);
        Assert.Contains("patient.create", baseline);
        // Phase 2X Slice 3D: Quote → Package select/list (not package admin CRUD)
        Assert.Contains("package_templates.read", baseline);
        Assert.DoesNotContain("package_templates.create", baseline);
        Assert.DoesNotContain("package_templates.update", baseline);
        Assert.DoesNotContain("package_templates.delete", baseline);
        // Counselling Session Documents + Patient 360 counselling content path
        Assert.Contains("session_documents.read", baseline);
        Assert.Contains("session_documents.create", baseline);
        Assert.Contains("session_documents.verify", baseline);
        Assert.Contains("session_documents.delete", baseline);
        Assert.DoesNotContain("session_notes.read", baseline);
        Assert.DoesNotContain("user.view", baseline);
        Assert.DoesNotContain("ot.theaters.view", baseline);
        Assert.DoesNotContain("patient.update", baseline);
        Assert.DoesNotContain("patient.admin", baseline);
    }

    [Fact]
    public void Workflow_patient_codes_are_explicit_and_not_stripped()
    {
        var remove = CounsellorLeastPrivilegeCatalog.RemovedFromCounsellorPermissionCodes;
        Assert.DoesNotContain("patient.view", remove);
        Assert.DoesNotContain("patient.create", remove);
        Assert.Equal(
            CounsellorLeastPrivilegeCatalog.WorkflowPatientPermissionCodes,
            new[] { "patient.view", "patient.create" });
    }

    [Fact]
    public void Workflow_session_documents_are_explicit_and_not_stripped()
    {
        var remove = CounsellorLeastPrivilegeCatalog.RemovedFromCounsellorPermissionCodes;
        Assert.Equal(
            CounsellorLeastPrivilegeCatalog.WorkflowSessionDocumentPermissionCodes,
            new[]
            {
                "session_documents.read",
                "session_documents.create",
                "session_documents.verify",
                "session_documents.delete",
            });
        foreach (var code in CounsellorLeastPrivilegeCatalog.WorkflowSessionDocumentPermissionCodes)
            Assert.DoesNotContain(code, remove);
    }

    [Fact]
    public void Workflow_package_template_read_is_explicit_and_not_stripped()
    {
        var remove = CounsellorLeastPrivilegeCatalog.RemovedFromCounsellorPermissionCodes;
        Assert.DoesNotContain("package_templates.read", remove);
        Assert.Equal(
            CounsellorLeastPrivilegeCatalog.WorkflowPackageTemplatePermissionCodes,
            new[] { "package_templates.read" });
        Assert.DoesNotContain("package_templates.create", CounsellorLeastPrivilegeCatalog.RetainedPermissionCodes);
        Assert.DoesNotContain("package_templates.update", CounsellorLeastPrivilegeCatalog.RetainedPermissionCodes);
        Assert.DoesNotContain("package_templates.delete", CounsellorLeastPrivilegeCatalog.RetainedPermissionCodes);
    }

    [Fact]
    public void Removed_codes_are_ip_ward_ot_mutations_not_in_counsellor_bundle()
    {
        var remove = CounsellorLeastPrivilegeCatalog.RemovedFromCounsellorPermissionCodes;
        Assert.Contains("ip.admit", remove);
        Assert.Contains("ip.discharge", remove);
        Assert.Contains("ip.surgery.start", remove);
        Assert.Contains("ip.ot.send", remove);
        Assert.Contains("ward.checklist.edit", remove);
        Assert.Contains("ot.safety.sign", remove);
        Assert.Contains("ot.safety.override", remove);
        Assert.Contains("anaesthesia.pac.edit", remove);
        Assert.Contains("anaesthesia.monitoring.edit", remove);
        Assert.Contains("ip_management.view", remove);
        Assert.DoesNotContain("ip.view", remove);
        Assert.DoesNotContain("bill.view", remove);
        Assert.DoesNotContain("counseling_sessions.read", remove);
        Assert.DoesNotContain("ward.investigation.enter", remove);
        // Phase 3I Slice 6 D1 — reassign is supervisory; strip from Counsellor if present
        Assert.Contains("counseling_sessions.reassign", remove);
        Assert.DoesNotContain(
            "counseling_sessions.reassign",
            CounsellorLeastPrivilegeCatalog.RetainedPermissionCodes);
    }

    [Fact]
    public void Retained_and_removed_sets_are_disjoint()
    {
        var overlap = CounsellorLeastPrivilegeCatalog.RetainedPermissionCodes
            .Intersect(CounsellorLeastPrivilegeCatalog.RemovedFromCounsellorPermissionCodes, StringComparer.Ordinal)
            .ToList();
        Assert.Empty(overlap);
    }
}
