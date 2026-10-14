using AuthService.Context;
using AuthService.Models;
using AuthService.Models.Domain;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AuthService.Services
{
    public interface IPermissionService
    {
        Task<List<string>> GetUserPermissionsAsync(Guid userId, Guid tenantId);
        Task<List<string>> GetRolePermissionsAsync(Guid roleId);
        Task<bool> HasPermissionAsync(Guid userId, string permissionCode, Guid tenantId);
        Task<bool> CanAccessResourceAsync(Guid userId, string resourceType, Guid resourceId, string action, Guid tenantId);
        Task SeedDefaultPermissionsAsync(Guid tenantId);
    }

    public class PermissionService : IPermissionService
    {
        private readonly AppDbContext _context;

        public PermissionService(AppDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// Administrative roles that receive unrestricted portal access via the established
        /// wildcard permission token <c>*</c>. Matched by role NormalizedName — never by email.
        /// </summary>
        public static bool IsUnrestrictedAdministrativeRole(string? normalizedOrDisplayName)
        {
            var key = (normalizedOrDisplayName ?? string.Empty).Trim().ToUpperInvariant();
            return key is "ADMIN" or "SUPERADMIN" or "SUPER ADMIN";
        }

        public async Task<List<string>> GetUserPermissionsAsync(Guid userId, Guid tenantId)
        {
            var user = await _context.Users
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                        .ThenInclude(r => r.RolePermissions)
                            .ThenInclude(rp => rp.Permission)
                .FirstOrDefaultAsync(u => u.Id == userId && u.TenantId == tenantId);

            if (user == null) return new List<string>();

            var activeRoles = user.UserRoles
                .Where(ur => ur.IsActive && ur.Role != null && ur.Role.IsActive && ur.Role.DeletedAt == null)
                .Select(ur => ur.Role)
                .ToList();

            // Role-based unrestricted admin (JWT and DB paths both use this list).
            if (activeRoles.Any(r => IsUnrestrictedAdministrativeRole(r.NormalizedName)
                                     || IsUnrestrictedAdministrativeRole(r.Name)))
            {
                return new List<string> { "*" };
            }

            var permissions = activeRoles
                .SelectMany(r => r.RolePermissions ?? Enumerable.Empty<RolePermission>())
                .Where(rp => rp.Permission != null && rp.Permission.IsActive)
                .Select(rp => rp.Permission.Code)
                .Distinct()
                .ToList();

            return permissions;
        }

        public async Task<List<string>> GetRolePermissionsAsync(Guid roleId)
        {
            var role = await _context.Roles
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == roleId);

            if (role != null
                && role.IsActive
                && role.DeletedAt == null
                && (IsUnrestrictedAdministrativeRole(role.NormalizedName)
                    || IsUnrestrictedAdministrativeRole(role.Name)))
            {
                return new List<string> { "*" };
            }

            var permissions = await _context.RolePermissions
                .Where(rp => rp.RoleId == roleId && rp.Permission.IsActive)
                .Select(rp => rp.Permission.Code)
                .ToListAsync();

            return permissions;
        }

        public async Task<bool> HasPermissionAsync(Guid userId, string permissionCode, Guid tenantId)
        {
            var permissions = await GetUserPermissionsAsync(userId, tenantId);
            return permissions.Contains("*") || permissions.Contains(permissionCode);
        }

        public async Task<bool> CanAccessResourceAsync(Guid userId, string resourceType, Guid resourceId, string action, Guid tenantId)
        {
            // ABAC: Check if user can perform action on specific resource
            var permissionCode = $"{resourceType.ToUpper()}_{action.ToUpper()}";
            
            if (!await HasPermissionAsync(userId, permissionCode, tenantId))
                return false;

            // Check user attributes for resource-level access
            var userAttributes = await _context.UserAttributes
                .Where(ua => ua.UserId == userId)
                .ToListAsync();

            // Example: Check if user has access to specific patient
            if (resourceType == "Patient")
            {
                var assignedPatientsAttr = userAttributes
                    .FirstOrDefault(ua => ua.AttributeKey == "assigned_patients");
                
                if (assignedPatientsAttr != null)
                {
                    var assignedPatientIds = assignedPatientsAttr.AttributeValue.Split(',');
                    return assignedPatientIds.Contains(resourceId.ToString());
                }
            }

            return true;
        }

        public async Task SeedDefaultPermissionsAsync(Guid tenantId)
        {
            // Core permissions for all modules
            var permissions = new List<Permission>
            {
                // Clinical Module
                new Permission { TenantId = tenantId, Code = "CLINICAL_VIEW_PATIENT", Name = "View Patient Records", Module = "Clinical", Action = "View", ResourceType = "Patient" },
                new Permission { TenantId = tenantId, Code = "CLINICAL_CREATE_VISIT", Name = "Create Visit", Module = "Clinical", Action = "Create", ResourceType = "Visit" },
                new Permission { TenantId = tenantId, Code = "CLINICAL_EDIT_VISIT", Name = "Edit Visit", Module = "Clinical", Action = "Edit", ResourceType = "Visit" },
                new Permission { TenantId = tenantId, Code = "CLINICAL_DELETE_VISIT", Name = "Delete Visit", Module = "Clinical", Action = "Delete", ResourceType = "Visit" },
                new Permission { TenantId = tenantId, Code = "CLINICAL_CREATE_PRESCRIPTION", Name = "Create Prescription", Module = "Clinical", Action = "Create", ResourceType = "Prescription" },
                
                // Billing Module
                new Permission { TenantId = tenantId, Code = "BILLING_VIEW_INVOICE", Name = "View Invoice", Module = "Billing", Action = "View", ResourceType = "Invoice" },
                new Permission { TenantId = tenantId, Code = "BILLING_CREATE_INVOICE", Name = "Create Invoice", Module = "Billing", Action = "Create", ResourceType = "Invoice" },
                new Permission { TenantId = tenantId, Code = "BILLING_EDIT_INVOICE", Name = "Edit Invoice", Module = "Billing", Action = "Edit", ResourceType = "Invoice" },
                new Permission { TenantId = tenantId, Code = "BILLING_DELETE_INVOICE", Name = "Delete Invoice", Module = "Billing", Action = "Delete", ResourceType = "Invoice" },
                
                // User Management
                new Permission { TenantId = tenantId, Code = "USER_VIEW_ALL", Name = "View All Users", Module = "UserManagement", Action = "View", ResourceType = "User" },
                new Permission { TenantId = tenantId, Code = "USER_CREATE", Name = "Create User", Module = "UserManagement", Action = "Create", ResourceType = "User" },
                new Permission { TenantId = tenantId, Code = "USER_EDIT", Name = "Edit User", Module = "UserManagement", Action = "Edit", ResourceType = "User" },
                new Permission { TenantId = tenantId, Code = "USER_DELETE", Name = "Deactivate User", Module = "UserManagement", Action = "Delete", ResourceType = "User" },
                new Permission { TenantId = tenantId, Code = "USER_ASSIGN_ROLE", Name = "Assign Roles", Module = "UserManagement", Action = "Edit", ResourceType = "UserRole" },
                
                // Reporting Module
                new Permission { TenantId = tenantId, Code = "REPORTING_VIEW_AUDIT", Name = "View Audit Logs", Module = "Reporting", Action = "View", ResourceType = "AuditLog" },
                new Permission { TenantId = tenantId, Code = "REPORTING_VIEW_ANALYTICS", Name = "View Analytics", Module = "Reporting", Action = "View", ResourceType = "Analytics" }
            };

            foreach (var permission in permissions)
            {
                if (!await _context.Permissions.AnyAsync(p => p.Code == permission.Code && p.TenantId == tenantId))
                {
                    _context.Permissions.Add(permission);
                }
            }

            await _context.SaveChangesAsync();
        }
    }
}