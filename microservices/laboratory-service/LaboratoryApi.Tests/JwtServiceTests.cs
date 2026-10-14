using System.Security.Claims;
using LaboratoryApi.Services;
using LaboratoryApi.Tests.Helpers;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Moq;
using Xunit;

namespace LaboratoryApi.Tests;

public class JwtServiceTests
{
    private static IConfiguration Config()
    {
        var mock = new Mock<IConfiguration>();
        mock.Setup(c => c["Jwt__Key"]).Returns(TestJwtFactory.DefaultKey);
        mock.Setup(c => c["Jwt__Issuer"]).Returns("EyeHospitalAuth");
        mock.Setup(c => c["Jwt__Audience"]).Returns("EyeHospitalAPI");
        mock.Setup(c => c["Values:Jwt__Key"]).Returns((string?)null);
        return mock.Object;
    }

    [Fact]
    public void ValidateAndExtract_Sets_TenantContext_And_Returns_Claims()
    {
        var userId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var config = Config();
        var tenantCtx = new TenantContext();
        var jwt = new JwtService(config, tenantCtx);
        var token = TestJwtFactory.CreateBearerToken(userId, tenantId, config, LaboratoryAuthz.LmsView);
        var req = CreateRequest($"Bearer {token}", tenantId.ToString());

        var ok = jwt.ValidateAndExtract(req, out var claims, out var err);

        Assert.True(ok);
        Assert.Equal(string.Empty, err);
        Assert.NotNull(claims);
        Assert.Equal(userId, claims!.UserId);
        Assert.Equal(tenantId, claims.TenantId);
        Assert.Equal(tenantId, tenantCtx.TenantId);
        Assert.Contains(LaboratoryAuthz.LmsView, claims.SafePermissions);
    }

    [Fact]
    public void ValidateAndExtract_Rejects_Missing_Authorization()
    {
        var jwt = new JwtService(Config(), new TenantContext());
        var req = CreateRequest(null, null);

        var ok = jwt.ValidateAndExtract(req, out var claims, out var err);

        Assert.False(ok);
        Assert.Null(claims);
        Assert.Contains("Authorization", err);
    }

    [Fact]
    public void ValidateAndExtract_Rejects_Tenant_Header_Mismatch()
    {
        var userId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var otherTenant = Guid.NewGuid();
        var config = Config();
        var jwt = new JwtService(config, new TenantContext());
        var token = TestJwtFactory.CreateBearerToken(userId, tenantId, config, LaboratoryAuthz.LmsView);
        var req = CreateRequest($"Bearer {token}", otherTenant.ToString());

        var ok = jwt.ValidateAndExtract(req, out _, out var err);

        Assert.False(ok);
        Assert.Contains("X-Tenant-ID", err);
    }

    private static HttpRequestData CreateRequest(string? authorization, string? tenantHeader)
    {
        var context = new Mock<FunctionContext>();
        var req = new Mock<HttpRequestData>(context.Object);
        var headers = new HttpHeadersCollection();
        if (!string.IsNullOrWhiteSpace(authorization))
            headers.Add("Authorization", authorization);
        if (!string.IsNullOrWhiteSpace(tenantHeader))
            headers.Add("X-Tenant-ID", tenantHeader);
        req.Setup(r => r.Headers).Returns(headers);
        return req.Object;
    }
}
