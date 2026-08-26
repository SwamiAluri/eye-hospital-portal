using AuthService.Context;
using AuthService.Models.Domain;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace AuthService.Services
{
    public interface IAuditService
    {
        // Basic audit logging
        Task LogAsync(string action, string resourceType, Guid? resourceId, string? details = null, string? oldValue = null, string? newValue = null);
        Task LogAsync(Guid userId, string action, string resourceType, Guid? resourceId, string? details = null, string? oldValue = null, string? newValue = null);

        /// <summary>
        /// Queues an audit row on the shared DbContext without saving, so the caller's
        /// SaveChangesAsync writes the audit and the audited change atomically.
        /// </summary>
        Task StageAsync(Guid userId, string action, string resourceType, Guid? resourceId, string? details = null, string? oldValue = null, string? newValue = null);
        
        // Enhanced security logging
        Task LogSecurityEventAsync(Guid userId, string eventType, string riskLevel, Dictionary<string, object> metadata);
        Task LogDataAccessAsync(Guid userId, string resourceType, Guid resourceId, string action, string dataClassification);
        Task LogPermissionChangeAsync(Guid userId, Guid targetUserId, List<string> permissionChanges);
        Task LogConfigurationChangeAsync(Guid userId, string configKey, string oldValue, string newValue);
        
        // Hash chain integrity
        string CalculateEventHash(AuditLog auditLog);
        Task<AuditLog?> GetPreviousAuditLogAsync(Guid tenantId);
        Task<bool> VerifyAuditIntegrityAsync(Guid tenantId, DateTime startDate, DateTime endDate);
        Task<List<AuditLog>> DetectTamperingAsync(Guid tenantId);
        
        // Compliance and reporting
        Task<List<AuditLog>> GetAuditLogsAsync(Guid? userId = null, string? action = null, string? resourceType = null, DateTime? fromDate = null, DateTime? toDate = null);
        Task<int> ArchiveOldAuditsAsync(DateTime beforeDate);
        Task<Dictionary<string, int>> GenerateComplianceReportAsync(Guid tenantId, DateTime startDate, DateTime endDate, string complianceType);
    }

    public class AuditService : IAuditService
    {
        private readonly AppDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public AuditService(AppDbContext context, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
        }

        private Guid GetCurrentTenantId()
        {
            var tenantId = _httpContextAccessor?.HttpContext?.Items["TenantId"] as Guid?;
            return tenantId ?? Guid.Parse("11111111-1111-1111-1111-111111111111");
        }

        private Guid? GetCurrentUserId()
        {
            var userIdClaim = _httpContextAccessor?.HttpContext?.User?.FindFirst("sub")?.Value;
            return userIdClaim != null ? Guid.Parse(userIdClaim) : null;
        }

        private string? GetCurrentIpAddress()
        {
            var httpContext = _httpContextAccessor?.HttpContext;
            if (httpContext == null) return "127.0.0.1";

            string? ipAddress = null;

            // 1. Try X-Forwarded-For header (for proxied requests)
            if (httpContext.Request.Headers.ContainsKey("X-Forwarded-For"))
            {
                ipAddress = httpContext.Request.Headers["X-Forwarded-For"].ToString().Split(',').FirstOrDefault()?.Trim();
            }

            // 2. Fallback to X-Real-IP header
            if (string.IsNullOrEmpty(ipAddress) && httpContext.Request.Headers.ContainsKey("X-Real-IP"))
            {
                ipAddress = httpContext.Request.Headers["X-Real-IP"].ToString();
            }

            // 3. Fallback to RemoteIpAddress
            if (string.IsNullOrEmpty(ipAddress))
            {
                ipAddress = httpContext.Connection.RemoteIpAddress?.ToString();
            }

            // 4. Default to localhost if still null
            if (string.IsNullOrEmpty(ipAddress))
            {
                ipAddress = "127.0.0.1";
            }

            return ipAddress;
        }

        private string? GetCurrentUserAgent()
        {
            return _httpContextAccessor?.HttpContext?.Request?.Headers["User-Agent"].ToString();
        }

        private string? GetCurrentSessionId()
        {
            return _httpContextAccessor?.HttpContext?.Items["SessionId"] as string;
        }

        public async Task LogAsync(string action, string resourceType, Guid? resourceId, string? details = null, string? oldValue = null, string? newValue = null)
        {
            var userId = GetCurrentUserId() ?? Guid.Empty;
            await LogAsync(userId, action, resourceType, resourceId, details, oldValue, newValue);
        }

        public async Task LogAsync(Guid userId, string action, string resourceType, Guid? resourceId, string? details = null, string? oldValue = null, string? newValue = null)
        {
            await StageAsync(userId, action, resourceType, resourceId, details, oldValue, newValue);
            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// Adds the audit row to the change tracker without saving, so the caller's
        /// own SaveChangesAsync commits the audit and the change it describes in one
        /// transaction. Financial mutations use this: an audit that cannot be written
        /// must take the money operation down with it rather than be logged and lost.
        /// </summary>
        public async Task StageAsync(Guid userId, string action, string resourceType, Guid? resourceId, string? details = null, string? oldValue = null, string? newValue = null)
        {
            var tenantId = GetCurrentTenantId();
            var previousLog = await GetPreviousAuditLogAsync(tenantId);

            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                Action = action,
                ResourceType = resourceType,
                ResourceId = resourceId,
                Description = details,
                OldValues = oldValue,
                NewValues = newValue,
                Timestamp = DateTime.UtcNow,
                IpAddress = GetCurrentIpAddress(),
                UserAgent = GetCurrentUserAgent(),
                SessionId = GetCurrentSessionId(),
                Status = "active",
                CreatedAt = DateTime.UtcNow,
                
                // Blockchain-like fields
                SequenceNumber = (previousLog?.SequenceNumber ?? 0) + 1,
                PreviousEventHash = previousLog?.EventHash,
                IsSystemGenerated = false,
                IsImmutable = true,
                DataClassification = DetermineDataClassification(resourceType),
                RiskLevel = DetermineRiskLevel(action, resourceType),
                ComplianceFlags = GetComplianceFlags(resourceType),
                RetentionDays = 2555, // 7 years for HIPAA
                RetentionExpiry = DateTime.UtcNow.AddDays(2555)
            };

            // Calculate hash for this event
            auditLog.EventHash = CalculateEventHash(auditLog);

            _context.AuditLogs.Add(auditLog);
        }

        public async Task LogSecurityEventAsync(Guid userId, string eventType, string riskLevel, Dictionary<string, object> metadata)
        {
            var details = JsonSerializer.Serialize(metadata);
            var tenantId = GetCurrentTenantId();
            var previousLog = await GetPreviousAuditLogAsync(tenantId);

            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                Action = eventType,
                ResourceType = "SecurityEvent",
                Description = details,
                Timestamp = DateTime.UtcNow,
                IpAddress = GetCurrentIpAddress(),
                UserAgent = GetCurrentUserAgent(),
                SessionId = GetCurrentSessionId(),
                Status = "active",
                CreatedAt = DateTime.UtcNow,
                
                SequenceNumber = (previousLog?.SequenceNumber ?? 0) + 1,
                PreviousEventHash = previousLog?.EventHash,
                IsSystemGenerated = false,
                IsImmutable = true,
                DataClassification = "Confidential",
                RiskLevel = riskLevel,
                ComplianceFlags = "[\"HIPAA\", \"SOC2\"]",
                RetentionDays = 2555,
                RetentionExpiry = DateTime.UtcNow.AddDays(2555)
            };

            auditLog.EventHash = CalculateEventHash(auditLog);

            _context.AuditLogs.Add(auditLog);
            await _context.SaveChangesAsync();
        }

        public async Task LogDataAccessAsync(Guid userId, string resourceType, Guid resourceId, string action, string dataClassification)
        {
            var tenantId = GetCurrentTenantId();
            var previousLog = await GetPreviousAuditLogAsync(tenantId);

            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                Action = action,
                ResourceType = resourceType,
                ResourceId = resourceId,
                Timestamp = DateTime.UtcNow,
                IpAddress = GetCurrentIpAddress(),
                UserAgent = GetCurrentUserAgent(),
                SessionId = GetCurrentSessionId(),
                Status = "active",
                CreatedAt = DateTime.UtcNow,
                
                SequenceNumber = (previousLog?.SequenceNumber ?? 0) + 1,
                PreviousEventHash = previousLog?.EventHash,
                IsSystemGenerated = false,
                IsImmutable = true,
                DataClassification = dataClassification,
                RiskLevel = DetermineRiskLevel(action, resourceType),
                ComplianceFlags = "[\"HIPAA\"]",
                RetentionDays = 2555,
                RetentionExpiry = DateTime.UtcNow.AddDays(2555)
            };

            auditLog.EventHash = CalculateEventHash(auditLog);

            _context.AuditLogs.Add(auditLog);
            await _context.SaveChangesAsync();
        }

        public async Task LogPermissionChangeAsync(Guid userId, Guid targetUserId, List<string> permissionChanges)
        {
            var details = JsonSerializer.Serialize(new { targetUserId, changes = permissionChanges });
            await LogAsync(userId, "PermissionChange", "UserPermissions", targetUserId, details);
        }

        public async Task LogConfigurationChangeAsync(Guid userId, string configKey, string oldValue, string newValue)
        {
            await LogAsync(userId, "ConfigurationChange", "SystemConfiguration", null, configKey, oldValue, newValue);
        }

        public string CalculateEventHash(AuditLog auditLog)
        {
            // Create a deterministic string representation of the audit log
            var data = $"{auditLog.Id}|{auditLog.TenantId}|{auditLog.UserId}|{auditLog.Action}|{auditLog.ResourceType}|{auditLog.ResourceId}|{auditLog.Timestamp:O}";
            
            using (var sha256 = SHA256.Create())
            {
                var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(data));
                return Convert.ToBase64String(hashBytes);
            }
        }

        public async Task<AuditLog?> GetPreviousAuditLogAsync(Guid tenantId)
        {
            return await _context.AuditLogs
                .Where(a => a.TenantId == tenantId)
                .OrderByDescending(a => a.SequenceNumber)
                .FirstOrDefaultAsync();
        }

        public async Task<bool> VerifyAuditIntegrityAsync(Guid tenantId, DateTime startDate, DateTime endDate)
        {
            var auditLogs = await _context.AuditLogs
                .Where(a => a.TenantId == tenantId 
                    && a.Timestamp >= startDate 
                    && a.Timestamp <= endDate)
                .OrderBy(a => a.SequenceNumber)
                .ToListAsync();

            for (int i = 0; i < auditLogs.Count; i++)
            {
                var currentLog = auditLogs[i];
                
                // Verify the hash of the current log
                var calculatedHash = CalculateEventHash(currentLog);
                if (currentLog.EventHash != calculatedHash)
                {
                    return false; // Hash mismatch - tampering detected
                }

                // Verify the chain (previous hash should match)
                if (i > 0)
                {
                    var previousLog = auditLogs[i - 1];
                    if (currentLog.PreviousEventHash != previousLog.EventHash)
                    {
                        return false; // Chain broken - tampering detected
                    }
                }

                // Verify sequence numbers are consecutive
                if (i > 0)
                {
                    var previousLog = auditLogs[i - 1];
                    if (currentLog.SequenceNumber != previousLog.SequenceNumber + 1)
                    {
                        return false; // Sequence broken - entries may be missing
                    }
                }
            }

            return true; // All checks passed
        }

        public async Task<List<AuditLog>> DetectTamperingAsync(Guid tenantId)
        {
            var tamperedLogs = new List<AuditLog>();
            
            var auditLogs = await _context.AuditLogs
                .Where(a => a.TenantId == tenantId)
                .OrderBy(a => a.SequenceNumber)
                .ToListAsync();

            for (int i = 0; i < auditLogs.Count(); i++)
            {
                var currentLog = auditLogs[i];
                var calculatedHash = CalculateEventHash(currentLog);
                
                if (currentLog.EventHash != calculatedHash)
                {
                    tamperedLogs.Add(currentLog);
                }

                if (i > 0)
                {
                    var previousLog = auditLogs[i - 1];
                    if (currentLog.PreviousEventHash != previousLog.EventHash)
                    {
                        tamperedLogs.Add(currentLog);
                    }
                }
            }

            return tamperedLogs;
        }

        public async Task<List<AuditLog>> GetAuditLogsAsync(Guid? userId = null, string? action = null, string? resourceType = null, DateTime? fromDate = null, DateTime? toDate = null)
        {
            var tenantId = GetCurrentTenantId();

            var query = _context.AuditLogs
                .Where(a => a.TenantId == tenantId);

            if (userId.HasValue)
                query = query.Where(a => a.UserId == userId.Value);

            if (!string.IsNullOrEmpty(action))
                query = query.Where(a => a.Action == action);

            if (!string.IsNullOrEmpty(resourceType))
                query = query.Where(a => a.ResourceType == resourceType);

            if (fromDate.HasValue)
                query = query.Where(a => a.Timestamp >= fromDate.Value);

            if (toDate.HasValue)
                query = query.Where(a => a.Timestamp <= toDate.Value);

            return await query.OrderByDescending(a => a.Timestamp).ToListAsync();
        }

        public async Task<int> ArchiveOldAuditsAsync(DateTime beforeDate)
        {
            var oldLogs = await _context.AuditLogs
                .Where(a => a.Timestamp < beforeDate 
                    && a.RetentionExpiry < DateTime.UtcNow)
                .ToListAsync();

            foreach (var log in oldLogs)
            {
                log.Status = "archived";
            }

            await _context.SaveChangesAsync();
            return oldLogs.Count();
        }

        public async Task<Dictionary<string, int>> GenerateComplianceReportAsync(Guid tenantId, DateTime startDate, DateTime endDate, string complianceType)
        {
            var auditLogs = await _context.AuditLogs
                .Where(a => a.TenantId == tenantId 
                    && a.Timestamp >= startDate 
                    && a.Timestamp <= endDate 
                    && a.ComplianceFlags != null 
                    && a.ComplianceFlags.Contains(complianceType))
                .ToListAsync();

            var report = new Dictionary<string, int>
            {
                ["TotalEvents"] = auditLogs.Count(),
                ["DataAccess"] = auditLogs.Count(a => a.Action.Contains("View") || a.Action.Contains("Read")),
                ["DataModification"] = auditLogs.Count(a => a.Action.Contains("Create") || a.Action.Contains("Update") || a.Action.Contains("Delete")),
                ["SecurityEvents"] = auditLogs.Count(a => a.ResourceType == "SecurityEvent"),
                ["HighRiskEvents"] = auditLogs.Count(a => a.RiskLevel == "High" || a.RiskLevel == "Critical"),
                ["PHIAccess"] = auditLogs.Count(a => a.DataClassification == "PHI"),
                ["PermissionChanges"] = auditLogs.Count(a => a.Action == "PermissionChange"),
                ["ConfigurationChanges"] = auditLogs.Count(a => a.Action == "ConfigurationChange")
            };

            return report;
        }

        // Helper methods
        private string DetermineDataClassification(string resourceType)
        {
            var phiResources = new[] { "Patient", "ClinicalExamination", "Prescription", "MedicalRecord", "LabReport", "Diagnosis" };
            
            if (phiResources.Contains(resourceType))
                return "PHI";
            
            if (resourceType.Contains("User") || resourceType.Contains("Role") || resourceType.Contains("Permission"))
                return "Confidential";
            
            if (resourceType.Contains("System") || resourceType.Contains("Configuration"))
                return "Internal";
            
            return "Public";
        }

        private string DetermineRiskLevel(string action, string resourceType)
        {
            if (action.Contains("Delete") || action == "PermissionChange")
                return "High";
            
            if (action.Contains("Update") || action.Contains("Create"))
                return "Medium";
            
            if (DetermineDataClassification(resourceType) == "PHI")
                return "High";
            
            return "Low";
        }

        private string GetComplianceFlags(string resourceType)
        {
            var flags = new List<string> { "SOC2" };
            
            var phiResources = new[] { "Patient", "ClinicalExamination", "Prescription", "MedicalRecord", "LabReport", "Diagnosis" };
            if (phiResources.Contains(resourceType))
            {
                flags.Add("HIPAA");
            }
            
            return JsonSerializer.Serialize(flags);
        }
    }
}
