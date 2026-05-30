using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Azure.Functions.Worker;
using NotificationService.Data;
using NotificationService.Services.Email;
using NotificationService.Services.Sms;
using NotificationService.Services.Otp;
using NotificationService.Services.Mfa;
using NotificationService.Services.Token;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults(workerOptions =>
    {
        // Enable user code exceptions for better debugging
        workerOptions.EnableUserCodeException = true;
    })
    .ConfigureServices((context, services) =>
    {
        var configuration = context.Configuration;

        // Database
        services.AddDbContext<NotificationDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        // Email Service - Azure Communication Services
        services.AddScoped<IEmailService, AzureEmailService>();

        // SMS Service
        services.AddScoped<ISmsService, TwilioSmsService>();

        // OTP Service
        services.AddScoped<IOtpService, OtpService>();
        
        // Token Service for activation link encryption
        services.AddScoped<ITokenService, TokenService>();
        
        // MFA Services
        services.AddScoped<ITotpService, TotpService>();
        services.AddScoped<IBackupCodeService, BackupCodeService>();
        services.AddScoped<IQrCodeService, QrCodeService>();

        services.AddHttpClient();
    })
    .Build();

host.Run();
