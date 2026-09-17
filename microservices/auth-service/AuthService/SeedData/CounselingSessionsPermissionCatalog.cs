using AuthService.Models.Domain;

namespace AuthService.SeedData;

/// <summary>
/// System-tenant catalog for counselling desk session permissions used by
/// CounselingController, sidebar, and ProtectedRoute (<c>counseling_sessions.*</c>).
/// Mirrors consolidated migration 189 + Phase 3I Slice 6 D1 (migration 196).
/// </summary>
internal static class CounselingSessionsPermissionCatalog
{
    /// <summary>
    /// Phase 3I Slice 6 D1 — supervisory General Reassign (A→B). Not initial Assign; not lifecycle Claim.
    /// </summary>
    internal const string ReassignPermissionCode = "counseling_sessions.reassign";

    /// <summary>
    /// Baseline counselling session codes granted to Counsellor/Counselor roles (migration 189).
    /// Does <strong>not</strong> include <see cref="ReassignPermissionCode"/>.
    /// </summary>
    internal static readonly string[] Codes =
    {
        "counseling_sessions.read",
        "counseling_sessions.create",
        "counseling_sessions.update",
        "counseling_sessions.delete",
        "counseling_sessions.view",
    };

    /// <summary>
    /// Roles that receive a seeded grant of <see cref="ReassignPermissionCode"/>.
    /// Permission-based supervisory users outside this seed receive the code via IAM role editing (PD-SUP-01).
    /// Do not invent a hard-coded Supervisor role.
    /// </summary>
    internal static readonly string[] ReassignRoleNormalizedNames =
    {
        "ADMIN",
    };

    internal static IReadOnlyList<Permission> Create(Guid tenantId, DateTime now)
    {
        Permission Perm(
            string code,
            string name,
            string action,
            string description) => new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = code,
            Name = name,
            Module = "counsellor",
            Action = action,
            ResourceType = "counseling_sessions",
            Scope = "branch",
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
            Perm("counseling_sessions.read", "Read Counseling Sessions", "read",
                "View counselling waiting list, sessions, follow-up center, and analytics"),
            Perm("counseling_sessions.create", "Create Counseling Sessions", "create",
                "Create counselling sessions from waiting list / queue"),
            Perm("counseling_sessions.update", "Update Counseling Sessions", "update",
                "Start, update, and complete counselling sessions and follow-up actions"),
            Perm("counseling_sessions.delete", "Delete Counseling Sessions", "delete",
                "Soft-delete counselling sessions"),
            Perm("counseling_sessions.view", "View Counseling Session Detail", "view",
                "View individual counselling session detail (legacy alias of read)"),
            Perm(ReassignPermissionCode, "Reassign Counseling Session Ownership", "reassign",
                "Supervisory reassignment of an already-owned counselling session to another authorized counsellor (A→B). Does not establish initial ownership (Assign) or lifecycle claim."),
        ];
    }
}
