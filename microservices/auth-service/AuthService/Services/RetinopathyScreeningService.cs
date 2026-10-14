using AuthService.Context;
using AuthService.DTOs;
using AuthService.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace AuthService.Services
{
    public class RetinopathyScreeningService : IRetinopathyScreeningService
    {
        private readonly AppDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public RetinopathyScreeningService(AppDbContext context, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
        }

        private Guid GetCurrentTenantId()
        {
            var tenantIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst("TenantId")?.Value;
            return tenantIdClaim != null ? Guid.Parse(tenantIdClaim) : Guid.Empty;
        }

        public async Task<(List<RetinopathyScreeningDto> Data, int Total)> GetAllAsync(int page, int pageSize, string? search, string? drGrade, Guid? patientId, Guid? branchId)
        {
            var tenantId = GetCurrentTenantId();
            var query = _context.Set<RetinopathyScreening>()
                .Include(r => r.Patient)
                .Where(r => r.TenantId == tenantId && r.DeletedAt == null);

            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(r => 
                    r.Patient != null && (r.Patient.FirstName.Contains(search) || r.Patient.LastName.Contains(search) || r.Patient.MedicalRecordNumber.Contains(search)));
            }

            if (!string.IsNullOrEmpty(drGrade))
            {
                query = query.Where(r => r.DrGrade == drGrade);
            }

            if (patientId.HasValue)
            {
                query = query.Where(r => r.PatientId == patientId.Value);
            }

            if (branchId.HasValue)
            {
                query = query.Where(r => r.BranchId == branchId.Value);
            }

            var total = await query.CountAsync();
            var screenings = await query
                .OrderByDescending(r => r.ScreeningDate)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(r => MapToDto(r))
                .ToListAsync();

            return (screenings, total);
        }

        public async Task<RetinopathyScreeningDto?> GetByIdAsync(Guid id)
        {
            var tenantId = GetCurrentTenantId();
            var screening = await _context.Set<RetinopathyScreening>()
                .Include(r => r.Patient)
                .FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId && r.DeletedAt == null);

            return screening != null ? MapToDto(screening) : null;
        }

        public async Task<List<RetinopathyScreeningDto>> GetByPatientAsync(Guid patientId)
        {
            var tenantId = GetCurrentTenantId();
            var screenings = await _context.Set<RetinopathyScreening>()
                .Include(r => r.Patient)
                .Where(r => r.PatientId == patientId && r.TenantId == tenantId && r.DeletedAt == null)
                .OrderByDescending(r => r.ScreeningDate)
                .Select(r => MapToDto(r))
                .ToListAsync();

            return screenings;
        }

        public async Task<Patient360RetinopathyPageDto> ListPatient360Async(Guid tenantId, Guid patientId, int page, int pageSize)
        {
            if (tenantId == Guid.Empty)
                throw new UnauthorizedAccessException("Tenant ID not found in token");

            (page, pageSize) = Patient360DiagnosticPaging.Normalize(page, pageSize);
            var query = _context.RetinopathyScreenings.AsNoTracking()
                .Where(r => r.TenantId == tenantId && r.PatientId == patientId && r.DeletedAt == null);
            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(r => r.ScreeningDate)
                .ThenByDescending(r => r.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(r => new Patient360RetinopathyScreeningDto
                {
                    Id = r.Id,
                    ScreeningDate = r.ScreeningDate,
                    Eye = r.Eye,
                    Status = r.Status,
                    Device = r.Device,
                    DeviceModel = r.DeviceModel,
                    DrGrade = r.DrGrade,
                    MacularEdema = r.MacularEdema,
                    HemorrhagesCount = r.HemorrhagesCount,
                    MicroaneurysmsCount = r.MicroaneurysmsCount,
                    HardExudates = r.HardExudates,
                    SoftExudates = r.SoftExudates,
                    Neovascularization = r.Neovascularization,
                    VenousBeading = r.VenousBeading,
                    Irma = r.Irma,
                    ReferralRequired = r.ReferralRequired,
                })
                .ToListAsync();

            return new Patient360RetinopathyPageDto
            {
                Items = items,
                TotalCount = total,
                PageNumber = page,
                PageSize = pageSize,
            };
        }

        public async Task<RetinopathyStatisticsDto> GetStatisticsAsync(Guid? branchId)
        {
            var tenantId = GetCurrentTenantId();
            var query = _context.Set<RetinopathyScreening>()
                .Where(r => r.TenantId == tenantId && r.DeletedAt == null);

            if (branchId.HasValue)
            {
                query = query.Where(r => r.BranchId == branchId.Value);
            }

            var total = await query.CountAsync();
            var weekAgo = DateTime.UtcNow.AddDays(-7);
            var thisWeek = await query.Where(r => r.ScreeningDate >= weekAgo).CountAsync();
            
            var noneCount = await query.Where(r => r.DrGrade == "None").CountAsync();
            var mildCount = await query.Where(r => r.DrGrade == "Mild NPDR").CountAsync();
            var moderateCount = await query.Where(r => r.DrGrade == "Moderate NPDR").CountAsync();
            var severeCount = await query.Where(r => r.DrGrade == "Severe NPDR").CountAsync();
            var pdrCount = await query.Where(r => r.DrGrade == "PDR").CountAsync();
            
            var referralCount = await query.Where(r => r.ReferralRequired).CountAsync();
            var referralRate = total > 0 ? (decimal)referralCount / total * 100 : 0;

            // AI accuracy (grader agreement)
            var withAi = await query.Where(r => r.AiGrade != null && r.GraderAgreement.HasValue).CountAsync();
            var aiAgreement = withAi > 0 
                ? await query.Where(r => r.AiGrade != null && r.GraderAgreement == true).CountAsync() 
                : 0;
            var aiAccuracy = withAi > 0 ? (decimal)aiAgreement / withAi * 100 : 0;

            return new RetinopathyStatisticsDto
            {
                TotalScreenings = total,
                ThisWeek = thisWeek,
                NoneCount = noneCount,
                MildNpdrCount = mildCount,
                ModerateNpdrCount = moderateCount,
                SevereNpdrCount = severeCount,
                PdrCount = pdrCount,
                ReferralRequiredCount = referralCount,
                ReferralRate = referralRate,
                AiAccuracy = aiAccuracy
            };
        }

        public async Task<RetinopathyScreeningDto> CreateAsync(RetinopathyScreeningDto dto, Guid userId)
        {
            var tenantId = GetCurrentTenantId();
            var screening = new RetinopathyScreening
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PatientId = dto.PatientId,
                BranchId = dto.BranchId,
                Eye = dto.Eye,
                ScreeningDate = dto.ScreeningDate,
                ScreenerId = dto.ScreenerId,
                Device = dto.Device,
                DeviceModel = dto.DeviceModel,
                DrGrade = dto.DrGrade,
                MacularEdema = dto.MacularEdema,
                HemorrhagesCount = dto.HemorrhagesCount,
                MicroaneurysmsCount = dto.MicroaneurysmsCount,
                HardExudates = dto.HardExudates,
                SoftExudates = dto.SoftExudates,
                Neovascularization = dto.Neovascularization,
                VenousBeading = dto.VenousBeading,
                Irma = dto.Irma,
                ImagePaths = dto.ImagePaths != null ? JsonSerializer.Serialize(dto.ImagePaths) : null,
                ThumbnailPath = dto.ThumbnailPath,
                ReferralRequired = dto.ReferralRequired,
                FollowUpMonths = dto.FollowUpMonths,
                TreatmentRecommended = dto.TreatmentRecommended,
                Notes = dto.Notes,
                AiGrade = dto.AiGrade,
                AiConfidence = dto.AiConfidence,
                GraderAgreement = dto.GraderAgreement,
                CreatedByUserId = userId,
                UpdatedByUserId = userId,
                Status = "active"
            };

            _context.Set<RetinopathyScreening>().Add(screening);
            await _context.SaveChangesAsync();

            return MapToDto(screening);
        }

        public async Task<RetinopathyScreeningDto> UpdateAsync(Guid id, RetinopathyScreeningDto dto, Guid userId)
        {
            var tenantId = GetCurrentTenantId();
            var screening = await _context.Set<RetinopathyScreening>()
                .FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId && r.DeletedAt == null);

            if (screening == null)
                throw new Exception("Retinopathy screening not found");

            screening.Eye = dto.Eye;
            screening.ScreeningDate = dto.ScreeningDate;
            screening.ScreenerId = dto.ScreenerId;
            screening.Device = dto.Device;
            screening.DeviceModel = dto.DeviceModel;
            screening.DrGrade = dto.DrGrade;
            screening.MacularEdema = dto.MacularEdema;
            screening.HemorrhagesCount = dto.HemorrhagesCount;
            screening.MicroaneurysmsCount = dto.MicroaneurysmsCount;
            screening.HardExudates = dto.HardExudates;
            screening.SoftExudates = dto.SoftExudates;
            screening.Neovascularization = dto.Neovascularization;
            screening.VenousBeading = dto.VenousBeading;
            screening.Irma = dto.Irma;
            screening.ImagePaths = dto.ImagePaths != null ? JsonSerializer.Serialize(dto.ImagePaths) : null;
            screening.ThumbnailPath = dto.ThumbnailPath;
            screening.ReferralRequired = dto.ReferralRequired;
            screening.FollowUpMonths = dto.FollowUpMonths;
            screening.TreatmentRecommended = dto.TreatmentRecommended;
            screening.Notes = dto.Notes;
            screening.AiGrade = dto.AiGrade;
            screening.AiConfidence = dto.AiConfidence;
            screening.GraderAgreement = dto.GraderAgreement;
            screening.UpdatedAt = DateTime.UtcNow;
            screening.UpdatedByUserId = userId;

            await _context.SaveChangesAsync();
            return MapToDto(screening);
        }

        public async Task<bool> DeleteAsync(Guid id)
        {
            var tenantId = GetCurrentTenantId();
            var screening = await _context.Set<RetinopathyScreening>()
                .FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId);

            if (screening == null)
                return false;

            screening.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<List<RetinopathyScreeningDto>> SearchAsync(string query)
        {
            var tenantId = GetCurrentTenantId();
            var screenings = await _context.Set<RetinopathyScreening>()
                .Include(r => r.Patient)
                .Where(r => r.TenantId == tenantId && r.DeletedAt == null &&
                    (r.Patient != null && (r.Patient.FirstName.Contains(query) || r.Patient.LastName.Contains(query) || r.Patient.MedicalRecordNumber.Contains(query))))
                .OrderByDescending(r => r.ScreeningDate)
                .Take(50)
                .Select(r => MapToDto(r))
                .ToListAsync();

            return screenings;
        }

        private RetinopathyScreeningDto MapToDto(RetinopathyScreening screening)
        {
            List<string>? imagePaths = null;
            if (!string.IsNullOrEmpty(screening.ImagePaths))
            {
                try
                {
                    imagePaths = JsonSerializer.Deserialize<List<string>>(screening.ImagePaths);
                }
                catch { }
            }

            return new RetinopathyScreeningDto
            {
                Id = screening.Id,
                PatientId = screening.PatientId,
                PatientName = screening.Patient != null ? $"{screening.Patient.FirstName} {screening.Patient.LastName}" : null,
                PatientCode = screening.Patient?.MedicalRecordNumber,
                BranchId = screening.BranchId,
                Eye = screening.Eye,
                ScreeningDate = screening.ScreeningDate,
                ScreenerId = screening.ScreenerId,
                Device = screening.Device,
                DeviceModel = screening.DeviceModel,
                DrGrade = screening.DrGrade,
                MacularEdema = screening.MacularEdema,
                HemorrhagesCount = screening.HemorrhagesCount,
                MicroaneurysmsCount = screening.MicroaneurysmsCount,
                HardExudates = screening.HardExudates,
                SoftExudates = screening.SoftExudates,
                Neovascularization = screening.Neovascularization,
                VenousBeading = screening.VenousBeading,
                Irma = screening.Irma,
                ImagePaths = imagePaths,
                ThumbnailPath = screening.ThumbnailPath,
                ReferralRequired = screening.ReferralRequired,
                FollowUpMonths = screening.FollowUpMonths,
                TreatmentRecommended = screening.TreatmentRecommended,
                Notes = screening.Notes,
                AiGrade = screening.AiGrade,
                AiConfidence = screening.AiConfidence,
                GraderAgreement = screening.GraderAgreement,
                CreatedAt = screening.CreatedAt,
                UpdatedAt = screening.UpdatedAt,
                Status = screening.Status
            };
        }
    }
}
