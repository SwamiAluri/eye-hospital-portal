using AuthService.Authorization;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AuthService.Controllers
{
    [ApiController]
    [Route("api/user-branches")]
    [Authorize]
    public class UserBranchesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly UserManager<AppUser> _userManager;

        public UserBranchesController(AppDbContext context, UserManager<AppUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        private bool TryGetTenantId(out Guid tenantId)
        {
            tenantId = Guid.Empty;
            if (!HttpContext.Items.TryGetValue("TenantId", out var t)) return false;
            if (t is Guid g) { tenantId = g; return true; }
            return false;
        }

        private Guid GetCurrentUserId()
        {
            // Log all claims for debugging
            Console.WriteLine("=== JWT Claims Debug ===");
            foreach (var claim in User.Claims)
            {
                Console.WriteLine($"Claim Type: {claim.Type}, Value: {claim.Value}");
            }
            
            // Try multiple claim types
            var userIdClaim = User.FindFirst("sub")?.Value 
                ?? User.FindFirst("user_id")?.Value 
                ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            
            Console.WriteLine($"Selected UserId Claim: {userIdClaim}");
            
            return Guid.TryParse(userIdClaim, out var userId) ? userId : Guid.Empty;
        }

        /// <summary>
        /// Branches assigned to the current authenticated user (Patient Hub branch switcher).
        /// GET /api/user-branches/me
        /// </summary>
        [HttpGet("me")]
        public async Task<IActionResult> GetMyBranches()
        {
            if (!TryGetTenantId(out var tenantId))
                return BadRequest(new { message = "TenantId missing" });

            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized(new { message = "Current user ID not found" });

            return await GetUserBranchesInternal(tenantId, userId);
        }

        /// <summary>
        /// Get all branch assignments for a specific user
        /// GET /api/user-branches/user/{userId}
        /// </summary>
        [HttpGet("user/{userId}")]
        [RequirePermission("user.view")]
        public async Task<IActionResult> GetUserBranches(Guid userId)
        {
            if (!TryGetTenantId(out var tenantId))
                return BadRequest(new { message = "TenantId missing" });

            return await GetUserBranchesInternal(tenantId, userId);
        }

        private async Task<IActionResult> GetUserBranchesInternal(Guid tenantId, Guid userId)
        {
            var now = DateTime.UtcNow;
            var userBranches = await _context.Set<UserBranch>()
                .Where(ub => ub.UserId == userId && ub.TenantId == tenantId && ub.Status == "active"
                          && ub.EffectiveFrom <= now
                          && (ub.EffectiveUntil == null || ub.EffectiveUntil > now))
                .Join(_context.Set<Branch>(),
                    ub => ub.BranchId,
                    b => b.Id,
                    (ub, b) => new UserBranchListItem
                    {
                        Id = ub.Id,
                        UserId = ub.UserId,
                        BranchId = ub.BranchId,
                        BranchName = b.Name,
                        BranchCode = b.BranchCode,
                        IsDefault = ub.IsDefault,
                        AssignedAt = ub.AssignedAt,
                        EffectiveFrom = ub.EffectiveFrom,
                        EffectiveUntil = ub.EffectiveUntil,
                        Status = ub.Status,
                        Notes = ub.Notes
                    })
                .OrderByDescending(ub => ub.IsDefault)
                .ThenBy(ub => ub.BranchName)
                .ToListAsync();

            // Align with FollowupBranchAccessService: include Users.BranchId when missing from assignments.
            var primaryBranchId = await _userManager.Users
                .AsNoTracking()
                .Where(u => u.Id == userId && u.TenantId == tenantId)
                .Select(u => u.BranchId)
                .FirstOrDefaultAsync();

            if (primaryBranchId.HasValue
                && !userBranches.Any(b => b.BranchId == primaryBranchId.Value))
            {
                var branch = await _context.Set<Branch>()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(b =>
                        b.Id == primaryBranchId.Value
                        && b.TenantId == tenantId
                        && b.Status == "Active"
                        && b.DeletedAt == null);
                if (branch != null)
                {
                    userBranches.Add(new UserBranchListItem
                    {
                        Id = Guid.Empty,
                        UserId = userId,
                        BranchId = branch.Id,
                        BranchName = branch.Name,
                        BranchCode = branch.BranchCode,
                        IsDefault = userBranches.Count == 0,
                        AssignedAt = null,
                        EffectiveFrom = null,
                        EffectiveUntil = null,
                        Status = "active",
                        Notes = null
                    });
                    userBranches = userBranches
                        .OrderByDescending(ub => ub.IsDefault)
                        .ThenBy(ub => ub.BranchName)
                        .ToList();
                }
            }

            return Ok(new
            {
                userId,
                count = userBranches.Count,
                branches = userBranches.Select(ub => new
                {
                    id = ub.Id,
                    userId = ub.UserId,
                    branchId = ub.BranchId,
                    branchName = ub.BranchName,
                    branchCode = ub.BranchCode,
                    isDefault = ub.IsDefault,
                    assignedAt = ub.AssignedAt,
                    effectiveFrom = ub.EffectiveFrom,
                    effectiveUntil = ub.EffectiveUntil,
                    status = ub.Status,
                    notes = ub.Notes
                })
            });
        }

        private sealed class UserBranchListItem
        {
            public Guid Id { get; set; }
            public Guid UserId { get; set; }
            public Guid BranchId { get; set; }
            public string BranchName { get; set; } = "";
            public string? BranchCode { get; set; }
            public bool IsDefault { get; set; }
            public DateTime? AssignedAt { get; set; }
            public DateTime? EffectiveFrom { get; set; }
            public DateTime? EffectiveUntil { get; set; }
            public string Status { get; set; } = "active";
            public string? Notes { get; set; }
        }

        /// <summary>
        /// Assign a single branch to a user
        /// POST /api/user-branches
        /// </summary>
        [HttpPost]
        [RequirePermission("user.edit")]
        public async Task<IActionResult> AssignBranch([FromBody] AssignBranchRequest request)
        {
            if (!TryGetTenantId(out var tenantId))
                return BadRequest(new { message = "TenantId missing" });

            var currentUserId = GetCurrentUserId();
            if (currentUserId == Guid.Empty)
                return Unauthorized(new { message = "Current user ID not found" });

            // Verify user exists
            var user = await _userManager.Users
                .FirstOrDefaultAsync(u => u.Id == request.UserId && u.TenantId == tenantId);
            if (user == null)
                return NotFound(new { message = "User not found" });

            // Verify branch exists
            var branch = await _context.Set<Branch>()
                .FirstOrDefaultAsync(b => b.Id == request.BranchId && b.TenantId == tenantId);
            if (branch == null)
                return NotFound(new { message = "Branch not found" });

            // Check if already assigned
            var exists = await _context.Set<UserBranch>()
                .AnyAsync(ub => ub.UserId == request.UserId && 
                               ub.BranchId == request.BranchId && 
                               ub.TenantId == tenantId &&
                               ub.Status == "active");
            if (exists)
                return Conflict(new { message = "User is already assigned to this branch" });

            // If setting as default, unset other defaults first
            if (request.IsDefault)
            {
                var existingDefaults = await _context.Set<UserBranch>()
                    .Where(ub => ub.UserId == request.UserId && 
                                ub.TenantId == tenantId && 
                                ub.IsDefault)
                    .ToListAsync();
                
                foreach (var def in existingDefaults)
                {
                    def.IsDefault = false;
                    def.UpdatedAt = DateTime.UtcNow;
                    def.UpdatedByUserId = currentUserId;
                }
            }

            // Create new branch assignment
            var userBranch = new UserBranch
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = request.UserId,
                BranchId = request.BranchId,
                IsDefault = request.IsDefault,
                AssignedAt = DateTime.UtcNow,
                AssignedByUserId = currentUserId,
                EffectiveFrom = request.EffectiveFrom ?? DateTime.UtcNow,
                EffectiveUntil = request.EffectiveUntil,
                Status = "active",
                Notes = request.Notes,
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = currentUserId,
                UpdatedAt = DateTime.UtcNow,
                UpdatedByUserId = currentUserId
            };

            await _context.Set<UserBranch>().AddAsync(userBranch);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetUserBranches), 
                new { userId = request.UserId }, 
                new { 
                    id = userBranch.Id,
                    message = "Branch assigned successfully",
                    branchName = branch.Name
                });
        }

        /// <summary>
        /// Assign multiple branches to a user at once
        /// POST /api/user-branches/bulk-assign
        /// </summary>
        [HttpPost("bulk-assign")]
        [RequirePermission("user.edit")]
        public async Task<IActionResult> BulkAssignBranches([FromBody] BulkAssignBranchesRequest request)
        {
            if (!TryGetTenantId(out var tenantId))
                return BadRequest(new { message = "TenantId missing" });

            var currentUserId = GetCurrentUserId();
            if (currentUserId == Guid.Empty)
                return Unauthorized(new { message = "Current user ID not found" });

            // Verify user exists
            var user = await _userManager.Users
                .FirstOrDefaultAsync(u => u.Id == request.UserId && u.TenantId == tenantId);
            if (user == null)
                return NotFound(new { message = "User not found" });

            // Get existing branch assignments
            var existingBranches = await _context.Set<UserBranch>()
                .Where(ub => ub.UserId == request.UserId && 
                            ub.TenantId == tenantId && 
                            ub.Status == "active")
                .ToListAsync();

            var existingBranchIds = existingBranches.Select(ub => ub.BranchId).ToHashSet();
            var newBranchIds = request.BranchIds.Except(existingBranchIds).ToList();

            if (!newBranchIds.Any())
                return Ok(new { message = "All branches are already assigned", count = 0 });

            // Unset existing defaults if we're setting a new default
            if (request.DefaultBranchId.HasValue)
            {
                foreach (var existing in existingBranches.Where(ub => ub.IsDefault))
                {
                    existing.IsDefault = false;
                    existing.UpdatedAt = DateTime.UtcNow;
                    existing.UpdatedByUserId = currentUserId;
                }
            }

            // Create new assignments
            var newAssignments = new List<UserBranch>();
            foreach (var branchId in newBranchIds)
            {
                var assignment = new UserBranch
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    UserId = request.UserId,
                    BranchId = branchId,
                    IsDefault = request.DefaultBranchId.HasValue && branchId == request.DefaultBranchId.Value,
                    AssignedAt = DateTime.UtcNow,
                    AssignedByUserId = currentUserId,
                    EffectiveFrom = DateTime.UtcNow,
                    Status = "active",
                    CreatedAt = DateTime.UtcNow,
                    CreatedByUserId = currentUserId,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedByUserId = currentUserId
                };
                newAssignments.Add(assignment);
            }

            await _context.Set<UserBranch>().AddRangeAsync(newAssignments);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"{newAssignments.Count} branch(es) assigned successfully",
                count = newAssignments.Count,
                assignedBranches = newAssignments.Select(a => new { a.BranchId, a.IsDefault })
            });
        }

        /// <summary>
        /// Set a branch as the user's default branch
        /// PUT /api/user-branches/{id}/set-default
        /// </summary>
        [HttpPut("{id}/set-default")]
        [RequirePermission("user.edit")]
        public async Task<IActionResult> SetDefaultBranch(Guid id)
        {
            if (!TryGetTenantId(out var tenantId))
                return BadRequest(new { message = "TenantId missing" });

            var currentUserId = GetCurrentUserId();

            var userBranch = await _context.Set<UserBranch>()
                .FirstOrDefaultAsync(ub => ub.Id == id && ub.TenantId == tenantId);
            if (userBranch == null)
                return NotFound(new { message = "Branch assignment not found" });

            // Unset other defaults for this user
            var otherDefaults = await _context.Set<UserBranch>()
                .Where(ub => ub.UserId == userBranch.UserId && 
                            ub.TenantId == tenantId && 
                            ub.Id != id && 
                            ub.IsDefault)
                .ToListAsync();

            foreach (var other in otherDefaults)
            {
                other.IsDefault = false;
                other.UpdatedAt = DateTime.UtcNow;
                other.UpdatedByUserId = currentUserId;
            }

            // Set this one as default
            userBranch.IsDefault = true;
            userBranch.UpdatedAt = DateTime.UtcNow;
            userBranch.UpdatedByUserId = currentUserId;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Default branch updated successfully" });
        }

        /// <summary>
        /// Remove a branch assignment from a user
        /// DELETE /api/user-branches/{id}
        /// </summary>
        [HttpDelete("{id}")]
        [RequirePermission("user.edit")]
        public async Task<IActionResult> RemoveBranchAssignment(Guid id)
        {
            if (!TryGetTenantId(out var tenantId))
                return BadRequest(new { message = "TenantId missing" });

            var userBranch = await _context.Set<UserBranch>()
                .FirstOrDefaultAsync(ub => ub.Id == id && ub.TenantId == tenantId);
            if (userBranch == null)
                return NotFound(new { message = "Branch assignment not found" });

            // Check if this is the only active branch
            var activeBranches = await _context.Set<UserBranch>()
                .CountAsync(ub => ub.UserId == userBranch.UserId && 
                                 ub.TenantId == tenantId && 
                                 ub.Status == "active");

            if (activeBranches <= 1)
                return BadRequest(new { message = "Cannot remove the last branch assignment. User must have at least one branch." });

            // Soft delete
            userBranch.Status = "inactive";
            userBranch.UpdatedAt = DateTime.UtcNow;
            userBranch.UpdatedByUserId = GetCurrentUserId();

            // If this was the default, set another as default
            if (userBranch.IsDefault)
            {
                var newDefault = await _context.Set<UserBranch>()
                    .Where(ub => ub.UserId == userBranch.UserId && 
                                ub.TenantId == tenantId && 
                                ub.Status == "active" &&
                                ub.Id != id)
                    .FirstOrDefaultAsync();

                if (newDefault != null)
                {
                    newDefault.IsDefault = true;
                    newDefault.UpdatedAt = DateTime.UtcNow;
                    newDefault.UpdatedByUserId = GetCurrentUserId();
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Branch assignment removed successfully" });
        }

        // Request DTOs
        public class AssignBranchRequest
        {
            public Guid UserId { get; set; }
            public Guid BranchId { get; set; }
            public bool IsDefault { get; set; } = false;
            public DateTime? EffectiveFrom { get; set; }
            public DateTime? EffectiveUntil { get; set; }
            public string? Notes { get; set; }
        }

        public class BulkAssignBranchesRequest
        {
            public Guid UserId { get; set; }
            public List<Guid> BranchIds { get; set; } = new();
            public Guid? DefaultBranchId { get; set; }
        }
    }
}
