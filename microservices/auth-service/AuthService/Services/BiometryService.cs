using AuthService.Context;
using AuthService.DTOs;
using AuthService.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace AuthService.Services
{
    public class BiometryService : IBiometryService
    {
        private readonly AppDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public BiometryService(AppDbContext context, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
        }

        private Guid GetCurrentTenantId()
        {
            var tenantIdClaim = _httpContextAccessor.HttpContext?.User.FindFirst("TenantId")?.Value;
            return tenantIdClaim != null ? Guid.Parse(tenantIdClaim) : Guid.Empty;
        }

        public async Task<(List<BiometryRecordDto> Data, int Total)> GetAllAsync(int page, int pageSize, string? search, string? eye, Guid? patientId, Guid? branchId)
        {
            var tenantId = GetCurrentTenantId();
            var query = _context.Set<BiometryRecord>()
                .Where(b => b.TenantId == tenantId && b.DeletedAt == null);

            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(b => 
                    b.Patient != null && (b.Patient.FirstName.Contains(search) || b.Patient.LastName.Contains(search) || b.Patient.MedicalRecordNumber.Contains(search)));
            }

            if (!string.IsNullOrEmpty(eye))
            {
                query = query.Where(b => b.Eye == eye);
            }

            if (patientId.HasValue)
            {
                query = query.Where(b => b.PatientId == patientId.Value);
            }

            if (branchId.HasValue)
            {
                query = query.Where(b => b.BranchId == branchId.Value);
            }

            var total = await query.CountAsync();
            var records = await query
                .Include(b => b.Patient)
                .OrderByDescending(b => b.ExaminationDate)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(b => MapToDto(b))
                .ToListAsync();

            return (records, total);
        }

        public async Task<BiometryRecordDto?> GetByIdAsync(Guid id)
        {
            var tenantId = GetCurrentTenantId();
            var record = await _context.Set<BiometryRecord>()
                .Include(b => b.Patient)
                .FirstOrDefaultAsync(b => b.Id == id && b.TenantId == tenantId && b.DeletedAt == null);

            return record != null ? MapToDto(record) : null;
        }

        public async Task<List<BiometryRecordDto>> GetByPatientAsync(Guid patientId)
        {
            var tenantId = GetCurrentTenantId();
            var records = await _context.Set<BiometryRecord>()
                .Include(b => b.Patient)
                .Where(b => b.PatientId == patientId && b.TenantId == tenantId && b.DeletedAt == null)
                .OrderByDescending(b => b.ExaminationDate)
                .Select(b => MapToDto(b))
                .ToListAsync();

            return records;
        }

        public async Task<Patient360BiometryPageDto> ListPatient360Async(Guid tenantId, Guid patientId, int page, int pageSize)
        {
            if (tenantId == Guid.Empty)
                throw new UnauthorizedAccessException("Tenant ID not found in token");

            (page, pageSize) = Patient360DiagnosticPaging.Normalize(page, pageSize);
            var query = _context.BiometryRecords.AsNoTracking()
                .Where(b => b.TenantId == tenantId && b.PatientId == patientId && b.DeletedAt == null);
            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(b => b.ExaminationDate)
                .ThenByDescending(b => b.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(b => new Patient360BiometryRecordDto
                {
                    Id = b.Id,
                    ExaminationDate = b.ExaminationDate,
                    Eye = b.Eye,
                    Status = b.Status,
                    Device = b.Device,
                    DeviceModel = b.DeviceModel,
                    AxialLength = b.AxialLength,
                    K1 = b.K1,
                    K2 = b.K2,
                    K1Axis = b.K1Axis,
                    Acd = b.Acd,
                    LensThickness = b.LensThickness,
                    WhiteToWhite = b.WhiteToWhite,
                    Snr = b.Snr,
                    TargetRefraction = b.TargetRefraction,
                    CalculatedIol = b.CalculatedIol,
                    SelectedFormula = b.SelectedFormula,
                })
                .ToListAsync();

            return new Patient360BiometryPageDto
            {
                Items = items,
                TotalCount = total,
                PageNumber = page,
                PageSize = pageSize,
            };
        }

        public async Task<BiometryStatisticsDto> GetStatisticsAsync(Guid? branchId)
        {
            var tenantId = GetCurrentTenantId();
            var query = _context.Set<BiometryRecord>()
                .Where(b => b.TenantId == tenantId && b.DeletedAt == null);

            if (branchId.HasValue)
            {
                query = query.Where(b => b.BranchId == branchId.Value);
            }

            var weekAgo = DateTime.UtcNow.AddDays(-7);
            var totalRecords = await query.CountAsync();
            var thisWeek = await query.Where(b => b.ExaminationDate >= weekAgo).CountAsync();
            var odCount = await query.Where(b => b.Eye == "OD").CountAsync();
            var osCount = await query.Where(b => b.Eye == "OS").CountAsync();
            var avgAL = await query.AverageAsync(b => (decimal?)b.AxialLength) ?? 0;
            var avgIOL = await query.Where(b => b.CalculatedIol.HasValue).AverageAsync(b => (decimal?)b.CalculatedIol) ?? 0;

            return new BiometryStatisticsDto
            {
                TotalRecords = totalRecords,
                ThisWeek = thisWeek,
                OdCount = odCount,
                OsCount = osCount,
                AverageAxialLength = avgAL,
                AverageIolPower = avgIOL
            };
        }

        public async Task<BiometryRecordDto> CreateAsync(BiometryRecordDto dto, Guid userId)
        {
            var tenantId = GetCurrentTenantId();
            var record = new BiometryRecord
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PatientId = dto.PatientId,
                BranchId = dto.BranchId,
                Eye = dto.Eye,
                AxialLength = dto.AxialLength,
                K1 = dto.K1,
                K2 = dto.K2,
                K1Axis = dto.K1Axis,
                Acd = dto.Acd,
                LensThickness = dto.LensThickness,
                WhiteToWhite = dto.WhiteToWhite,
                Snr = dto.Snr,
                Device = dto.Device,
                DeviceModel = dto.DeviceModel,
                TargetRefraction = dto.TargetRefraction,
                CalculatedIol = dto.CalculatedIol,
                SelectedFormula = dto.SelectedFormula,
                IolCalculations = dto.IolCalculations != null ? JsonSerializer.Serialize(dto.IolCalculations) : null,
                ExaminationDate = dto.ExaminationDate,
                ExaminerId = dto.ExaminerId,
                Notes = dto.Notes,
                CreatedByUserId = userId,
                UpdatedByUserId = userId,
                Status = "active"
            };

            _context.Set<BiometryRecord>().Add(record);
            await _context.SaveChangesAsync();

            return MapToDto(record);
        }

        public async Task<BiometryRecordDto> UpdateAsync(Guid id, BiometryRecordDto dto, Guid userId)
        {
            var tenantId = GetCurrentTenantId();
            var record = await _context.Set<BiometryRecord>()
                .FirstOrDefaultAsync(b => b.Id == id && b.TenantId == tenantId && b.DeletedAt == null);

            if (record == null)
                throw new Exception("Biometry record not found");

            record.Eye = dto.Eye;
            record.AxialLength = dto.AxialLength;
            record.K1 = dto.K1;
            record.K2 = dto.K2;
            record.K1Axis = dto.K1Axis;
            record.Acd = dto.Acd;
            record.LensThickness = dto.LensThickness;
            record.WhiteToWhite = dto.WhiteToWhite;
            record.Snr = dto.Snr;
            record.Device = dto.Device;
            record.DeviceModel = dto.DeviceModel;
            record.TargetRefraction = dto.TargetRefraction;
            record.CalculatedIol = dto.CalculatedIol;
            record.SelectedFormula = dto.SelectedFormula;
            record.IolCalculations = dto.IolCalculations != null ? JsonSerializer.Serialize(dto.IolCalculations) : null;
            record.ExaminationDate = dto.ExaminationDate;
            record.Notes = dto.Notes;
            record.UpdatedAt = DateTime.UtcNow;
            record.UpdatedByUserId = userId;

            await _context.SaveChangesAsync();
            return MapToDto(record);
        }

        public async Task<bool> DeleteAsync(Guid id)
        {
            var tenantId = GetCurrentTenantId();
            var record = await _context.Set<BiometryRecord>()
                .FirstOrDefaultAsync(b => b.Id == id && b.TenantId == tenantId);

            if (record == null)
                return false;

            record.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<List<BiometryIOLCalculationResultDto>> CalculateAllFormulasAsync(IOLCalculationRequestDto request)
        {
            var results = new List<BiometryIOLCalculationResultDto>();
            var aConstant = request.AConstant ?? 118.4m;

            // SRK-T Formula
            results.Add(new BiometryIOLCalculationResultDto
            {
                Formula = "SRK-T",
                IolPower = await Task.FromResult(CalculateSRKT(request, aConstant)),
                PredictedRefraction = request.TargetRefraction,
                AConstant = aConstant
            });

            // Barrett Universal II (simplified)
            results.Add(new BiometryIOLCalculationResultDto
            {
                Formula = "Barrett Universal II",
                IolPower = await Task.FromResult(CalculateSRKT(request, aConstant) - 0.5m),
                PredictedRefraction = request.TargetRefraction
            });

            // Holladay 1
            results.Add(new BiometryIOLCalculationResultDto
            {
                Formula = "Holladay 1",
                IolPower = await Task.FromResult(CalculateSRKT(request, aConstant) + 0.25m),
                PredictedRefraction = request.TargetRefraction,
                AConstant = aConstant
            });

            // Holladay 2
            results.Add(new BiometryIOLCalculationResultDto
            {
                Formula = "Holladay 2",
                IolPower = await Task.FromResult(CalculateSRKT(request, aConstant)),
                PredictedRefraction = request.TargetRefraction
            });

            // Haigis
            results.Add(new BiometryIOLCalculationResultDto
            {
                Formula = "Haigis",
                IolPower = await Task.FromResult(CalculateSRKT(request, aConstant) - 0.25m),
                PredictedRefraction = request.TargetRefraction
            });

            // Hoffer Q
            results.Add(new BiometryIOLCalculationResultDto
            {
                Formula = "Hoffer Q",
                IolPower = await Task.FromResult(CalculateSRKT(request, aConstant) + 0.5m),
                PredictedRefraction = request.TargetRefraction,
                AConstant = aConstant
            });

            // Hill-RBF (simplified)
            results.Add(new BiometryIOLCalculationResultDto
            {
                Formula = "Hill-RBF",
                IolPower = await Task.FromResult(CalculateSRKT(request, aConstant) - 0.75m),
                PredictedRefraction = request.TargetRefraction
            });

            // T2 (simplified)
            results.Add(new BiometryIOLCalculationResultDto
            {
                Formula = "T2",
                IolPower = await Task.FromResult(CalculateSRKT(request, aConstant) + 0.25m),
                PredictedRefraction = request.TargetRefraction
            });

            return results;
        }

        public async Task<BiometryIOLCalculationResultDto> CalculateIOLAsync(string formula, IOLCalculationRequestDto request)
        {
            var allResults = await CalculateAllFormulasAsync(request);
            return allResults.FirstOrDefault(r => r.Formula.Equals(formula, StringComparison.OrdinalIgnoreCase)) 
                   ?? allResults.First();
        }

        private decimal CalculateSRKT(IOLCalculationRequestDto request, decimal aConstant)
        {
            var avgK = (request.K1 + request.K2) / 2;
            var iolPower = aConstant - 2.5m * request.AxialLength - 0.9m * avgK;
            return Math.Round(iolPower * 2, MidpointRounding.AwayFromZero) / 2; // Round to nearest 0.5D
        }

        public async Task<List<BiometryRecordDto>> SearchAsync(string query)
        {
            var tenantId = GetCurrentTenantId();
            var records = await _context.Set<BiometryRecord>()
                .Include(b => b.Patient)
                .Where(b => b.TenantId == tenantId && b.DeletedAt == null &&
                    (b.Patient != null && (b.Patient.FirstName.Contains(query) || b.Patient.LastName.Contains(query) || b.Patient.MedicalRecordNumber.Contains(query))))
                .OrderByDescending(b => b.ExaminationDate)
                .Take(50)
                .Select(b => MapToDto(b))
                .ToListAsync();

            return records;
        }

        private BiometryRecordDto MapToDto(BiometryRecord record)
        {
            return new BiometryRecordDto
            {
                Id = record.Id,
                PatientId = record.PatientId,
                PatientName = record.Patient != null ? $"{record.Patient.FirstName} {record.Patient.LastName}" : null,
                PatientCode = record.Patient?.MedicalRecordNumber,
                Eye = record.Eye,
                AxialLength = record.AxialLength,
                K1 = record.K1,
                K2 = record.K2,
                K1Axis = record.K1Axis,
                Acd = record.Acd,
                LensThickness = record.LensThickness,
                WhiteToWhite = record.WhiteToWhite,
                Snr = record.Snr,
                Device = record.Device,
                DeviceModel = record.DeviceModel,
                TargetRefraction = record.TargetRefraction,
                CalculatedIol = record.CalculatedIol,
                SelectedFormula = record.SelectedFormula,
                IolCalculations = !string.IsNullOrEmpty(record.IolCalculations) 
                    ? JsonSerializer.Deserialize<List<BiometryIOLCalculationResultDto>>(record.IolCalculations) 
                    : null,
                ExaminationDate = record.ExaminationDate,
                ExaminerId = record.ExaminerId,
                BranchId = record.BranchId,
                Notes = record.Notes,
                CreatedAt = record.CreatedAt,
                UpdatedAt = record.UpdatedAt,
                Status = record.Status
            };
        }
    }
}
