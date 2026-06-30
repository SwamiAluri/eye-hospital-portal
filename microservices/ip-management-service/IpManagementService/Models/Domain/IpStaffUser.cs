namespace IpManagementService.Models.Domain;

/// <summary>
/// Read-only projection of the auth-service <c>users</c> table, used only to
/// resolve staff display names (e.g. who entered/verified an investigation).
/// Excluded from migrations — the table is owned by the auth service.
/// </summary>
public class IpStaffUser
{
    public Guid    Id        { get; set; }
    public string? FirstName { get; set; }
    public string? LastName  { get; set; }

    public string FullName => $"{FirstName} {LastName}".Trim();
}
