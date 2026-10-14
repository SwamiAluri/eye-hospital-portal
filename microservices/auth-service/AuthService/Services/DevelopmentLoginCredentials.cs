namespace AuthService.Services;

/// <summary>
/// Shared Development login credential identifiers already used by AuthController
/// demo login and the hospital-portal login form defaults. Lab UAT bootstrap aligns
/// to this convention when LAB_UAT_PASSWORD / LabUatAccounts:Password are unset.
/// Do not use outside Development.
/// </summary>
public static class DevelopmentLoginCredentials
{
    public const string AdminTestEmail = "admin@test.com";
    public const string AdminHospitalEmail = "admin@hospital.com";

    /// <summary>
    /// Same Development password already hardcoded for admin@test.com demo login
    /// and the portal login form default. Lab UAT accounts reuse this convention.
    /// </summary>
    public const string AdminTestPassword = "Admin123!";

    public const string AdminHospitalPassword = "Admin@123456";
}
