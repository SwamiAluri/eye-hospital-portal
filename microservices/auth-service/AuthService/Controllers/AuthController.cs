using AuthService.Authorization;
using AuthService.Context;
using AuthService.Models;
using AuthService.Models.Domain;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using AuthService.Models.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AuthService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly UserManager<AppUser> _userManager;
        private readonly RoleManager<AppRole> _roleManager;
        private readonly IJwtService _jwtService;
        private readonly IPermissionService _permissionService;
        private readonly AppDbContext _context;
        private readonly ILogger<AuthController> _logger;
        private readonly INotificationClient _notificationClient;
        private readonly ISessionManagementService _sessionService;

        public AuthController(
            UserManager<AppUser> userManager,
            RoleManager<AppRole> roleManager,
            IJwtService jwtService,
            IPermissionService permissionService,
            AppDbContext context,
            ILogger<AuthController> logger,
            INotificationClient notificationClient,
            ISessionManagementService sessionService)
        {
            _userManager = userManager;
            _roleManager = roleManager;
            _jwtService = jwtService;
            _permissionService = permissionService;
            _context = context;
            _logger = logger;
            _notificationClient = notificationClient;
            _sessionService = sessionService;
        }

        [HttpPost("login")]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
        {
            try
            {
                // Validate tenant
                if (!Guid.TryParse(request.TenantId, out var tenantId))
                {
                    return BadRequest(new { message = "Invalid tenant ID" });
                }

                // Find tenant in database
                var tenant = await _context.Tenants.FindAsync(tenantId);
                if (tenant == null || !tenant.Status.Equals("active", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new { message = "Tenant not found or inactive" });
                }

                // Set tenant context for query filtering
                HttpContext.Items["TenantId"] = tenantId;

                // TEMPORARY: Re-enable demo mode for InMemory database
                if (request.Email?.ToLower() == "admin@hospital.com" || request.Email?.ToLower() == "admin@test.com")
                {
                    _logger.LogInformation("Demo login - Email: {Email}", request.Email);
                    
                    string expectedPassword = request.Email.ToLower() == "admin@hospital.com" ? "Admin@123456" : "Admin123!";
                    if (string.IsNullOrEmpty(request.Password) || request.Password != expectedPassword)
                    {
                        _logger.LogWarning("Demo login failed - use {ExpectedPassword}", expectedPassword);
                        return Unauthorized(new { success = false, message = "Invalid credentials" });
                    }

                    // Get actual user from database (case-insensitive email; tenant = Network Hospital)
                    var dbUser = await LoginIdentityLookup.FindByEmailAndTenantAsync(
                        _context.Users,
                        request.Email,
                        tenantId,
                        email => _userManager.NormalizeEmail(email ?? string.Empty));
                    if (dbUser == null)
                    {
                        return Unauthorized(new { success = false, message = "User not found" });
                    }

                    // Create mock user for demo using ACTUAL user ID
                    var mockUser = new AppUser
                    {
                        Id = dbUser.Id,  // Use actual user ID from database!
                        Email = dbUser.Email,
                        UserName = dbUser.UserName,
                        FirstName = dbUser.FirstName ?? "Admin",
                        LastName = dbUser.LastName ?? "User",
                        TenantId = tenantId,
                        MustChangePasswordOnLogin = false,
                        UserStatus = "Active"
                    };

                    var mockRoles = new List<string> { "Admin", "SuperAdmin" };
                    var mockPermissions = new List<string> { "*" };

                    var demoAccessToken = _jwtService.GenerateToken(mockUser, mockRoles, mockPermissions);
                    var demoRefreshToken = _jwtService.GenerateRefreshToken();
                    await PersistRefreshTokenSessionAsync(mockUser.Id, demoRefreshToken);

                    _logger.LogInformation("Demo login successful for {Email}", request.Email);

                    return Ok(new
                    {
                        success = true,
                        user = new
                        {
                            id = mockUser.Id,
                            email = mockUser.Email,
                            firstName = mockUser.FirstName,
                            lastName = mockUser.LastName,
                            tenantId = mockUser.TenantId,
                            branchId = dbUser.BranchId,
                            tenantName = tenant?.Name ?? "Apollo Hospitals",
                            mustChangePassword = false
                        },
                        roles = mockRoles,         // At root level for frontend
                        permissions = mockPermissions,  // At root level for frontend
                        accessToken = demoAccessToken,
                        refreshToken = demoRefreshToken,
                        expiresIn = 3600
                    });
                }

                // Find user by email (real database authentication)
                // Network Hospital = TenantId. Email match is case-insensitive via NormalizedEmail.
                // Branch membership is NOT a login eligibility check.
                var user = await LoginIdentityLookup.FindByEmailAndTenantAsync(
                    _userManager.Users,
                    request.Email,
                    tenantId,
                    email => _userManager.NormalizeEmail(email ?? string.Empty));

                if (user == null)
                {
                    await LogFailedLogin(request.Email, tenantId, "User not found");
                    return Unauthorized(new { message = "Invalid credentials" });
                }

                // Check if user is locked
                if (user.LockoutEnd > DateTime.UtcNow)
                {
                    return Unauthorized(new { message = "Account is locked. Please try again later." });
                }

                // Verify password
                var isPasswordValid = await _userManager.CheckPasswordAsync(user, request.Password);
                if (!isPasswordValid)
                {
                    user.AccessFailedCount++;
                    if (user.AccessFailedCount >= 5) // Lock after 5 failed attempts
                    {
                        user.LockoutEnd = DateTime.UtcNow.AddMinutes(15);
                    }
                    await _userManager.UpdateAsync(user);
                    await LogFailedLogin(request.Email, tenantId, "Invalid password");
                    return Unauthorized(new { message = "Invalid credentials" });
                }

                // Check if user is active
                if (user.UserStatus == "inactive" || user.UserStatus == "suspended" || user.UserStatus == "Inactive")
                {
                    await LogFailedLogin(request.Email, tenantId, "User inactive");
                    return Unauthorized(new { message = "User account is inactive" });
                }
                
                // Check if user activation is pending
                if (user.UserStatus == "pending_activation" || user.UserStatus == "pending_invitation")
                {
                    await LogFailedLogin(request.Email, tenantId, "User activation pending");
                    return Unauthorized(new { message = "Please complete your account activation first. Check your email for activation instructions." });
                }

                // Reset failed login attempts
                user.AccessFailedCount = 0;
                user.LastLoginAt = DateTime.UtcNow;

                // Check if password is expired
                if (user.PasswordExpiresAt < DateTime.UtcNow && user.PasswordExpiresAt != null)
                {
                    user.MustChangePasswordOnLogin = true;
                }

                await _userManager.UpdateAsync(user);

                // Check if MFA/TOTP is required for this user
                if (user.TwoFactorEnabled)
                {
                    _logger.LogInformation("User {UserId} requires MFA verification", user.Id);
                    
                    // Return MFA required response - DO NOT send email OTP
                    // User must enter TOTP code from their authenticator app
                    return Ok(new
                    {
                        success = true,
                        requiresMfa = true,
                        userId = user.Id,
                        email = user.Email,
                        message = "Please enter the code from your authenticator app"
                    });
                }

                // Get user roles and permissions
                var roles = await _userManager.GetRolesAsync(user);
                var permissions = await _permissionService.GetUserPermissionsAsync(user.Id, tenantId);

                // DEBUG: Log permissions being granted
                Console.WriteLine($"🔐 LOGIN: User {user.Email} granted permissions: [{string.Join(", ", permissions)}]");

                // Generate JWT token
                var accessToken = _jwtService.GenerateToken(user, roles.ToList(), permissions);
                var refreshToken = _jwtService.GenerateRefreshToken();
                await PersistRefreshTokenSessionAsync(user.Id, refreshToken);

                // Resolve branchId — EF may read a stale PascalCase column for SQL-seeded users;
                // fall back to user_branches table which is always correctly seeded.
                var resolvedBranchId = user.BranchId;
                if (resolvedBranchId == null)
                {
                    var defaultBranch = await _context.UserBranches
                        .Where(ub => ub.UserId == user.Id && ub.TenantId == tenantId && ub.Status == "active")
                        .OrderByDescending(ub => ub.IsDefault)
                        .ThenBy(ub => ub.AssignedAt)
                        .FirstOrDefaultAsync();
                    resolvedBranchId = defaultBranch?.BranchId;
                }

                // Log successful login
                await LogAudit(user.Id, tenantId, "user_login", "User", user.Id.ToString(), "SUCCESS", null, null);

                return Ok(new LoginResponse
                {
                    Success = true,
                    Message = "Login successful",
                    AccessToken = accessToken,
                    RefreshToken = refreshToken,
                    ExpiresIn = 3600,
                    User = new UserDto
                    {
                        Id = user.Id,
                        UserName = user.UserName,
                        Email = user.Email,
                        FirstName = user.FirstName,
                        LastName = user.LastName,
                        UserType = user.UserType,
                        TenantId = user.TenantId,
                        BranchId = resolvedBranchId
                    },
                    Roles = roles.ToList(),
                    Permissions = permissions,
                    MustChangePassword = user.MustChangePasswordOnLogin
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Login error");
                return StatusCode(500, new { message = "An error occurred during login" });
            }
        }

        /// <summary>
        /// Logout endpoint - logs the logout action for audit purposes
        /// </summary>
        [HttpPost("logout")]
        [Authorize]
        public async Task<ActionResult> Logout()
        {
            try
            {
                var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }

                var user = await _userManager.FindByIdAsync(userId);
                if (user == null)
                {
                    return NotFound(new { message = "User not found" });
                }

                // Log logout action with IP address
                await LogAudit(user.Id, user.TenantId, "user_logout", "User", user.Id.ToString(), "SUCCESS", null, null);

                return Ok(new { success = true, message = "Logged out successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Logout error");
                return StatusCode(500, new { message = "An error occurred during logout" });
            }
        }

        /// <summary>
        /// Exchange a valid refresh token for a new access token (and rotated refresh token).
        /// </summary>
        [HttpPost("refresh")]
        [AllowAnonymous]
        public async Task<ActionResult<LoginResponse>> Refresh([FromBody] RefreshTokenRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
                return BadRequest(new { message = "Refresh token is required" });

            try
            {
                var session = await _context.UserSessions
                    .FirstOrDefaultAsync(s => s.RefreshToken == request.RefreshToken && s.IsActive);

                if (session == null || session.ExpiresAt < DateTime.UtcNow)
                    return Unauthorized(new { message = "Invalid or expired refresh token" });

                var user = await _userManager.FindByIdAsync(session.UserId.ToString());
                if (user == null)
                    return Unauthorized(new { message = "User not found" });

                var status = user.UserStatus?.ToLowerInvariant() ?? "";
                if (status is "inactive" or "suspended" or "pending_activation" or "pending_invitation")
                    return Unauthorized(new { message = "User account is not active" });

                HttpContext.Items["TenantId"] = user.TenantId;

                var roles = await _userManager.GetRolesAsync(user);
                var permissions = await _permissionService.GetUserPermissionsAsync(user.Id, user.TenantId);
                var accessToken = _jwtService.GenerateToken(user, roles.ToList(), permissions);
                var newRefreshToken = _jwtService.GenerateRefreshToken();

                session.RefreshToken = newRefreshToken;
                session.LastActivityTime = DateTime.UtcNow;
                session.ExpiresAt = DateTime.UtcNow.AddHours(8);
                session.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                var resolvedBranchId = user.BranchId;
                if (resolvedBranchId == null)
                {
                    var defaultBranch = await _context.UserBranches
                        .Where(ub => ub.UserId == user.Id && ub.TenantId == user.TenantId && ub.Status == "active")
                        .OrderByDescending(ub => ub.IsDefault)
                        .ThenBy(ub => ub.AssignedAt)
                        .FirstOrDefaultAsync();
                    resolvedBranchId = defaultBranch?.BranchId;
                }

                return Ok(new LoginResponse
                {
                    Success = true,
                    Message = "Token refreshed",
                    AccessToken = accessToken,
                    RefreshToken = newRefreshToken,
                    ExpiresIn = 3600,
                    User = new UserDto
                    {
                        Id = user.Id,
                        UserName = user.UserName,
                        Email = user.Email,
                        FirstName = user.FirstName,
                        LastName = user.LastName,
                        UserType = user.UserType,
                        TenantId = user.TenantId,
                        BranchId = resolvedBranchId,
                    },
                    Roles = roles.ToList(),
                    Permissions = permissions,
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Token refresh error");
                return StatusCode(500, new { message = "An error occurred during token refresh" });
            }
        }

        [HttpPost("change-password")]
        [Authorize] // Only requires authentication, no special permission needed
        public async Task<ActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(userId, out var userGuid))
                return Unauthorized();

            var user = await _userManager.FindByIdAsync(userGuid.ToString());
            if (user == null)
                return NotFound();

            // Verify current password
            var isPasswordValid = await _userManager.CheckPasswordAsync(user, request.CurrentPassword);
            if (!isPasswordValid)
                return BadRequest(new { message = "Current password is incorrect" });

            // Update password
            var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
            if (!result.Succeeded)
                return BadRequest(new { errors = result.Errors.Select(e => e.Description) });

            user.LastPasswordChangeAt = DateTime.UtcNow;
            user.MustChangePasswordOnLogin = false;
            user.PasswordExpiresAt = DateTime.UtcNow.AddDays(90); // 90-day expiry
            await _userManager.UpdateAsync(user);

            await LogAudit(user.Id, user.TenantId, "password_change", "User", user.Id.ToString(), "SUCCESS", null, null);

            return Ok(new { message = "Password changed successfully" });
        }

        /// <summary>
        /// Initiates password reset process by sending reset email
        /// </summary>
        [HttpPost("forgot-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
        {
            try
            {
                // Validate tenant
                var tenant = await _context.Tenants.FindAsync(request.TenantId);
                if (tenant == null)
                    return BadRequest(new { message = "Invalid tenant" });

                // Find user by email and tenant
                var user = await _userManager.Users
                    .FirstOrDefaultAsync(u => u.Email == request.Email && u.TenantId == request.TenantId);

                // Always return success to prevent email enumeration
                if (user == null)
                {
                    _logger.LogWarning("Password reset attempted for non-existent email: {Email}", request.Email);
                    return Ok(new { message = "If the email exists, a password reset link has been sent" });
                }

                // Check if user is active
                if (user.UserStatus != "Active" && user.UserStatus != "active")
                {
                    _logger.LogWarning("Password reset attempted for inactive user: {Email}", request.Email);
                    return Ok(new { message = "If the email exists, a password reset link has been sent" });
                }

                // Generate secure reset token (256-bit)
                var resetToken = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32))
                    .Replace("+", "-").Replace("/", "_").Replace("=", "");

                // Set token and expiration (1 hour)
                user.PasswordResetToken = resetToken;
                user.ResetTokenExpiresAt = DateTime.UtcNow.AddHours(1);
                await _userManager.UpdateAsync(user);

                // Send reset email via notification service
                var resetUrl = $"{Request.Scheme}://{Request.Host}/auth/reset-password?token={resetToken}";
                
                try
                {
                    var emailResult = await _notificationClient.SendPasswordResetEmailAsync(
                        user.Id,
                        user.TenantId,
                        user.Email!,
                        resetUrl,
                        user.FirstName ?? user.Email!
                    );

                    if (!emailResult.Success)
                    {
                        _logger.LogError("Failed to send password reset email: {Error}", emailResult.Error);
                        // Don't expose email sending failure to prevent enumeration
                    }
                }
                catch (Exception emailEx)
                {
                    _logger.LogError(emailEx, "Exception sending password reset email for user {UserId}", user.Id);
                    // Continue - don't expose internal errors
                }

                // Audit log
                await LogAudit(user.Id, user.TenantId, "password_reset_requested", "User", user.Id.ToString(), 
                    "SUCCESS", null, Request.HttpContext.Connection.RemoteIpAddress?.ToString());

                return Ok(new { message = "If the email exists, a password reset link has been sent" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in ForgotPassword");
                return StatusCode(500, new { message = "An error occurred processing your request" });
            }
        }

        /// <summary>
        /// Validates password reset token
        /// </summary>
        [HttpPost("validate-reset-token")]
        [AllowAnonymous]
        public async Task<IActionResult> ValidateResetToken([FromBody] ValidateResetTokenRequest request)
        {
            try
            {
                var user = await _userManager.Users
                    .FirstOrDefaultAsync(u => u.PasswordResetToken == request.Token);

                if (user == null)
                    return BadRequest(new { message = "Invalid or expired reset token", valid = false });

                if (user.ResetTokenExpiresAt == null || user.ResetTokenExpiresAt < DateTime.UtcNow)
                    return BadRequest(new { message = "Reset token has expired", valid = false });

                return Ok(new 
                { 
                    valid = true,
                    email = user.Email,
                    expiresAt = user.ResetTokenExpiresAt
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating reset token");
                return StatusCode(500, new { message = "An error occurred", valid = false });
            }
        }

        /// <summary>
        /// Resets password using valid token
        /// </summary>
        [HttpPost("reset-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            try
            {
                // Validate passwords match
                if (request.NewPassword != request.ConfirmPassword)
                    return BadRequest(new { message = "Passwords do not match" });

                // Find user by reset token
                var user = await _userManager.Users
                    .FirstOrDefaultAsync(u => u.PasswordResetToken == request.Token);

                if (user == null)
                    return BadRequest(new { message = "Invalid or expired reset token" });

                // Validate token expiration
                if (user.ResetTokenExpiresAt == null || user.ResetTokenExpiresAt < DateTime.UtcNow)
                {
                    // Clear expired token
                    user.PasswordResetToken = null;
                    user.ResetTokenExpiresAt = null;
                    await _userManager.UpdateAsync(user);
                    
                    return BadRequest(new { message = "Reset token has expired. Please request a new one." });
                }

                // Validate password strength (same as activation)
                if (request.NewPassword.Length < 12)
                    return BadRequest(new { message = "Password must be at least 12 characters long" });

                if (!request.NewPassword.Any(char.IsUpper))
                    return BadRequest(new { message = "Password must contain at least one uppercase letter" });

                if (!request.NewPassword.Any(char.IsLower))
                    return BadRequest(new { message = "Password must contain at least one lowercase letter" });

                if (!request.NewPassword.Any(char.IsDigit))
                    return BadRequest(new { message = "Password must contain at least one number" });

                if (!request.NewPassword.Any(ch => "!@#$%^&*()_+-=[]{}|;:,.<>?".Contains(ch)))
                    return BadRequest(new { message = "Password must contain at least one special character" });

                // Remove old password and set new one
                var removePasswordResult = await _userManager.RemovePasswordAsync(user);
                if (!removePasswordResult.Succeeded)
                {
                    _logger.LogError("Failed to remove old password for user {UserId}", user.Id);
                    return StatusCode(500, new { message = "An error occurred resetting your password" });
                }

                var addPasswordResult = await _userManager.AddPasswordAsync(user, request.NewPassword);
                if (!addPasswordResult.Succeeded)
                {
                    return BadRequest(new 
                    { 
                        message = "Failed to set new password",
                        errors = addPasswordResult.Errors.Select(e => e.Description)
                    });
                }

                // Clear reset token (single-use)
                user.PasswordResetToken = null;
                user.ResetTokenExpiresAt = null;
                user.LastPasswordChangeAt = DateTime.UtcNow;
                user.PasswordExpiresAt = DateTime.UtcNow.AddDays(90);
                user.MustChangePasswordOnLogin = false;
                user.FailedLoginAttempts = 0;
                user.AccessFailedCount = 0;
                user.LockedUntil = null;
                user.LockoutEnd = null;
                
                await _userManager.UpdateAsync(user);

                // Audit log
                await LogAudit(user.Id, user.TenantId, "password_reset_completed", "User", user.Id.ToString(),
                    "SUCCESS", null, Request.HttpContext.Connection.RemoteIpAddress?.ToString());

                _logger.LogInformation("Password reset successful for user {UserId}", user.Id);

                return Ok(new { message = "Password reset successful. You can now login with your new password." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in ResetPassword");
                return StatusCode(500, new { message = "An error occurred processing your request" });
            }
        }

        private async Task LogFailedLogin(string emailOrUsername, Guid tenantId, string reason)
        {
            var attempt = new FailedLoginAttempt
            {
                EmailOrUsername = emailOrUsername,
                TenantId = tenantId,
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
                AttemptedAt = DateTime.UtcNow,
                Reason = reason
            };
            _context.FailedLoginAttempts.Add(attempt);
            await _context.SaveChangesAsync();
        }

        private async Task LogAudit(Guid userId, Guid tenantId, string action, string resourceType, string resourceId, string status, object oldValues, object newValues)
        {
            // Get the user to capture their username
            var user = await _userManager.FindByIdAsync(userId.ToString());
            
            // Get IP address - try multiple sources
            string ipAddress = null;
            
            // First, try X-Forwarded-For header (for proxied requests)
            if (Request.Headers.ContainsKey("X-Forwarded-For"))
            {
                ipAddress = Request.Headers["X-Forwarded-For"].ToString().Split(',').FirstOrDefault()?.Trim();
            }
            
            // Fallback to X-Real-IP header
            if (string.IsNullOrEmpty(ipAddress) && Request.Headers.ContainsKey("X-Real-IP"))
            {
                ipAddress = Request.Headers["X-Real-IP"].ToString();
            }
            
            // Fallback to RemoteIpAddress
            if (string.IsNullOrEmpty(ipAddress))
            {
                ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            }
            
            // If still null, use localhost
            if (string.IsNullOrEmpty(ipAddress))
            {
                ipAddress = "127.0.0.1";
            }
            
            var log = new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = userId,
                UserName = user?.UserName ?? user?.Email, // Capture username for audit trail
                Action = action,
                ResourceType = resourceType,
                ResourceId = Guid.TryParse(resourceId, out var rid) ? rid : Guid.Empty,
                EntityType = resourceType, // Populate EntityType as well
                EntityId = Guid.TryParse(resourceId, out var eid) ? eid : Guid.Empty,
                Status = status ?? "active",
                IpAddress = ipAddress,
                UserAgent = Request.Headers["User-Agent"].ToString(),
                CreatedAt = DateTime.UtcNow,
                Timestamp = DateTime.UtcNow,
                Description = $"{action} on {resourceType}",
                OldValues = oldValues != null ? System.Text.Json.JsonSerializer.Serialize(oldValues) : null,
                NewValues = newValues != null ? System.Text.Json.JsonSerializer.Serialize(newValues) : null
            };
            _context.AuditLogs.Add(log);
            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// Persist refresh token in user_sessions so silent token refresh works after JWT expiry.
        /// Non-fatal — login succeeds even if session persistence fails.
        /// </summary>
        private async Task PersistRefreshTokenSessionAsync(Guid userId, string refreshToken)
        {
            try
            {
                var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
                var ua = Request.Headers.UserAgent.ToString();
                await _sessionService.CreateSessionAsync(
                    userId,
                    deviceId: null,
                    tokenId: Guid.NewGuid().ToString("N"),
                    refreshToken: refreshToken,
                    ipAddress: ip,
                    userAgent: ua,
                    location: "",
                    sessionType: "Web",
                    loginMethod: "password");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not persist refresh token session for user {UserId}", userId);
            }
        }

        /// <summary>
        /// DEBUG: Create default admin user for testing (bypasses tenant requirement)
        /// </summary>
        [AllowAnonymous]
        [HttpPost("debug/create-admin")]
        public async Task<ActionResult> CreateDefaultAdmin([FromQuery] string? tenantId = null)
        {
            try
            {
                // Use default tenant if not provided
                if (string.IsNullOrEmpty(tenantId))
                {
                    tenantId = DevTenantBootstrap.IndiaEyeTenantId.ToString();
                }

                // Check if admin already exists
                var existingAdmin = await _userManager.FindByEmailAsync("admin@hospital.com");
                if (existingAdmin != null)
                {
                    return Ok(new { message = "Admin user already exists", email = "admin@hospital.com", password = "Admin@123456" });
                }

                // Create admin user for each tenant
                var user = new AppUser
                {
                    Id = Guid.NewGuid(),
                    UserName = "admin@hospital.com",
                    Email = "admin@hospital.com",
                    EmailConfirmed = true,
                    FirstName = "System",
                    LastName = "Administrator",
                    TenantId = Guid.Parse(tenantId), 
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var result = await _userManager.CreateAsync(user, "Admin@123456");
                
                if (!result.Succeeded)
                {
                    return BadRequest(new { message = "Failed to create admin user", errors = result.Errors });
                }

                _logger.LogInformation("Created admin user: {Email}", user.Email);

                return Ok(new { 
                    message = "Admin user created successfully", 
                    email = "admin@hospital.com",
                    password = "Admin@123456",
                    tenants = "All tenants (Apollo, Fortis, Max, Narayana, Sankara)"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating admin user");
                return StatusCode(500, new { message = "Error creating admin user", error = ex.Message });
            }
        }

        // ========================
        // OTP & MFA ENDPOINTS
        // ========================

        [HttpPost("login-with-otp")]
        public async Task<IActionResult> LoginWithOtp([FromBody] OtpLoginRequest request)
        {
            var (success, requirePasswordSetup, tempToken, error) = await _notificationClient.VerifyActivationOtpAsync(request.Email, request.Otp);
            if (!success) return Unauthorized(new { success = false, message = "Invalid or expired OTP", error });
            
            var user = await _userManager.Users.FirstOrDefaultAsync(u => u.Email == request.Email || u.PhoneNumber == request.Email);
            if (user == null) return NotFound(new { message = "User not found" });
            
            // If password setup is required and password is provided, set the password
            if (requirePasswordSetup && !string.IsNullOrEmpty(request.NewPassword))
            {
                // Remove existing password if any
                var token = await _userManager.GeneratePasswordResetTokenAsync(user);
                var result = await _userManager.ResetPasswordAsync(user, token, request.NewPassword);
                
                if (!result.Succeeded)
                {
                    return BadRequest(new { success = false, message = "Failed to set password", errors = result.Errors.Select(e => e.Description) });
                }
                
                // Update user status to active after successful password setup
                user.UserStatus = "active";
                user.ActivationStatus = "active";  // Changed from "activated" to "active" to match DB constraint
                user.EmailVerified = true;
                user.LastLoginAt = DateTime.UtcNow;
                user.MustChangePasswordOnLogin = false;
                user.MustResetPassword = false;
                user.PasswordExpiresAt = DateTime.UtcNow.AddDays(90); // 90 days from now
                await _userManager.UpdateAsync(user);
                
                _logger.LogInformation("User {Email} completed activation with password setup", user.Email);
            }
            else if (requirePasswordSetup)
            {
                return Ok(new { success = true, requirePasswordSetup = true, tempToken, userId = user.Id });
            }
            else
            {
                // OTP verification without password setup (already activated users)
                user.UserStatus = "active";
                user.LastLoginAt = DateTime.UtcNow;
                await _userManager.UpdateAsync(user);
            }
            
            var roles = await _userManager.GetRolesAsync(user);
            var permissions = await _permissionService.GetUserPermissionsAsync(user.Id, user.TenantId);
            var otpResolvedBranchId = user.BranchId;
            if (otpResolvedBranchId == null)
            {
                var otpDefaultBranch = await _context.UserBranches
                    .Where(ub => ub.UserId == user.Id && ub.TenantId == user.TenantId && ub.Status == "active")
                    .OrderByDescending(ub => ub.IsDefault)
                    .ThenBy(ub => ub.AssignedAt)
                    .FirstOrDefaultAsync();
                otpResolvedBranchId = otpDefaultBranch?.BranchId;
            }
            var otpAccessToken = _jwtService.GenerateToken(user, roles.ToList(), permissions);
            var otpRefreshToken = _jwtService.GenerateRefreshToken();
            HttpContext.Items["TenantId"] = user.TenantId;
            await PersistRefreshTokenSessionAsync(user.Id, otpRefreshToken);
            return Ok(new LoginResponse { 
                Success = true, 
                AccessToken = otpAccessToken, 
                RefreshToken = otpRefreshToken, 
                ExpiresIn = 3600, 
                User = new UserDto { 
                    Id = user.Id, 
                    Email = user.Email, 
                    FirstName = user.FirstName, 
                    LastName = user.LastName, 
                    UserType = user.UserType, 
                    TenantId = user.TenantId,
                    BranchId = otpResolvedBranchId
                }, 
                Roles = roles.ToList(), 
                Permissions = permissions 
            });
        }

        [HttpPost("mfa/request-code")]
        public async Task<IActionResult> RequestMfaCode([FromBody] MfaCodeRequest request)
        {
            if (!Guid.TryParse(request.TenantId, out var tenantId)) return BadRequest(new { message = "Invalid tenant ID" });
            var user = await _userManager.Users.FirstOrDefaultAsync(u => (u.Email == request.Identifier || u.UserName == request.Identifier) && u.TenantId == tenantId);
            if (user == null || !await _userManager.CheckPasswordAsync(user, request.Password)) return Unauthorized(new { message = "Invalid credentials" });
            
            var mfa = await _context.Set<UserMfa>().FirstOrDefaultAsync(m => m.UserId == user.Id);
            if (mfa == null || !mfa.IsEnabled) return BadRequest(new { message = "MFA not enabled" });
            
            var (success, otpId, error) = await _notificationClient.SendMfaLoginOtpAsync(user.Id, request.Method);
            if (!success) return StatusCode(500, new { message = "Failed to send MFA code", error });
            return Ok(new { success = true, otpId, userId = user.Id });
        }

        [HttpPost("mfa/verify")]
        public async Task<IActionResult> VerifyMfa([FromBody] VerifyMfaRequest request)
        {
            var (success, token, error) = await _notificationClient.VerifyMfaLoginAsync(request.UserId, request.Code, request.Method);
            if (!success) return Unauthorized(new { success = false, message = "Invalid MFA code", error });
            
            var user = await _userManager.FindByIdAsync(request.UserId.ToString());
            if (user == null) return NotFound();
            
            user.LastLoginAt = DateTime.UtcNow; await _userManager.UpdateAsync(user);
            var roles = await _userManager.GetRolesAsync(user);
            var permissions = await _permissionService.GetUserPermissionsAsync(user.Id, user.TenantId);
            var mfaResolvedBranchId = user.BranchId;
            if (mfaResolvedBranchId == null)
            {
                var mfaDefaultBranch = await _context.UserBranches
                    .Where(ub => ub.UserId == user.Id && ub.TenantId == user.TenantId && ub.Status == "active")
                    .OrderByDescending(ub => ub.IsDefault)
                    .ThenBy(ub => ub.AssignedAt)
                    .FirstOrDefaultAsync();
                mfaResolvedBranchId = mfaDefaultBranch?.BranchId;
            }
            var mfaAccessToken = _jwtService.GenerateToken(user, roles.ToList(), permissions);
            var mfaRefreshToken = _jwtService.GenerateRefreshToken();
            HttpContext.Items["TenantId"] = user.TenantId;
            await PersistRefreshTokenSessionAsync(user.Id, mfaRefreshToken);
            return Ok(new LoginResponse { Success = true, AccessToken = mfaAccessToken, RefreshToken = mfaRefreshToken, ExpiresIn = 3600, User = new UserDto { Id = user.Id, Email = user.Email, FirstName = user.FirstName, LastName = user.LastName, TenantId = user.TenantId, BranchId = mfaResolvedBranchId }, Roles = roles.ToList(), Permissions = permissions });
        }
    }

        
    public class OtpLoginRequest 
    { 
        public string Email { get; set; } = ""; 
        public string Otp { get; set; } = ""; 
        public string? NewPassword { get; set; } = "";  // Optional - for activation flow
    }
    
    public class MfaCodeRequest 
    { 
        public string TenantId { get; set; } = ""; 
        public string Identifier { get; set; } = ""; 
        public string Password { get; set; } = ""; 
        public string Method { get; set; } = "sms"; 
    }
    
    public class VerifyMfaRequest 
    { 
        public Guid UserId { get; set; }
        public string Code { get; set; } = ""; 
        public string Method { get; set; } = "totp"; 
    }
    
    public class ChangePasswordRequest 
    { 
        public string CurrentPassword { get; set; } = ""; 
        public string NewPassword { get; set; } = ""; 
        public string ConfirmPassword { get; set; } = ""; 
    }

    public class ForgotPasswordRequest
    {
        public string Email { get; set; } = "";
        public Guid TenantId { get; set; }
    }

    public class ResetPasswordRequest
    {
        public string Token { get; set; } = "";
        public string NewPassword { get; set; } = "";
        public string ConfirmPassword { get; set; } = "";
    }

    public class ValidateResetTokenRequest
    {
        public string Token { get; set; } = "";
    }

    public class RefreshTokenRequest
    {
        public string RefreshToken { get; set; } = "";
    }
}
