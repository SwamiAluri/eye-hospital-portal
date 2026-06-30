using AuthService.Context;
using AuthService.Models.Domain;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public interface IPatientMergeService
{
    Task<Patient?> MergePatientsAsync(Guid tenantId, Guid primaryPatientId, Guid duplicatePatientId, Guid userId);
}

/// <summary>
/// Merges duplicate patient into primary — reassigns core FKs and soft-deletes duplicate.
/// </summary>
public class PatientMergeService : IPatientMergeService
{
    private readonly AppDbContext _context;
    private readonly ILogger<PatientMergeService> _logger;

    public PatientMergeService(AppDbContext context, ILogger<PatientMergeService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<Patient?> MergePatientsAsync(
        Guid tenantId,
        Guid primaryPatientId,
        Guid duplicatePatientId,
        Guid userId)
    {
        if (primaryPatientId == duplicatePatientId)
            throw new ArgumentException("Primary and duplicate patient must differ");

        var primary = await _context.Patients
            .FirstOrDefaultAsync(p => p.Id == primaryPatientId && p.TenantId == tenantId && p.DeletedAt == null);
        var duplicate = await _context.Patients
            .FirstOrDefaultAsync(p => p.Id == duplicatePatientId && p.TenantId == tenantId && p.DeletedAt == null);

        if (primary == null || duplicate == null)
            return null;

        await using var tx = await _context.Database.BeginTransactionAsync();

        try
        {
            await _context.Database.ExecuteSqlInterpolatedAsync($"""
                UPDATE visits SET patient_id = {primaryPatientId}, updated_at = CURRENT_TIMESTAMP
                WHERE tenant_id = {tenantId} AND patient_id = {duplicatePatientId}
                """);

            await _context.Database.ExecuteSqlInterpolatedAsync($"""
                UPDATE appointments SET patient_id = {primaryPatientId}, updated_at = CURRENT_TIMESTAMP
                WHERE tenant_id = {tenantId} AND patient_id = {duplicatePatientId}
                """);

            await _context.Database.ExecuteSqlInterpolatedAsync($"""
                UPDATE prescription SET patient_id = {primaryPatientId}, updated_at = CURRENT_TIMESTAMP
                WHERE tenant_id = {tenantId} AND patient_id = {duplicatePatientId}
                """);

            await _context.Database.ExecuteSqlInterpolatedAsync($"""
                UPDATE imaging_orders SET patient_id = {primaryPatientId}, updated_at = CURRENT_TIMESTAMP
                WHERE tenant_id = {tenantId} AND patient_id = {duplicatePatientId}
                """);

            await _context.Database.ExecuteSqlInterpolatedAsync($"""
                DELETE FROM patient_favorites
                WHERE tenant_id = {tenantId} AND patient_id = {duplicatePatientId}
                """);

            duplicate.DeletedAt = DateTime.UtcNow;
            duplicate.UpdatedAt = DateTime.UtcNow;
            duplicate.UpdatedByUserId = userId;
            duplicate.Status = "Merged";
            duplicate.SpecialNeeds = string.IsNullOrWhiteSpace(duplicate.SpecialNeeds)
                ? $"Merged into {primary.MedicalRecordNumber} ({primaryPatientId})"
                : $"{duplicate.SpecialNeeds}; Merged into {primary.MedicalRecordNumber}";

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            _logger.LogInformation(
                "Merged patient {DuplicateId} into {PrimaryId} by user {UserId}",
                duplicatePatientId, primaryPatientId, userId);

            return primary;
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            _logger.LogError(ex, "Patient merge failed {Duplicate} -> {Primary}", duplicatePatientId, primaryPatientId);
            throw;
        }
    }
}
