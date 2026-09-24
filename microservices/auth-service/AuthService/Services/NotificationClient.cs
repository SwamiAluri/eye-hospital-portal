using System.Net.Http.Json;

namespace AuthService.Services;

public interface INotificationClient
{
    Task<(bool Success, Guid? OtpId, string? Otp, string? Error)> SendActivationOtpAsync(Guid userId, Guid tenantId, string deliveryMethod, string recipient);
    Task<(bool Success, bool RequirePasswordSetup, string? TempToken, string? Error)> VerifyActivationOtpAsync(string recipient, string otp);
    Task<(bool Success, Guid? OtpId, string? Error)> SendMfaLoginOtpAsync(Guid userId, string method);
    Task<(bool Success, string? Token, string? Error)> VerifyMfaLoginAsync(Guid userId, string code, string method);
    Task<(bool Success, string? Error)> SendPasswordResetEmailAsync(Guid userId, Guid tenantId, string email, string resetUrl, string userName);
}

public class NotificationClient : INotificationClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<NotificationClient> _logger;
    private readonly string _notificationServiceUrl;
    private readonly bool _useMockService;

    public NotificationClient(IConfiguration configuration, ILogger<NotificationClient> logger)
    {
        _logger = logger;
        _notificationServiceUrl = configuration["NotificationService:BaseUrl"] ?? "http://localhost:7073";
        _useMockService = configuration.GetValue<bool>("NotificationService:UseMockService", false);
        
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(_notificationServiceUrl)
        };
        
        if (_useMockService)
        {
            _logger.LogWarning("⚠️ NotificationClient is running in MOCK MODE - emails will NOT be sent!");
        }
    }

    public async Task<(bool Success, Guid? OtpId, string? Otp, string? Error)> SendActivationOtpAsync(
        Guid userId,
        Guid tenantId,
        string deliveryMethod, 
        string recipient)
    {
        try
        {
            _logger.LogInformation("[NotificationClient] Starting SendActivationOtpAsync - UserId: {UserId}, TenantId: {TenantId}, Method: {Method}, Recipient: {Recipient}",
                userId, tenantId, deliveryMethod, recipient);

            // MOCK MODE: Generate OTP locally and log it
            if (_useMockService)
            {
                var mockOtpId = Guid.NewGuid();
                var mockOtp = new Random().Next(100000, 999999).ToString();
                
                _logger.LogWarning("📧 MOCK ACTIVATION OTP for {Recipient}: {Otp} (OTP ID: {OtpId})", recipient, mockOtp, mockOtpId);
                _logger.LogWarning("   UserId: {UserId}, TenantId: {TenantId}, Delivery: {Method}", userId, tenantId, deliveryMethod);
                
                return (true, mockOtpId, mockOtp, null);
            }

            var request = new
            {
                userId = userId,
                tenantId = tenantId,
                deliveryMethod = deliveryMethod,
                recipient = recipient
            };

            var json = System.Text.Json.JsonSerializer.Serialize(request);
            _logger.LogInformation("[NotificationClient] Request payload: {Json}", json);
            
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
            var url = $"{_notificationServiceUrl}/api/activation/send-otp";
            _logger.LogInformation("Posting to URL: {Url}", url);
            
            var response = await _httpClient.PostAsync(url, content);
            
            var responseBody = await response.Content.ReadAsStringAsync();
            _logger.LogInformation("Notification service response - Status: {StatusCode}, Body: {Body}",
                response.StatusCode, responseBody);
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Failed to send activation OTP: {StatusCode} - {Error}", response.StatusCode, responseBody);
                return (false, null, null, $"Failed to send OTP: {response.StatusCode}");
            }

            var result = await response.Content.ReadFromJsonAsync<SendOtpResponse>();
            
            // Check if the notification service returned success=false (e.g., rate limit, validation error)
            if (result?.Success == false)
            {
                _logger.LogWarning("[NotificationClient] Notification service returned Success=false - Message: {Message}", result.Message);
                return (false, null, null, result.Message ?? "Unknown error from notification service");
            }
            
            return (result?.Success ?? false, result?.OtpId, result?.Otp, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[NotificationClient] Exception in SendActivationOtpAsync - UserId: {UserId}, TenantId: {TenantId}, Error: {Error}",
                userId, tenantId, ex.Message);
            return (false, null, null, ex.Message);
        }
    }

    public async Task<(bool Success, bool RequirePasswordSetup, string? TempToken, string? Error)> VerifyActivationOtpAsync(
        string recipient, 
        string otp)
    {
        try
        {
            var request = new
            {
                recipient = recipient,
                otp = otp
            };

            var response = await _httpClient.PostAsJsonAsync("/api/activation/verify-otp", request);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("Failed to verify activation OTP: {StatusCode} - {Error}", response.StatusCode, errorContent);
                return (false, false, null, $"Failed to verify OTP: {response.StatusCode}");
            }

            var result = await response.Content.ReadFromJsonAsync<VerifyOtpResponse>();
            return (result?.Success ?? false, result?.RequirePasswordSetup ?? false, result?.TempToken, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling notification service to verify activation OTP");
            return (false, false, null, ex.Message);
        }
    }

    public async Task<(bool Success, Guid? OtpId, string? Error)> SendMfaLoginOtpAsync(
        Guid userId, 
        string method)
    {
        try
        {
            var request = new
            {
                userId = userId,
                method = method
            };

            var response = await _httpClient.PostAsJsonAsync("/api/mfa/send-login-otp", request);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("Failed to send MFA login OTP: {StatusCode} - {Error}", response.StatusCode, errorContent);
                return (false, null, $"Failed to send MFA OTP: {response.StatusCode}");
            }

            var result = await response.Content.ReadFromJsonAsync<SendOtpResponse>();
            return (result?.Success ?? false, result?.OtpId, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling notification service to send MFA login OTP");
            return (false, null, ex.Message);
        }
    }

    public async Task<(bool Success, string? Token, string? Error)> VerifyMfaLoginAsync(
        Guid userId, 
        string code, 
        string method)
    {
        try
        {
            var request = new
            {
                UserId = userId,
                Code = code,
                Method = method
            };

            var response = await _httpClient.PostAsJsonAsync("/api/mfa/verify-login", request);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("Failed to verify MFA login: {StatusCode} - {Error}", response.StatusCode, errorContent);
                return (false, null, $"Failed to verify MFA: {response.StatusCode}");
            }

            var result = await response.Content.ReadFromJsonAsync<VerifyMfaResponse>();
            return (result?.Success ?? false, result?.Token, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling notification service to verify MFA login");
            return (false, null, ex.Message);
        }
    }

    /// <summary>
    /// Sends password reset email with secure reset link
    /// </summary>
    public async Task<(bool Success, string? Error)> SendPasswordResetEmailAsync(
        Guid userId,
        Guid tenantId,
        string email,
        string resetUrl,
        string userName)
    {
        try
        {
            _logger.LogInformation("[NotificationClient] Sending password reset email - UserId: {UserId}, Email: {Email}",
                userId, email);

            // MOCK MODE: Log the reset URL instead of sending
            if (_useMockService)
            {
                _logger.LogWarning("🔐 [MOCK MODE] Password Reset Email:");
                _logger.LogWarning("   To: {Email}", email);
                _logger.LogWarning("   User: {UserName}", userName);
                _logger.LogWarning("   Reset URL: {ResetUrl}", resetUrl);
                _logger.LogWarning("   Expires: 1 hour from now");
                
                return (true, null);
            }

            // Use StringContent + Content-Length (same pattern as SendActivationOtpAsync).
            // Chunked JSON content without Content-Length is dropped by the Azure Functions
            // isolated worker (empty body → 400) even when curl/PowerShell probes succeed.
            var requestBody = new
            {
                userId,
                tenantId,
                email,
                resetUrl,
                userName,
                templateType = "password_reset"
            };

            var json = System.Text.Json.JsonSerializer.Serialize(requestBody);
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
            var url = $"{_notificationServiceUrl.TrimEnd('/')}/api/notifications/password-reset";
            _logger.LogInformation(
                "[NotificationClient] Posting password-reset notification - Url: {Url}, PayloadBytes: {Bytes}",
                url,
                content.Headers.ContentLength);

            var response = await _httpClient.PostAsync(url, content);
            var responseBody = await response.Content.ReadAsStringAsync();
            _logger.LogInformation(
                "[NotificationClient] Password-reset notification response - Status: {StatusCode}",
                response.StatusCode);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Password reset email accepted by notification service for user {UserId}", userId);
                return (true, null);
            }

            _logger.LogError(
                "Failed to send password reset email. Status: {Status}, Error: {Error}",
                response.StatusCode,
                responseBody);

            return (false, $"Failed to send email: {response.StatusCode}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception sending password reset email to {Email}", email);
            return (false, ex.Message);
        }
    }
}

// Response DTOs
internal class SendOtpResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public Guid? OtpId { get; set; }
    public string? Otp { get; set; }  // The actual OTP code
    public DateTime? ExpiresAt { get; set; }
    public string? MaskedRecipient { get; set; }
}

internal class VerifyOtpResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public Guid? UserId { get; set; }
    public bool RequirePasswordSetup { get; set; }
    public string? TempToken { get; set; }
    public int? AttemptsRemaining { get; set; }
}

internal class VerifyMfaResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? Token { get; set; }
    public string? RefreshToken { get; set; }
    public int? AttemptsRemaining { get; set; }
}

