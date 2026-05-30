using Microsoft.Azure.WebJobs.Extensions.OpenApi.Core.Configurations;
using Microsoft.Azure.WebJobs.Extensions.OpenApi.Core.Enums;
using Microsoft.OpenApi.Models;

namespace CcmsApi;

/// <summary>
/// OpenAPI document metadata for the CCMS service.
/// Surfaced at:
///   GET /api/swagger/ui         → Swagger UI
///   GET /api/swagger.json       → OpenAPI 3.0 JSON spec
///   GET /api/swagger.yaml       → OpenAPI 3.0 YAML spec
/// </summary>
public class CcmsOpenApiConfigurationOptions : DefaultOpenApiConfigurationOptions
{
    public override OpenApiInfo Info { get; set; } = new()
    {
        Version      = "v1",
        Title        = "CCMS — Coverage & Claims Management Service",
        Description  = "REST API for the hospital portal Coverage & Claims platform. " +
                       "Covers cases, authorizations, billing, claims, settlements, enhancements, " +
                       "eligibility, communications, analytics, and admin configuration.",
        Contact = new OpenApiContact
        {
            Name  = "Hospital Portal Team",
            Email = "platform@hospital.local",
        },
        License = new OpenApiLicense
        {
            Name = "Proprietary — Internal Use Only",
        },
    };

    public override OpenApiVersionType OpenApiVersion { get; set; } = OpenApiVersionType.V3;

    // Allow UI in all environments (restrict in production if desired via appsettings)
    public override bool ForceHttp  { get; set; } = false;
    public override bool ForceHttps { get; set; } = false;
}
