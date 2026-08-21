namespace CcmsApi.Services;

/// <summary>
/// Cross-instance safe idempotency for CCMS integration consumers.
/// Empty/missing keys are never treated as duplicates.
/// </summary>
public interface IIntegrationIdempotencyGuard
{
    /// <returns>True when this key was already seen (duplicate / safe no-op).</returns>
    Task<bool> IsDuplicateAsync(string? idempotencyKey, CancellationToken ct = default);
}
