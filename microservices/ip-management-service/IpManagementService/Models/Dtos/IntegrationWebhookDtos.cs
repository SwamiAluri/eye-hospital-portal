namespace IpManagementService.Models.Dtos;

public record LisIntegrationWebhookRequest(
    Guid    JourneyId,
    string? TestCode,
    string? TestName,
    string? Status = "Completed");

public record ImagingIntegrationWebhookRequest(
    Guid    JourneyId,
    string? Modality,
    string? StudyType,
    string? Status = "Completed");

public record IntegrationWebhookResultDto(
    Guid     JourneyId,
    int      ItemsUpdated,
    IReadOnlyList<string> ItemKeys);
