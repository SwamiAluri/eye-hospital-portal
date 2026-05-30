using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net.Http.Json;

namespace NotificationService.Services.Email;

public class ResendEmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<ResendEmailService> _logger;
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;

    public ResendEmailService(IConfiguration configuration, ILogger<ResendEmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
        
        _apiKey = _configuration["Resend:ApiKey"] ?? throw new InvalidOperationException("Resend API Key not configured");
        _httpClient = new HttpClient();
        _httpClient.BaseAddress = new Uri("https://api.resend.com/");
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {_apiKey}");
    }

    public async Task<(bool Success, string? MessageId, string? Error)> SendActivationOtpAsync(
        string toEmail,
        string userName,
        string otpCode,
        int expiryHours,
        string userId)
    {
        try
        {
            var fromEmail = _configuration["Resend:FromEmail"] ?? "noreply@yourhospital.com";
            var fromName = _configuration["Resend:FromName"] ?? "Hospital Portal";

            var htmlBody = GetActivationEmailTemplate(userName, otpCode, expiryHours);

            var payload = new
            {
                from = $"{fromName} <{fromEmail}>",
                to = new[] { toEmail },
                subject = "Hospital Portal - Account Activation",
                html = htmlBody
            };

            var response = await _httpClient.PostAsJsonAsync("emails", payload);
            response.EnsureSuccessStatusCode();
            
            var result = await response.Content.ReadFromJsonAsync<ResendEmailResponse>();
            var messageId = result?.Id ?? Guid.NewGuid().ToString();
            
            _logger.LogInformation("Activation email sent to {Email}, MessageId: {MessageId}", toEmail, messageId);

            return (true, messageId, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send activation email to {Email}", toEmail);
            return (false, null, ex.Message);
        }
    }

    public async Task<(bool Success, string? MessageId, string? Error)> SendMfaLoginOtpAsync(
        string toEmail,
        string userName,
        string otpCode,
        int expiryMinutes)
    {
        try
        {
            var fromEmail = _configuration["Resend:FromEmail"] ?? "noreply@yourhospital.com";
            var fromName = _configuration["Resend:FromName"] ?? "Hospital Portal";

            var htmlBody = GetMfaLoginEmailTemplate(userName, otpCode, expiryMinutes);

            var payload = new
            {
                from = $"{fromName} <{fromEmail}>",
                to = new[] { toEmail },
                subject = "Hospital Portal - MFA Login Code",
                html = htmlBody
            };

            var response = await _httpClient.PostAsJsonAsync("emails", payload);
            response.EnsureSuccessStatusCode();
            
            var result = await response.Content.ReadFromJsonAsync<ResendEmailResponse>();
            var messageId = result?.Id ?? Guid.NewGuid().ToString();

            _logger.LogInformation("MFA login email sent to {Email}, MessageId: {MessageId}", toEmail, messageId);

            return (true, messageId, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send MFA login email to {Email}", toEmail);
            return (false, null, ex.Message);
        }
    }

    public async Task<(bool Success, string? MessageId, string? Error)> SendMfaResetNotificationAsync(
        string toEmail,
        string userName,
        string resetByAdmin,
        DateTime resetAt)
    {
        try
        {
            var fromEmail = _configuration["Resend:FromEmail"] ?? "noreply@yourhospital.com";
            var fromName = _configuration["Resend:FromName"] ?? "Hospital Portal";

            var htmlBody = GetMfaResetNotificationTemplate(userName, resetByAdmin, resetAt);

            var payload = new
            {
                from = $"{fromName} <{fromEmail}>",
                to = new[] { toEmail },
                subject = "Hospital Portal - MFA Settings Reset",
                html = htmlBody
            };

            var response = await _httpClient.PostAsJsonAsync("emails", payload);
            response.EnsureSuccessStatusCode();
            
            var result = await response.Content.ReadFromJsonAsync<ResendEmailResponse>();
            var messageId = result?.Id ?? Guid.NewGuid().ToString();

            _logger.LogInformation("MFA reset notification sent to {Email}, MessageId: {MessageId}", toEmail, messageId);

            return (true, messageId, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send MFA reset notification to {Email}", toEmail);
            return (false, null, ex.Message);
        }
    }

    private string GetActivationEmailTemplate(string userName, string otpCode, int expiryHours)
    {
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <style>
        body {{ font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }}
        .container {{ max-width: 600px; margin: 40px auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .header {{ color: #1e40af; margin-bottom: 30px; }}
        .otp-box {{ background: #f0f9ff; border: 2px solid #3b82f6; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0; }}
        .otp-code {{ font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1e40af; font-family: 'Courier New', monospace; }}
        .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }}
        .steps {{ background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0; }}
        .steps ol {{ margin: 10px 0; padding-left: 20px; }}
        .steps li {{ margin: 8px 0; color: #374151; }}
        .warning {{ background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; color: #92400e; }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>
            <h2>Welcome to Hospital Portal</h2>
        </div>
        
        <p>Hello <strong>{userName}</strong>,</p>
        <p>Your account has been created. Use the code below to activate your account and set your password:</p>
        
        <div class='otp-box'>
            <div class='otp-code'>{otpCode}</div>
            <p style='margin-top: 10px; color: #6b7280;'>Valid for {expiryHours} hours</p>
        </div>
        
        <div class='steps'>
            <p><strong>Next Steps:</strong></p>
            <ol>
                <li>Visit <a href='http://localhost:3000/login'>Hospital Portal Login</a></li>
                <li>Enter your username and the activation code above</li>
                <li>Set your permanent password</li>
                <li>Start using Hospital Portal</li>
            </ol>
        </div>
        
        <div class='warning'>
            ⚠️ <strong>Security Notice:</strong> Never share this code with anyone. Our staff will never ask for it.
        </div>
        
        <div class='footer'>
            <p>If you didn't request this activation, please contact your system administrator immediately.</p>
            <p>© 2026 Hospital Portal. All rights reserved.</p>
        </div>
    </div>
</body>
</html>";
    }

    private string GetMfaLoginEmailTemplate(string userName, string otpCode, int expiryMinutes)
    {
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <style>
        body {{ font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }}
        .container {{ max-width: 600px; margin: 40px auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .otp-box {{ background: #f0fdf4; border: 2px solid #10b981; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0; }}
        .otp-code {{ font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #047857; font-family: 'Courier New', monospace; }}
        .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }}
    </style>
</head>
<body>
    <div class='container'>
        <h2>Login Verification Code</h2>
        <p>Hello <strong>{userName}</strong>,</p>
        <p>Enter this code to complete your login:</p>
        
        <div class='otp-box'>
            <div class='otp-code'>{otpCode}</div>
            <p style='margin-top: 10px; color: #6b7280;'>Expires in {expiryMinutes} minutes</p>
        </div>
        
        <p style='color: #dc2626; font-weight: 500;'>If you didn't attempt to login, please secure your account immediately.</p>
        
        <div class='footer'>
            <p>© 2026 Hospital Portal. All rights reserved.</p>
        </div>
    </div>
</body>
</html>";
    }

    private string GetMfaResetNotificationTemplate(string userName, string resetByAdmin, DateTime resetAt)
    {
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <style>
        body {{ font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }}
        .container {{ max-width: 600px; margin: 40px auto; background: white; padding: 40px; border-radius: 8px; }}
        .warning {{ background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; }}
    </style>
</head>
<body>
    <div class='container'>
        <h2>MFA Settings Reset</h2>
        <p>Hello <strong>{userName}</strong>,</p>
        
        <div class='warning'>
            <p><strong>⚠️ Your backup codes were regenerated by administrator {resetByAdmin} on {resetAt:MMM dd, yyyy 'at' HH:mm} UTC.</strong></p>
        </div>
        
        <p>Please contact the administrator to receive your new backup codes securely.</p>
        <p><strong>Your old backup codes are no longer valid.</strong></p>
        
        <p style='margin-top: 30px; color: #6b7280; font-size: 14px;'>
            © 2026 Hospital Portal. All rights reserved.
        </p>
    </div>
</body>
</html>";
    }

    // Purchase return event emails are only supported via AzureEmailService.
    // ResendEmailService is a legacy fallback; delegate to a minimal implementation.
    public Task<(bool Success, string? MessageId, string? Error)> SendPurchaseReturnEventAsync(
        string toEmail, string vendorName, string returnNumber, string eventType,
        decimal netAmount, DateTime eventAt,
        string? creditNoteNumber = null, decimal? creditNoteAmount = null, string? cancellationReason = null)
    {
        _logger.LogWarning("SendPurchaseReturnEventAsync called on ResendEmailService (legacy) — not implemented.");
        return Task.FromResult<(bool, string?, string?)>((false, null, "Not implemented in legacy email provider."));
    }

    public async Task<(bool Success, string? MessageId, string? Error)> SendGenericEmailAsync(
        string toEmail,
        string subject,
        string htmlBody,
        string? plainTextBody = null)
    {
        try
        {
            var fromEmail = _configuration["Resend:FromEmail"] ?? "noreply@yourhospital.com";
            var payload = new
            {
                from = fromEmail,
                to = new[] { toEmail },
                subject,
                html = htmlBody,
                text = plainTextBody ?? htmlBody,
            };
            var response = await _httpClient.PostAsJsonAsync("emails", payload);
            if (!response.IsSuccessStatusCode)
                return (false, null, await response.Content.ReadAsStringAsync());
            var result = await response.Content.ReadFromJsonAsync<ResendEmailResponse>();
            return (true, result?.Id, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SendGenericEmailAsync failed for {To}", toEmail);
            return (false, null, ex.Message);
        }
    }
}

// Response model for Resend API
internal class ResendEmailResponse
{
    public string? Id { get; set; }
}
