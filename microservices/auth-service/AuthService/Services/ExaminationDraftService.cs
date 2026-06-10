using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Services;

public class ExaminationDraftService : IExaminationDraftService
{
    private readonly AppDbContext _context;
    private readonly ILogger<ExaminationDraftService> _logger;

    public ExaminationDraftService(AppDbContext context, ILogger<ExaminationDraftService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<ExaminationDraft?> GetDraftAsync(
        Guid patientId,
        Guid doctorId,
        Guid tenantId,
        Guid? visitId = null)
    {
        try
        {
            var draft = await _context.Set<ExaminationDraft>()
                .Where(d => d.PatientId == patientId &&
                           d.DoctorId == doctorId &&
                           d.TenantId == tenantId &&
                           d.VisitId == visitId &&
                           d.ExpiresAt > DateTime.UtcNow)
                .OrderByDescending(d => d.Timestamp)
                .FirstOrDefaultAsync();

            return draft;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting draft for patient {PatientId}, doctor {DoctorId}", patientId, doctorId);
            return null;
        }
    }

    public async Task<ExaminationDraft> SaveDraftAsync(ExaminationDraft draft)
    {
        try
        {
            if (draft.Id == Guid.Empty)
            {
                // Create new draft
                draft.Id = Guid.NewGuid();
                draft.CreatedAt = DateTime.UtcNow;
                draft.UpdatedAt = DateTime.UtcNow;
                
                // Set expiry to 24 hours from now
                if (draft.ExpiresAt == default)
                {
                    draft.ExpiresAt = DateTime.UtcNow.AddHours(24);
                }

                _context.Set<ExaminationDraft>().Add(draft);
            }
            else
            {
                // Update existing draft
                var existingDraft = await _context.Set<ExaminationDraft>()
                    .FirstOrDefaultAsync(d => d.Id == draft.Id && d.TenantId == draft.TenantId);

                if (existingDraft != null)
                {
                    existingDraft.Data = draft.Data;
                    existingDraft.CompletionPercentage = draft.CompletionPercentage;
                    existingDraft.Timestamp = DateTime.UtcNow;
                    existingDraft.UpdatedAt = DateTime.UtcNow;
                    existingDraft.UpdatedByUserId = draft.UpdatedByUserId;
                    
                    // Extend expiry by 24 hours
                    existingDraft.ExpiresAt = DateTime.UtcNow.AddHours(24);
                }
                else
                {
                    throw new InvalidOperationException($"Draft {draft.Id} not found");
                }
            }

            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Draft saved successfully: {DraftId}, Completion: {Percentage}%", 
                draft.Id, draft.CompletionPercentage);
            
            return draft;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving draft for patient {PatientId}", draft.PatientId);
            throw;
        }
    }

    public async Task<bool> DeleteDraftAsync(Guid draftId, Guid tenantId)
    {
        try
        {
            var draft = await _context.Set<ExaminationDraft>()
                .FirstOrDefaultAsync(d => d.Id == draftId && d.TenantId == tenantId);

            if (draft == null)
            {
                return false;
            }

            _context.Set<ExaminationDraft>().Remove(draft);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Draft deleted: {DraftId}", draftId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting draft {DraftId}", draftId);
            return false;
        }
    }

    public async Task<List<ExaminationDraft>> ListDraftsAsync(Guid doctorId, Guid tenantId)
    {
        try
        {
            return await _context.Set<ExaminationDraft>()
                .Where(d => d.DoctorId == doctorId && 
                           d.TenantId == tenantId &&
                           d.ExpiresAt > DateTime.UtcNow)
                .Include(d => d.Patient)
                .OrderByDescending(d => d.Timestamp)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing drafts for doctor {DoctorId}", doctorId);
            return new List<ExaminationDraft>();
        }
    }

    public async Task<int> CleanupExpiredDraftsAsync()
    {
        try
        {
            var expiredDrafts = await _context.Set<ExaminationDraft>()
                .Where(d => d.ExpiresAt <= DateTime.UtcNow)
                .ToListAsync();

            if (expiredDrafts.Any())
            {
                _context.Set<ExaminationDraft>().RemoveRange(expiredDrafts);
                await _context.SaveChangesAsync();
                
                _logger.LogInformation("Cleaned up {Count} expired drafts", expiredDrafts.Count);
                return expiredDrafts.Count;
            }

            return 0;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cleaning up expired drafts");
            return 0;
        }
    }
}
