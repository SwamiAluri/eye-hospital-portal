using AuthService.Models.Domain;

namespace AuthService.SeedData;

/// <summary>
/// System-tenant catalog for counselling session document permissions used by
/// CounselingController + CounselingSessionDocumentPatientReadController (<c>session_documents.*</c>).
/// Linked to Counsellor/Counselor roles by seeder + migration 202.
/// </summary>
internal static class SessionDocumentsPermissionCatalog
{
    /// <summary>
    /// Certified counselling session document codes for Counsellor workflow
    /// (upload, Patient 360 discovery/content, verify, creator-owned soft-delete).
    /// </summary>
    internal static readonly string[] Codes =
    {
        "session_documents.read",
        "session_documents.create",
        "session_documents.verify",
        "session_documents.delete",
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
            ResourceType = "session_documents",
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
            Perm("session_documents.read", "Read Session Documents", "read",
                "View counselling session documents and Patient 360 counselling document metadata/content"),
            Perm("session_documents.create", "Upload Session Documents", "create",
                "Upload counselling session documents (requires an existing counselling session)"),
            Perm("session_documents.verify", "Verify Session Documents", "verify",
                "Verify counselling session documents in the certified counselling workflow"),
            Perm("session_documents.delete", "Delete Session Documents", "delete",
                "Soft-delete counselling session documents when creator ownership permits"),
        ];
    }
}
