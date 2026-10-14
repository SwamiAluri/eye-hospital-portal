namespace AuthService.Services;

/// <summary>
/// DUP-C3A.2b — Safe attribute identifiers for create-scoped match evidence.
/// Wire values are stable strings (not raw PHI).
/// </summary>
public static class RegistrationDuplicateAttributeSignals
{
    public const string FirstName = "FirstName";
    public const string LastName = "LastName";
    public const string DateOfBirth = "DateOfBirth";
    public const string Phone = "Phone";
    public const string Email = "Email";

    /// <summary>Stable emission order for matched/different lists.</summary>
    public static readonly string[] EmissionOrder =
    {
        FirstName,
        LastName,
        DateOfBirth,
        Phone,
        Email,
    };
}
