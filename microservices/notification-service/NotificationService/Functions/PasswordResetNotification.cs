using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using NotificationService.Models.Requests;
using NotificationService.Services.Email;

namespace NotificationService.Functions;

/// <summary>
/// POST /api/notifications/password-reset
/// Called by AuthService after persisting a PasswordResetRequest.
/// </summary>
public class PasswordResetNotification
{
    private readonly IEmailService _emailService;
    private readonly ILogger<PasswordResetNotification> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public PasswordResetNotification(
        IEmailService emailService,
        ILogger<PasswordResetNotification> logger)
    {
        _emailService = emailService;
        _logger = logger;
    }

    [Function("SendPasswordResetEmail")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "notifications/password-reset")]
        HttpRequestData req,
        CancellationToken ct)
    {
        PasswordResetEmailRequest? body;
        try
        {
            body = await JsonSerializer.DeserializeAsync<PasswordResetEmailRequest>(
                req.Body, JsonOptions, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Invalid password-reset notification body");
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new { success = false, error = "Invalid request body." });
            bad.StatusCode = HttpStatusCode.BadRequest;
            return bad;
        }

        if (body is null
            || string.IsNullOrWhiteSpace(body.Email)
            || string.IsNullOrWhiteSpace(body.ResetUrl)
            || body.UserId == Guid.Empty
            || body.TenantId == Guid.Empty)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new
            {
                success = false,
                error = "email, resetUrl, userId, and tenantId are required.",
            });
            bad.StatusCode = HttpStatusCode.BadRequest;
            return bad;
        }

        // Log safe identifiers only — never the reset URL (contains token).
        _logger.LogInformation(
            "Password reset email requested - UserId: {UserId}, TenantId: {TenantId}, RecipientPresent: {HasEmail}",
            body.UserId,
            body.TenantId,
            !string.IsNullOrWhiteSpace(body.Email));

        var displayName = string.IsNullOrWhiteSpace(body.UserName) ? body.Email : body.UserName;
        var (success, messageId, error) = await _emailService.SendPasswordResetEmailAsync(
            toEmail: body.Email.Trim(),
            userName: displayName,
            resetUrl: body.ResetUrl,
            expiryHours: 1);

        if (!success)
        {
            _logger.LogWarning(
                "Password reset email delivery failed - UserId: {UserId}, ErrorCategory: provider_failure",
                body.UserId);
            var fail = req.CreateResponse(HttpStatusCode.BadGateway);
            await fail.WriteAsJsonAsync(new
            {
                success = false,
                error = "Failed to send password reset email. Please try again.",
            });
            fail.StatusCode = HttpStatusCode.BadGateway;
            return fail;
        }

        var ok = req.CreateResponse(HttpStatusCode.OK);
        await ok.WriteAsJsonAsync(new
        {
            success = true,
            messageId,
            message = "Password reset email sent",
        });
        ok.StatusCode = HttpStatusCode.OK;
        return ok;
    }
}
