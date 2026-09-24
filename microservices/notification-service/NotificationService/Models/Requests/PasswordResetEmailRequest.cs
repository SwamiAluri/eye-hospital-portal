namespace NotificationService.Models.Requests;

/// <summary>
/// Payload from AuthService NotificationClient.SendPasswordResetEmailAsync.
/// </summary>
public class PasswordResetEmailRequest
{
    public Guid UserId { get; set; }
    public Guid TenantId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string ResetUrl { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string? TemplateType { get; set; }
}
