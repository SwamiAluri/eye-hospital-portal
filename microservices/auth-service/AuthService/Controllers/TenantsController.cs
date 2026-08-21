using System;
using System.Threading.Tasks;
using AuthService.Models.Tenant;
using AuthService.Models.Domain;
using AuthService.Services;
using AuthService.Context;
using AuthService.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Controllers
{
    // [Authorize] // TEMPORARILY DISABLED FOR TESTING
    [ApiController]
    [Route("api/[controller]")]
    public class TenantsController : ControllerBase
    {
        private readonly ITenantService _tenantService;
        private readonly ILogger<TenantsController> _logger;
        private readonly AppDbContext _context;

        public TenantsController(ITenantService tenantService, ILogger<TenantsController> logger, AppDbContext context)
        {
            _tenantService = tenantService;
            _logger = logger;
            _context = context;
        }

        /// <summary>
        /// DEBUG: Get all tenant codes (MOCK DATA for testing)
        /// </summary>
        [AllowAnonymous]
        [HttpGet("debug/codes")]
        public ActionResult GetAllTenantCodes()
        {
            try
            {
                // Dev fallback when DB is unavailable — must match seed tenant (admin@test.com).
                var mockTenants = new[]
                {
                    new { id = "155fe198-6ae5-4a01-9254-ead5b427247e", name = "India Eye Hospital Network", tenantCode = "INDIA_EYE_NET" },
                };
                
                _logger.LogInformation("Returning {Count} mock tenants for testing", mockTenants.Length);
                return Ok(new { count = mockTenants.Length, tenants = mockTenants });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tenant codes");
                return StatusCode(500, new { message = "Error", error = ex.Message });
            }
        }

        /// <summary>
        /// DEBUG: Get all tenant codes from database
        /// </summary>
        [AllowAnonymous]
        [HttpGet("debug/codes/db")]
        public async Task<ActionResult> GetAllTenantCodesFromDb()
        {
            try
            {
                var tenants = await _tenantService.GetAllTenantsForLoginAsync();
                return Ok(new { count = tenants.Count, tenants });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tenant codes from database");
                return StatusCode(500, new { message = "Error", error = ex.Message });
            }
        }

        /// <summary>
        /// Get all tenants with filters and pagination
        /// </summary>
        [HttpGet]
        // [RequirePermission("tenant.view")] // TEMPORARILY DISABLED FOR TESTING
        public async Task<ActionResult> GetAllTenants([FromQuery] string? status = null, [FromQuery] string? tier = null)
        {
            try
            {
                _logger.LogInformation("Getting all tenants with status={Status}, tier={Tier}", status, tier);
                var tenants = await _tenantService.GetAllTenantsAsync();
                _logger.LogInformation("Found {Count} tenants in database", tenants.Count());
                
                // Apply filters
                if (!string.IsNullOrEmpty(status) && status != "all")
                {
                    tenants = tenants.Where(t => t.Status == status);
                }
                
                if (!string.IsNullOrEmpty(tier) && tier != "all")
                {
                    tenants = tenants.Where(t => t.SubscriptionTier == tier);
                }
                
                // Get user counts for each tenant
                var result = new List<object>();
                foreach (var tenant in tenants)
                {
                    var userCount = await _context.Users.CountAsync(u => u.TenantId == tenant.Id);
                    
                    result.Add(new
                    {
                        id = tenant.Id,
                        name = tenant.Name,
                        tenantCode = tenant.TenantCode,
                        tenantType = tenant.TenantType ?? "Hospital",
                        status = tenant.Status,
                        tier = tenant.SubscriptionTier,
                        region = tenant.PrimaryRegion ?? "India",
                        currentUserCount = userCount,
                        maxUsers = tenant.MaxUsers,
                        subscriptionEndDate = DateTime.UtcNow.AddYears(1).ToString("yyyy-MM-dd"), // Mock subscription date
                        complianceStatus = (tenant.HipaaCompliant || tenant.NabhAccredited || tenant.GdprCompliant || tenant.DpaCompliant) 
                            ? "Compliant" : "Pending",
                        currency = tenant.DefaultCurrency ?? "USD",
                        language = "English",
                        primaryDomain = $"{tenant.TenantCode?.ToLower()}.hospital.com",
                        contactEmail = tenant.Email,
                        contactPhone = tenant.Phone,
                        address = tenant.Address,
                        city = tenant.City,
                        state = tenant.State,
                        country = tenant.Country,
                        zipCode = tenant.Pincode,
                        createdAt = tenant.CreatedAt,
                        updatedAt = tenant.UpdatedAt
                    });
                }
                
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tenants");
                return StatusCode(500, new { message = "Error retrieving tenants", error = ex.Message });
            }
        }

        /// <summary>
        /// Get tenant by ID
        /// </summary>
        [HttpGet("{id:guid}")]
        // [RequirePermission("tenant.view")] // TEMPORARILY DISABLED FOR TESTING
        public async Task<ActionResult<TenantDetailsDto>> GetTenantById(Guid id)
        {
            try
            {
                var tenant = await _tenantService.GetTenantByIdAsync(id);
                if (tenant == null)
                {
                    return NotFound(new { message = "Tenant not found" });
                }
                return Ok(tenant);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tenant {TenantId}", id);
                return StatusCode(500, new { message = "Error retrieving tenant", error = ex.Message });
            }
        }

        /// <summary>
        /// Get tenant by unique tenant code
        /// </summary>
        [AllowAnonymous]
        [HttpGet("code/{code}")]
        public async Task<ActionResult<TenantDetailsDto>> GetTenantByCode(string code)
        {
            try
            {
                var tenant = await _tenantService.GetTenantByCodeAsync(code);
                if (tenant == null)
                {
                    return NotFound(new { message = "Tenant not found" });
                }
                return Ok(tenant);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tenant by code {Code}", code);
                return StatusCode(500, new { message = "Error retrieving tenant", error = ex.Message });
            }
        }

        /// <summary>
        /// Get tenant by unique domain
        /// </summary>
        [AllowAnonymous]
        [HttpGet("domain/{domain}")]
        public async Task<ActionResult<TenantDetailsDto>> GetTenantByDomain(string domain)
        {
            try
            {
                var tenant = await _tenantService.GetTenantByDomainAsync(domain);
                if (tenant == null)
                {
                    return NotFound(new { message = "Tenant not found" });
                }
                return Ok(tenant);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tenant by domain {Domain}", domain);
                return StatusCode(500, new { message = "Error retrieving tenant", error = ex.Message });
            }
        }

        /// <summary>
        /// Create a new tenant
        /// </summary>
        [HttpPost]
        [RequirePermission("tenant.create")]
        public async Task<ActionResult> CreateTenant([FromBody] CreateTenantRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Name))
                {
                    return BadRequest(new { message = "Tenant name is required" });
                }

                var tenant = new Tenant
                {
                    Id = Guid.NewGuid(),
                    Name = request.Name,
                    TenantCode = request.TenantCode ?? request.Name.Replace(" ", "").ToUpper(),
                    Email = request.CompanyEmail,
                    Phone = request.CompanyPhone,
                    Address = request.ContactInfo?.GetValueOrDefault("address")?.ToString(),
                    City = request.ContactInfo?.GetValueOrDefault("city")?.ToString(),
                    State = request.ContactInfo?.GetValueOrDefault("state")?.ToString(),
                    Pincode = request.ContactInfo?.GetValueOrDefault("zipCode")?.ToString(),
                    Country = request.PrimaryRegion ?? "United States",
                    Status = request.Status ?? "Active",
                    SubscriptionTier = request.Tier ?? request.SubscriptionType ?? "Standard",
                    MaxBranches = request.MaxBranches,
                    MaxUsers = request.MaxUsers,
                    IsActive = request.Status != "Inactive" && request.Status != "Suspended",
                    HipaaCompliant = request.HipaaCompliant,
                    NabhAccredited = request.NabhAccredited,
                    GdprCompliant = request.GdprCompliant,
                    DpaCompliant = request.DpaCompliant,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                
                var result = await _tenantService.CreateTenantAsync(tenant);
                
                var response = new
                {
                    id = result.Id,
                    name = result.Name,
                    tenantCode = result.TenantCode,
                    status = result.Status,
                    tier = result.SubscriptionTier,
                    region = result.Country,
                    currentUserCount = 0,
                    maxUsers = result.MaxUsers,
                    subscriptionEndDate = DateTime.UtcNow.AddYears(1),
                    complianceStatus = (result.HipaaCompliant || result.NabhAccredited || result.GdprCompliant || result.DpaCompliant) 
                        ? "Compliant" : "Pending",
                    createdAt = result.CreatedAt
                };
                
                return CreatedAtAction(nameof(GetTenantById), new { id = result.Id }, response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating tenant");
                return StatusCode(500, new { message = "Error creating tenant", error = ex.Message });
            }
        }

        /// <summary>
        /// Update tenant information
        /// </summary>
        [HttpPut("{id}/details")]
        [RequirePermission("tenant.update")]
        public async Task<ActionResult> UpdateTenant(string id, [FromBody] UpdateTenantRequest request)
        {
            _logger.LogWarning($"========== PUT ENDPOINT HIT! ID: {id} ==========");
            _logger.LogWarning($"Request body - Name: {request?.Name}, Status: {request?.Status}");
            
            if (!Guid.TryParse(id, out var tenantId))
            {
                _logger.LogError($"Invalid GUID format: {id}");
                return BadRequest(new { message = "Invalid tenant ID format" });
            }
            
            try
            {
                _logger.LogInformation($"UpdateTenant called for ID: {tenantId}");
                var tenant = await _tenantService.GetTenantByIdAsync(tenantId);
                _logger.LogInformation($"Tenant found: {tenant != null}, Name: {tenant?.Name}");
                if (tenant == null)
                    return NotFound(new { message = "Tenant not found" });
                
                // Log the ORIGINAL value from database
                _logger.LogWarning($"BEFORE UPDATE - SubscriptionTier: '{tenant.SubscriptionTier}', request.Tier: '{request.Tier}', request.SubscriptionType: '{request.SubscriptionType}'");
                
                // Update only provided fields
                if (!string.IsNullOrEmpty(request.Name))
                    tenant.Name = request.Name;
                if (!string.IsNullOrEmpty(request.Status))
                    tenant.Status = request.Status;
                
                // Support frontend tenantType field
                if (!string.IsNullOrEmpty(request.TenantType))
                    tenant.TenantType = request.TenantType;
                
                // Allow tier updates with validation (support both frontend lowercase and backend formats)
                if (!string.IsNullOrEmpty(request.Tier) || !string.IsNullOrEmpty(request.SubscriptionType))
                {
                    var newTier = request.Tier ?? request.SubscriptionType;
                    var validTiers = new[] { "Starter", "Standard", "Professional", "Enterprise" };
                    
                    if (!string.IsNullOrEmpty(newTier) && validTiers.Contains(newTier))
                    {
                        tenant.SubscriptionTier = newTier;
                        _logger.LogInformation($"Subscription tier updated to '{newTier}'");
                    }
                    else
                    {
                        _logger.LogWarning($"Invalid subscription tier: '{newTier}'. Must be one of: {string.Join(", ", validTiers)}");
                    }
                }
                
                // Support both frontend (contactEmail/contactPhone) and backend (CompanyEmail/CompanyPhone) formats
                if (!string.IsNullOrEmpty(request.ContactEmail))
                    tenant.Email = request.ContactEmail;
                else if (!string.IsNullOrEmpty(request.CompanyEmail))
                    tenant.Email = request.CompanyEmail;
                    
                if (!string.IsNullOrEmpty(request.ContactPhone))
                    tenant.Phone = request.ContactPhone;
                else if (!string.IsNullOrEmpty(request.CompanyPhone))
                    tenant.Phone = request.CompanyPhone;
                    
                // Map region to PrimaryRegion (frontend uses region for regional configuration)
                if (!string.IsNullOrEmpty(request.Region))
                    tenant.PrimaryRegion = request.Region;
                else if (!string.IsNullOrEmpty(request.PrimaryRegion))
                    tenant.PrimaryRegion = request.PrimaryRegion;
                    
                // Support frontend tier field
                if (!string.IsNullOrEmpty(request.Tier))
                    tenant.SubscriptionTier = request.Tier;
                else if (!string.IsNullOrEmpty(request.SubscriptionType))
                    tenant.SubscriptionTier = request.SubscriptionType;
                    
                // Support frontend currency field
                if (!string.IsNullOrEmpty(request.Currency))
                    tenant.DefaultCurrency = request.Currency;
                else if (!string.IsNullOrEmpty(request.DefaultCurrency))
                    tenant.DefaultCurrency = request.DefaultCurrency;
                
                if (request.MaxBranches.HasValue)
                    tenant.MaxBranches = request.MaxBranches.Value;
                if (request.MaxUsers.HasValue)
                    tenant.MaxUsers = request.MaxUsers.Value;
                    
                if (request.HipaaCompliant.HasValue)
                    tenant.HipaaCompliant = request.HipaaCompliant.Value;
                if (request.NabhAccredited.HasValue)
                    tenant.NabhAccredited = request.NabhAccredited.Value;
                if (request.GdprCompliant.HasValue)
                    tenant.GdprCompliant = request.GdprCompliant.Value;
                if (request.DpaCompliant.HasValue)
                    tenant.DpaCompliant = request.DpaCompliant.Value;
                
                // Handle address fields
                if (!string.IsNullOrEmpty(request.Address))
                    tenant.Address = request.Address;
                if (!string.IsNullOrEmpty(request.City))
                    tenant.City = request.City;
                if (!string.IsNullOrEmpty(request.State))
                    tenant.State = request.State;
                if (!string.IsNullOrEmpty(request.Country))
                    tenant.Country = request.Country;
                if (!string.IsNullOrEmpty(request.ZipCode))
                    tenant.Pincode = request.ZipCode;
                
                tenant.IsActive = tenant.Status != "Inactive" && tenant.Status != "Suspended";
                tenant.UpdatedAt = DateTime.UtcNow;
                
                var result = await _tenantService.UpdateTenantAsync(tenant);
                
                if (result == null)
                {
                    return BadRequest(new { message = "Failed to update tenant" });
                }

                var response = new
                {
                    id = result.Id,
                    name = result.Name,
                    tenantCode = result.TenantCode,
                    tenantType = result.TenantType,
                    status = result.Status,
                    tier = result.SubscriptionTier,
                    region = result.PrimaryRegion,
                    maxUsers = result.MaxUsers,
                    complianceStatus = (result.HipaaCompliant || result.NabhAccredited || result.GdprCompliant || result.DpaCompliant) 
                        ? "Compliant" : "Pending",
                    updatedAt = result.UpdatedAt
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating tenant {TenantId}", id);
                return StatusCode(500, new { message = "Error updating tenant", error = ex.Message });
            }
        }

        /// <summary>
        /// Delete tenant
        /// </summary>
        [HttpDelete("{id}")]
        [RequirePermission("tenant.delete")]
        public async Task<ActionResult> DeleteTenant(string id)
        {
            _logger.LogWarning($"========== DELETE ENDPOINT HIT! ID: {id} ==========");
            
            if (!Guid.TryParse(id, out var tenantId))
            {
                _logger.LogError($"Invalid GUID format: {id}");
                return BadRequest(new { message = "Invalid tenant ID format" });
            }
            
            try
            {
                _logger.LogInformation($"DeleteTenant called for ID: {tenantId}");
                var result = await _tenantService.DeleteTenantAsync(tenantId);
                
                if (!result)
                {
                    return NotFound(new { message = "Tenant not found" });
                }

                return Ok(new { success = true, message = "Tenant deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting tenant {TenantId}", id);
                return StatusCode(500, new { message = "Error deleting tenant", error = ex.Message });
            }
        }

        /// <summary>
        /// Update tenant status (Active, Inactive, Suspended)
        /// </summary>
        [HttpPatch("{id:guid}/status")]
        [RequirePermission("tenant.manage")]
        public async Task<ActionResult> UpdateTenantStatus(Guid id, [FromBody] UpdateTenantStatusRequest request)
        {
            try
            {
                var result = await _tenantService.UpdateTenantStatusAsync(id, request.Status);
                if (!result)
                {
                    return NotFound(new { message = "Tenant not found" });
                }
                return Ok(new { success = true, message = "Tenant status updated successfully", status = request.Status });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating tenant status");
                return StatusCode(500, new { message = "Error updating tenant status", error = ex.Message });
            }
        }

        /// <summary>
        /// Update subscription information
        /// </summary>
        [HttpPut("{id:guid}/subscription")]
        [RequirePermission("tenant.manage")]
        public async Task<ActionResult<TenantOperationResult>> UpdateSubscription(Guid id, [FromBody] UpdateSubscriptionRequest request)
        {
            try
            {
                var result = await _tenantService.UpdateSubscriptionAsync(id, request.Tier, request.MaxBranches, request.MaxUsers);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating subscription");
                return StatusCode(500, new { message = "Error updating subscription", error = ex.Message });
            }
        }

        /// <summary>
        /// Get tenant usage metrics
        /// </summary>
        [HttpGet("{id:guid}/usage")]
        // [RequirePermission("tenant.view")] // TEMPORARILY DISABLED FOR TESTING
        public async Task<ActionResult<TenantUsageDto>> GetTenantUsage(Guid id)
        {
            try
            {
                var usage = await _tenantService.GetUsageAsync(id);
                return Ok(usage);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tenant usage");
                return StatusCode(500, new { message = "Error retrieving usage", error = ex.Message });
            }
        }

        /// <summary>
        /// Update compliance settings
        /// </summary>
        [HttpPut("{id:guid}/compliance")]
        [RequirePermission("tenant.manage")]
        public async Task<ActionResult> UpdateCompliance(Guid id, [FromBody] UpdateComplianceRequest request)
        {
            try
            {
                var result = await _tenantService.UpdateComplianceAsync(id, request.HipaaCompliant ?? false, request.NabhAccredited ?? false, request.GdprCompliant ?? false, request.DpaCompliant ?? false);
                return Ok(new { success = result, message = "Compliance settings updated successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating compliance");
                return StatusCode(500, new { message = "Error updating compliance", error = ex.Message });
            }
        }

        /// <summary>
        /// Get compliance status
        /// </summary>
        [HttpGet("{id:guid}/compliance")]
        // [RequirePermission("tenant.view")] // TEMPORARILY DISABLED FOR TESTING
        public async Task<ActionResult> GetComplianceStatus(Guid id)
        {
            try
            {
                var tenant = await _tenantService.GetTenantByIdAsync(id);
                if (tenant == null)
                {
                    return NotFound(new { message = "Tenant not found" });
                }

                var compliance = new
                {
                    HipaaCompliant = tenant.HipaaCompliant,
                    NabhAccredited = tenant.NabhAccredited,
                    GdprCompliant = tenant.GdprCompliant,
                    DpaCompliant = tenant.DpaCompliant
                };

                return Ok(compliance);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting compliance status");
                return StatusCode(500, new { message = "Error retrieving compliance status", error = ex.Message });
            }
        }

        /// <summary>
        /// Get tenant statistics
        /// </summary>
        [HttpGet("{id:guid}/statistics")]
        // [RequirePermission("tenant.view")] // TEMPORARILY DISABLED FOR TESTING
        public async Task<ActionResult> GetStatistics(Guid id)
        {
            try
            {
                var statistics = await _tenantService.GetStatisticsAsync(id);
                return Ok(statistics);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting statistics");
                return StatusCode(500, new { message = "Error retrieving statistics", error = ex.Message });
            }
        }

        /// <summary>
        /// Search tenants by name or code
        /// </summary>
        [HttpGet("search")]
        // [RequirePermission("tenant.view")] // TEMPORARILY DISABLED FOR TESTING
        public async Task<ActionResult> SearchTenants([FromQuery] string query)
        {
            try
            {
                var result = await _tenantService.SearchTenantsAsync(query);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching tenants");
                return StatusCode(500, new { message = "Error searching tenants", error = ex.Message });
            }
        }

        /// <summary>
        /// Check tenant limits
        /// </summary>
        [HttpGet("{id:guid}/limits")]
        // [RequirePermission("tenant.view")] // TEMPORARILY DISABLED FOR TESTING
        public async Task<ActionResult<TenantLimitsCheckDto>> CheckLimits(Guid id)
        {
            try
            {
                var limits = await _tenantService.CheckLimitsAsync(id);
                return Ok(limits);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking limits");
                return StatusCode(500, new { message = "Error checking limits", error = ex.Message });
            }
        }

        /// <summary>
        /// Get organization count for tenant
        /// </summary>
        [HttpGet("{id:guid}/organizations/count")]
        // [RequirePermission("tenant.view")] // TEMPORARILY DISABLED FOR TESTING
        public async Task<ActionResult<int>> GetOrganizationCount(Guid id)
        {
            try
            {
                var count = await _tenantService.GetOrganizationCountAsync(id);
                return Ok(new { count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting organization count");
                return StatusCode(500, new { message = "Error getting count", error = ex.Message });
            }
        }

        /// <summary>
        /// Get branch count for tenant
        /// </summary>
        [HttpGet("{id:guid}/branches/count")]
        // [RequirePermission("tenant.view")] // TEMPORARILY DISABLED FOR TESTING
        public async Task<ActionResult<int>> GetBranchCount(Guid id)
        {
            try
            {
                var count = await _tenantService.GetBranchCountAsync(id);
                return Ok(new { count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting branch count");
                return StatusCode(500, new { message = "Error getting count", error = ex.Message });
            }
        }
    }

    public class UpdateTenantStatusRequest
    {
        public string Status { get; set; } = string.Empty;
    }

    public class UpdateSubscriptionRequest
    {
        public string Tier { get; set; } = string.Empty;
        public int MaxBranches { get; set; }
        public int MaxUsers { get; set; }
    }

    public class UpdateComplianceRequest
    {
        public bool? HipaaCompliant { get; set; }
        public bool? NabhAccredited { get; set; }
        public bool? GdprCompliant { get; set; }
        public bool? DpaCompliant { get; set; }
    }
}
