using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Twilio;
using Twilio.Rest.Api.V2010.Account;
using Twilio.Types;

namespace NotificationService.Services.Sms;

public class TwilioSmsService : ISmsService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<TwilioSmsService> _logger;
    private readonly string _fromNumber;

    public TwilioSmsService(IConfiguration configuration, ILogger<TwilioSmsService> logger)
    {
        _configuration = configuration;
        _logger = logger;

        var accountSid = _configuration["Twilio:AccountSid"] ?? throw new InvalidOperationException("Twilio Account SID not configured");
        var authToken = _configuration["Twilio:AuthToken"] ?? throw new InvalidOperationException("Twilio Auth Token not configured");
        _fromNumber = _configuration["Twilio:FromNumber"] ?? throw new InvalidOperationException("Twilio From Number not configured");

        TwilioClient.Init(accountSid, authToken);
    }

    public async Task<(bool Success, string? MessageId, string? Error)> SendActivationOtpAsync(
        string toPhoneNumber,
        string otpCode,
        int expiryHours)
    {
        try
        {
            var messageBody = $"Hospital Portal: Your activation code is {otpCode}. Valid for {expiryHours} hours. Login at http://localhost:3000/login";

            var message = await MessageResource.CreateAsync(
                to: new PhoneNumber(toPhoneNumber),
                from: new PhoneNumber(_fromNumber),
                body: messageBody
            );

            _logger.LogInformation("Activation SMS sent to {Phone}, MessageSid: {MessageSid}, Status: {Status}",
                toPhoneNumber, message.Sid, message.Status);

            return (true, message.Sid, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send activation SMS to {Phone}", toPhoneNumber);
            return (false, null, ex.Message);
        }
    }

    public async Task<(bool Success, string? MessageId, string? Error)> SendMfaLoginOtpAsync(
        string toPhoneNumber,
        string otpCode,
        int expiryMinutes)
    {
        try
        {
            var messageBody = $"Hospital Portal: Your login code is {otpCode}. Valid for {expiryMinutes} minutes. If you didn't request this, contact your admin.";

            var message = await MessageResource.CreateAsync(
                to: new PhoneNumber(toPhoneNumber),
                from: new PhoneNumber(_fromNumber),
                body: messageBody
            );

            _logger.LogInformation("MFA login SMS sent to {Phone}, MessageSid: {MessageSid}, Status: {Status}",
                toPhoneNumber, message.Sid, message.Status);

            return (true, message.Sid, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send MFA login SMS to {Phone}", toPhoneNumber);
            return (false, null, ex.Message);
        }
    }

    public async Task<(bool Success, string? MessageId, string? Error)> SendTextAsync(
        string toPhoneNumber,
        string body)
    {
        try
        {
            var message = await MessageResource.CreateAsync(
                to: new PhoneNumber(toPhoneNumber),
                from: new PhoneNumber(_fromNumber),
                body: body);

            _logger.LogInformation("SMS sent to {Phone}, MessageSid: {MessageSid}", toPhoneNumber, message.Sid);
            return (true, message.Sid, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send SMS to {Phone}", toPhoneNumber);
            return (false, null, ex.Message);
        }
    }
}
