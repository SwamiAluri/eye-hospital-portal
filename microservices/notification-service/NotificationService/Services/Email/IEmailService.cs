namespace NotificationService.Services.Email;

public interface IEmailService
{
    Task<(bool Success, string? MessageId, string? Error)> SendActivationOtpAsync(
        string toEmail,
        string userName,
        string otpCode,
            int expiryHours,
            string userId);

    Task<(bool Success, string? MessageId, string? Error)> SendMfaLoginOtpAsync(
        string toEmail,
        string userName,
        string otpCode,
        int expiryMinutes);

    Task<(bool Success, string? MessageId, string? Error)> SendMfaResetNotificationAsync(
        string toEmail,
        string userName,
        string resetByAdmin,
        DateTime resetAt);

    Task<(bool Success, string? MessageId, string? Error)> SendPurchaseReturnEventAsync(
        string toEmail,
        string vendorName,
        string returnNumber,
        string eventType,
        decimal netAmount,
        DateTime eventAt,
        string? creditNoteNumber = null,
        decimal? creditNoteAmount = null,
        string? cancellationReason = null);

    Task<(bool Success, string? MessageId, string? Error)> SendGenericEmailAsync(
        string toEmail,
        string subject,
        string htmlBody,
        string? plainTextBody = null);
}
