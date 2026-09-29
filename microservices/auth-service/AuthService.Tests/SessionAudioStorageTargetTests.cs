using Azure.Storage.Blobs;
using AuthService.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AuthService.Tests;

public class SessionAudioStorageTargetTests
{
    [Fact]
    public void AzureMode_SelectsThePrivateAccount_WithoutAQueryOrKey()
    {
        var configuration = Config(trusted: true, account: "hospitalblobdev01");

        Assert.True(SessionAudioStorageTarget.UsesPrivateAzureAccount(configuration, out var uri));
        Assert.Equal("https://hospitalblobdev01.blob.core.windows.net/", uri.ToString());
        Assert.Equal(string.Empty, uri.Query);

        var development = new BlobServiceClient("UseDevelopmentStorage=true");
        var privateAzure = new BlobServiceClient("UseDevelopmentStorage=true");
        var clients = new SessionAudioBlobClients(development, privateAzure);

        Assert.Same(privateAzure, clients.ForExact(SessionAudioObjectKey.ContainerName));
        Assert.Same(development, clients.ForExact("patient-photos"));
        Assert.True(clients.UsesPrivateAzure(SessionAudioObjectKey.ContainerName));
    }

    [Fact]
    public void LocalMode_KeepsDevelopmentStorage_WhenTrustedBlobAccessIsOff()
    {
        var configuration = Config(trusted: false, account: "hospitalblobdev01");
        Assert.False(SessionAudioStorageTarget.UsesPrivateAzureAccount(configuration, out _));

        var development = new BlobServiceClient("UseDevelopmentStorage=true");
        var clients = new SessionAudioBlobClients(development, null);

        Assert.Same(development, clients.ForExact(SessionAudioObjectKey.ContainerName));
        Assert.False(clients.UsesPrivateAzure(SessionAudioObjectKey.ContainerName));
    }

    [Fact]
    public void AccountName_RejectsUrlsQueriesAndKeys()
    {
        Assert.False(SessionAudioStorageTarget.TryAccountUri("hospitalblobdev01.blob.core.windows.net", out _));
        Assert.False(SessionAudioStorageTarget.TryAccountUri("account?sig=secret", out _));
        Assert.False(SessionAudioStorageTarget.TryAccountUri("", out _));
    }

    [Fact]
    public async Task Copy_DoesNotRunWhenPrivateStorageIsNotConfigured()
    {
        var development = new BlobServiceClient("UseDevelopmentStorage=true");
        var service = new BlobStorageService(
            development,
            NullLogger<BlobStorageService>.Instance,
            Config(trusted: false, account: ""),
            new SessionAudioBlobClients(development, null));

        var result = await service.CopyDevelopmentSessionAudioToPrivateStoreAsync(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/10000000-0000-0000-0000-000000000001/20000000-0000-0000-0000-000000000002/30000000-0000-0000-0000-000000000003.webm");

        Assert.Equal("not-configured", result);
    }

    [Fact]
    public void StorageSource_DoesNotIntroduceSasPublicAccessOrAccountKeys()
    {
        var source = File.ReadAllText(Path.Combine(
            FindRepoRoot(),
            "microservices",
            "auth-service",
            "AuthService",
            "Services",
            "SessionAudioBlobClients.cs"));
        source += File.ReadAllText(Path.Combine(
            FindRepoRoot(),
            "microservices",
            "auth-service",
            "AuthService",
            "Services",
            "BlobStorageService.cs"));

        Assert.Contains("DefaultAzureCredential", source);
        Assert.DoesNotContain("GenerateSas", source);
        Assert.DoesNotContain("AccountKey", source);
        Assert.DoesNotContain("StorageSharedKeyCredential", source);
        Assert.DoesNotContain("PublicAccessType.Blob", source);
        Assert.DoesNotContain("PublicAccessType.Container", source);
    }

    private static IConfiguration Config(bool trusted, string account) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AzureSpeech:TrustedBlobAccess"] = trusted ? "true" : "false",
            ["AzureSpeech:StorageAccountName"] = account,
        }).Build();

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (Directory.Exists(Path.Combine(dir.FullName, "microservices")))
                return dir.FullName;
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException("Repository root was not found.");
    }
}
