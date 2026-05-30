using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Azure;
using Azure.Communication.Email;
using NotificationService.Services.Token;

namespace NotificationService.Services.Email;

/// <summary>
/// Azure Communication Services implementation of IEmailService
/// Replaces Resend email service with Azure's email delivery
/// Cost: 5,000 emails/month free, then $0.00025 per email
/// </summary>
public class AzureEmailService : IEmailService
{
    private readonly EmailClient _emailClient;
    private readonly string _fromEmail;
    private readonly string _fromName;
    private readonly ILogger<AzureEmailService> _logger;
    private readonly ITokenService _tokenService;

    public AzureEmailService(
        IConfiguration configuration, 
        ILogger<AzureEmailService> logger,
        ITokenService tokenService)
    {
        _logger = logger;
        _tokenService = tokenService;

        var connectionString = configuration["AzureCommunication:ConnectionString"];
        _fromEmail = configuration["AzureCommunication:FromEmail"]
            ?? throw new InvalidOperationException("AzureCommunication:FromEmail not configured");
        _fromName = configuration["AzureCommunication:FromName"] ?? "Hospital Portal";

        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException("AzureCommunication:ConnectionString not configured");
        }

        _emailClient = new EmailClient(connectionString);
        _logger.LogInformation("AzureEmailService initialized - From: {FromEmail} ({FromName})", _fromEmail, _fromName);
    }

    public async Task<(bool Success, string? MessageId, string? Error)> SendActivationOtpAsync(
        string toEmail,
        string userName,
        string otpCode,
        int expiryHours,
        string userId)
    {
        var subject = "Your Activation Code - Hospital Portal";
        
        // Generate encrypted activation token with 48-hour expiry
        var token = _tokenService.GenerateActivationToken(toEmail, userId);
        
        // Activation URL with token - TODO: Replace with production URL
        var activationUrl = $"http://localhost:3000/activate?email={Uri.EscapeDataString(toEmail)}&token={token}";
        
        var htmlBody = $@"
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: #0066cc; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
        .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
        .otp-box {{ background: white; padding: 20px; margin: 20px 0; text-align: center; border: 2px solid #0066cc; border-radius: 8px; }}
        .otp-code {{ font-size: 32px; font-weight: bold; color: #0066cc; letter-spacing: 8px; }}
        .activate-button {{ 
            display: inline-block; 
            padding: 15px 40px; 
            background: #0066cc; 
            color: white !important; 
            text-decoration: none; 
            border-radius: 5px; 
            font-weight: bold;
            margin: 20px 0;
        }}
        .activate-button:hover {{ background: #0052a3; }}
        .warning {{ color: #d9534f; margin-top: 20px; }}
        .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class=""container"">
        <div class=""header"">
            <h1>Hospital Portal</h1>
        </div>
        <div class=""content"">
            <h2>Hello {userName},</h2>
            <p>You have requested an activation code for your Hospital Portal account.</p>
            
            <div class=""otp-box"">
                <p>Your activation code is:</p>
                <div class=""otp-code"">{otpCode}</div>
            </div>
            
            <p><strong>This code will expire in {expiryHours} hours.</strong></p>
            
            <p>If you did not request this code, please ignore this email or contact your administrator.</p>
            
            <div class=""warning"">
                ⚠️ <strong>Never share this code with anyone.</strong> Hospital Portal staff will never ask for your activation code.
            </div>
            
            <div style=""text-align: center; margin: 30px 0;"">
                <a href=""{activationUrl}"" class=""activate-button"">Activate Now</a>
                <p style=""margin-top: 15px; font-size: 14px; color: #666;"">
                    Click the button above to complete your account activation, set your password, and optionally configure MFA.
                </p>
            </div>
        </div>
        <div class=""footer"">
            <p>© 2026 Hospital Portal. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>";

        var plainTextBody = $@"Hello {userName},

You have requested an activation code for your Hospital Portal account.

Your activation code is: {otpCode}

This code will expire in {expiryHours} hours.

Click here to activate your account: {activationUrl}

You will be asked to:
1. Enter your activation code
2. Set your password
3. Optionally configure Multi-Factor Authentication (MFA)
4. Login to your dashboard

If you did not request this code, please ignore this email or contact your administrator.

⚠️ Never share this code with anyone. Hospital Portal staff will never ask for your activation code.

© 2026 Hospital Portal. All rights reserved.
This is an automated message. Please do not reply to this email.";

        return await SendEmailAsync(toEmail, subject, htmlBody, plainTextBody);
    }

    public async Task<(bool Success, string? MessageId, string? Error)> SendMfaLoginOtpAsync(
        string toEmail,
        string userName,
        string otpCode,
        int expiryMinutes)
    {
        var subject = "Your Login Verification Code - Hospital Portal";
        var htmlBody = $@"
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
        .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
        .otp-box {{ background: white; padding: 20px; margin: 20px 0; text-align: center; border: 2px solid #28a745; border-radius: 8px; }}
        .otp-code {{ font-size: 32px; font-weight: bold; color: #28a745; letter-spacing: 8px; }}
        .warning {{ color: #d9534f; margin-top: 20px; }}
        .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class=""container"">
        <div class=""header"">
            <h1>Hospital Portal</h1>
        </div>
        <div class=""content"">
            <h2>Hello {userName},</h2>
            <p>We detected a login attempt to your Hospital Portal account.</p>
            
            <div class=""otp-box"">
                <p>Your verification code is:</p>
                <div class=""otp-code"">{otpCode}</div>
            </div>
            
            <p><strong>This code will expire in {expiryMinutes} minutes.</strong></p>
            
            <p>If you did not attempt to log in, please contact your administrator immediately.</p>
            
            <div class=""warning"">
                ⚠️ Never share this code with anyone. Hospital Portal staff will never ask for your verification code.
            </div>
        </div>
        <div class=""footer"">
            <p>© 2026 Hospital Portal. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>";

        var plainTextBody = $@"Hello {userName},

We detected a login attempt to your Hospital Portal account.

Your verification code is: {otpCode}

This code will expire in {expiryMinutes} minutes.

If you did not attempt to log in, please contact your administrator immediately.

⚠️ Never share this code with anyone. Hospital Portal staff will never ask for your verification code.

© 2026 Hospital Portal. All rights reserved.
This is an automated message. Please do not reply to this email.";

        return await SendEmailAsync(toEmail, subject, htmlBody, plainTextBody);
    }

    public async Task<(bool Success, string? MessageId, string? Error)> SendMfaResetNotificationAsync(
        string toEmail,
        string userName,
        string resetByAdmin,
        DateTime resetAt)
    {
        var subject = "MFA Reset Notification - Hospital Portal";
        var htmlBody = $@"
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: #ffc107; color: #333; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
        .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
        .info-box {{ background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #ffc107; }}
        .warning {{ color: #d9534f; margin-top: 20px; }}
        .footer {{ text-align: center; margin-top: 20px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class=""container"">
        <div class=""header"">
            <h1>Hospital Portal</h1>
        </div>
        <div class=""content"">
            <h2>Hello {userName},</h2>
            <p>This is a notification that your Multi-Factor Authentication (MFA) settings have been reset.</p>
            
            <div class=""info-box"">
                <p><strong>Reset Details:</strong></p>
                <p>Reset by: {resetByAdmin}</p>
                <p>Reset at: {resetAt:yyyy-MM-dd HH:mm:ss} UTC</p>
            </div>
            
            <p>You will need to set up MFA again at your next login.</p>
            
            <div class=""warning"">
                ⚠️ If you did not request this reset, please contact your administrator immediately.
            </div>
        </div>
        <div class=""footer"">
            <p>© 2026 Hospital Portal. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>";

        var plainTextBody = $@"Hello {userName},

This is a notification that your Multi-Factor Authentication (MFA) settings have been reset.

Reset Details:
- Reset by: {resetByAdmin}
- Reset at: {resetAt:yyyy-MM-dd HH:mm:ss} UTC

You will need to set up MFA again at your next login.

⚠️ If you did not request this reset, please contact your administrator immediately.

© 2026 Hospital Portal. All rights reserved.
This is an automated message. Please do not reply to this email.";

        return await SendEmailAsync(toEmail, subject, htmlBody, plainTextBody);
    }

    private async Task<(bool Success, string? MessageId, string? Error)> SendEmailAsync(
        string toEmail,
        string subject,
        string htmlBody,
        string plainTextBody)
    {
        try
        {
            _logger.LogInformation(
                "Sending email via Azure Communication Services - To: {To}, Subject: {Subject}",
                toEmail,
                subject);

            var emailContent = new EmailContent(subject)
            {
                Html = htmlBody,
                PlainText = plainTextBody
            };

            var emailMessage = new EmailMessage(
                senderAddress: _fromEmail,
                recipientAddress: toEmail,
                content: emailContent);

            EmailSendOperation emailSendOperation = await _emailClient.SendAsync(
                WaitUntil.Started,
                emailMessage);

            _logger.LogInformation(
                "Email queued successfully - MessageId: {MessageId}, To: {To}",
                emailSendOperation.Id,
                toEmail);

            return (true, emailSendOperation.Id, null);
        }
        catch (RequestFailedException ex)
        {
            _logger.LogError(ex,
                "Azure Communication Services request failed - Status: {Status}, ErrorCode: {ErrorCode}, Message: {Message}",
                ex.Status,
                ex.ErrorCode,
                ex.Message);

            return (false, null, $"Email service error: {ex.Message}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error sending email via Azure Communication Services");
            return (false, null, $"Failed to send email: {ex.Message}");
        }
    }

    public async Task<(bool Success, string? MessageId, string? Error)> SendPurchaseReturnEventAsync(
        string toEmail,
        string vendorName,
        string returnNumber,
        string eventType,
        decimal netAmount,
        DateTime eventAt,
        string? creditNoteNumber = null,
        decimal? creditNoteAmount = null,
        string? cancellationReason = null)
    {
        var (subject, headerColor, eventLabel, extraRow) = eventType switch
        {
            "SentToVendor"       => ("#1a73e8", "#1a73e8", "Return Sent to Vendor",   string.Empty),
            "CreditNoteReceived" => ("#2e7d32", "#2e7d32", "Credit Note Received",
                creditNoteNumber != null
                    ? $"<tr><td style='padding:6px 0;color:#555;'>Credit Note #</td><td style='padding:6px 0;font-weight:600;'>{creditNoteNumber}</td></tr>" +
                      $"<tr><td style='padding:6px 0;color:#555;'>Credit Note Amount</td><td style='padding:6px 0;font-weight:600;'>₹{creditNoteAmount:N2}</td></tr>"
                    : string.Empty),
            "Settled"            => ("#1565c0", "#1565c0", "Return Settled",          string.Empty),
            "Cancelled"          => ("#b71c1c", "#b71c1c", "Return Cancelled",
                !string.IsNullOrEmpty(cancellationReason)
                    ? $"<tr><td style='padding:6px 0;color:#555;'>Reason</td><td style='padding:6px 0;font-weight:600;'>{cancellationReason}</td></tr>"
                    : string.Empty),
            _                    => ("#555555", "#555555", eventType,                 string.Empty),
        };

        var htmlBody = $@"<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8' />
  <style>
    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
    .header {{ background: {headerColor}; color: #fff; padding: 18px 24px; border-radius: 8px 8px 0 0; }}
    .content {{ background: #f9f9f9; padding: 28px; border-radius: 0 0 8px 8px; }}
    table {{ width: 100%; border-collapse: collapse; }}
    .footer {{ text-align: center; margin-top: 24px; color: #888; font-size: 12px; }}
  </style>
</head>
<body>
  <div class=""container"">
    <div class=""header""><h2 style=""margin:0;"">{eventLabel} — Hospital Portal</h2></div>
    <div class=""content"">
      <p>Dear <strong>{vendorName}</strong>,</p>
      <p>This is an automated notification regarding purchase return <strong>{returnNumber}</strong>.</p>
      <table>
        <tr><td style='padding:6px 0;color:#555;'>Return #</td><td style='padding:6px 0;font-weight:600;'>{returnNumber}</td></tr>
        <tr><td style='padding:6px 0;color:#555;'>Event</td><td style='padding:6px 0;font-weight:600;'>{eventLabel}</td></tr>
        <tr><td style='padding:6px 0;color:#555;'>Net Return Amount</td><td style='padding:6px 0;font-weight:600;'>₹{netAmount:N2}</td></tr>
        <tr><td style='padding:6px 0;color:#555;'>Date / Time</td><td style='padding:6px 0;'>{eventAt:dd MMM yyyy HH:mm} UTC</td></tr>
        {extraRow}
      </table>
      <p style='margin-top:20px;font-size:13px;color:#666;'>If you have any questions, please contact the hospital procurement team.</p>
    </div>
    <div class=""footer""><p>© 2026 Hospital Portal. All rights reserved.</p></div>
  </div>
</body>
</html>";

        var plainText = $"Purchase Return {returnNumber} — {eventLabel}\nVendor: {vendorName}\nNet Amount: ₹{netAmount:N2}\nDate: {eventAt:dd MMM yyyy HH:mm} UTC";

        return await SendEmailAsync(toEmail, $"{eventLabel}: Return {returnNumber}", htmlBody, plainText);
    }

    public Task<(bool Success, string? MessageId, string? Error)> SendGenericEmailAsync(
        string toEmail,
        string subject,
        string htmlBody,
        string? plainTextBody = null)
        => SendEmailAsync(toEmail, subject, htmlBody, plainTextBody);
}
