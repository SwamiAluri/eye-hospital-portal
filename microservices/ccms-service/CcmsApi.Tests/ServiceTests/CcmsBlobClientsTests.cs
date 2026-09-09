using Azure.Storage.Blobs;
using CcmsApi.Services;
using FluentAssertions;
using Xunit;

namespace CcmsApi.Tests.ServiceTests;

public sealed class CcmsBlobClientsTests
{
    [Fact]
    public void CreateServiceClient_uses_azurite_compatible_api_version()
    {
        var client = CcmsBlobClients.CreateServiceClient("UseDevelopmentStorage=true");
        client.GetType().Should().Be(typeof(BlobServiceClient));
    }
}
