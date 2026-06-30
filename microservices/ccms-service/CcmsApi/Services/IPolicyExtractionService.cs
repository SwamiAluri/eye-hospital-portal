using CcmsApi.Models.Dtos;

namespace CcmsApi.Services;

public interface IPolicyExtractionService
{
    Task<PolicyExtractionPreview> ExtractAsync(
        PolicyCardImage? front,
        PolicyCardImage? back,
        string sessionId,
        Guid tenantId,
        Guid coverageCaseId,
        string? paymentType = null,
        CancellationToken ct = default);
}

public record PolicyCardImage(Stream Content, string FileName, string ContentType, string? BlobUrl);
