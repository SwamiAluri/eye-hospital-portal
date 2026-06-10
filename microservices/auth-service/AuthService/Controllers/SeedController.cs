using AuthService.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using AuthService.Models.Identity;
using AuthService.Context;
using AuthService.Models.Domain;
using AuthService.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SeedController : ControllerBase
    {
        private readonly UserManager<AppUser> _userManager;
        private readonly RoleManager<AppRole> _roleManager;
        private readonly AppDbContext _context;
        private readonly IOptometryQueueService _optometryQueueService;

        public SeedController(
            UserManager<AppUser> userManager,
            RoleManager<AppRole> roleManager,
            AppDbContext context,
            IOptometryQueueService optometryQueueService)
        {
            _userManager = userManager;
            _roleManager = roleManager;
            _context = context;
            _optometryQueueService = optometryQueueService;
        }

        [HttpPost("create-admin")]
        [RequirePermission("system.admin")]
        public async Task<IActionResult> CreateAdmin()
        {
            try
            {
                // Get existing tenant - use existing INDIA_EYE_NET tenant
                var tenantData = _context.Tenants
                    .Select(t => new { t.Id, t.Name, t.TenantCode, t.Status })
                    .FirstOrDefault();
                    
                if (tenantData == null)
                {
                    return BadRequest(new { message = "No tenant found in database. Please ensure tenants exist first." });
                }
                
                var tenantId = tenantData.Id;

                // Create Admin role if not exists
                if (!await _roleManager.RoleExistsAsync("Admin"))
                {
                    var adminRole = new AppRole
                    {
                        Name = "Admin",
                        NormalizedName = "ADMIN",
                        RoleLevel = 1,
                        TenantId = tenantId,
                        IsActive = true,
                        Description = "System Administrator"
                    };
                    await _roleManager.CreateAsync(adminRole);
                }

                // Create admin user if not exists
                var existingUser = await _userManager.FindByEmailAsync("admin@hospital.com");
                if (existingUser == null)
                {
                    var adminUser = new AppUser
                    {
                        UserName = "admin@hospital.com",
                        Email = "admin@hospital.com",
                        FirstName = "Admin",
                        LastName = "User",
                        EmailConfirmed = true,
                        TenantId = tenantId
                        // Note: Removed properties that are ignored in EF Core configuration
                    };

                    var result = await _userManager.CreateAsync(adminUser, "Admin123");
                    if (result.Succeeded)
                    {
                        await _userManager.AddToRoleAsync(adminUser, "Admin");
                        return Ok(new { 
                            message = "Admin user created successfully!", 
                            email = "admin@hospital.com", 
                            password = "Admin123",
                            loginUrl = "http://localhost:3000"
                        });
                    }
                    else
                    {
                        return BadRequest(new { message = "Failed to create admin user", errors = result.Errors });
                    }
                }
                else
                {
                    return Ok(new { 
                        message = "Admin user already exists!", 
                        email = "admin@hospital.com", 
                        password = "Admin123",
                        loginUrl = "http://localhost:3000"
                    });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred", error = ex.Message });
            }
        }

        [HttpPost("execute-rbac-script")]
        // [RequirePermission("system.admin")] // Temporarily disabled for testing
        public async Task<IActionResult> ExecuteRbacScript()
        {
            try
            {
                // Path to the RBAC/ABAC implementation script
                var scriptPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", "..", "complete_rbac_abac_implementation.sql");
                scriptPath = Path.GetFullPath(scriptPath);

                if (!System.IO.File.Exists(scriptPath))
                {
                    return NotFound(new { message = "RBAC script file not found", path = scriptPath });
                }

                // Read the SQL script
                var sqlScript = await System.IO.File.ReadAllTextAsync(scriptPath);

                // Execute the entire script at once
                await _context.Database.ExecuteSqlRawAsync(sqlScript);

                return Ok(new { 
                    message = "RBAC script executed successfully",
                    scriptPath = scriptPath
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred executing RBAC script", error = ex.Message });
            }
        }

        [HttpPost("departments")]
        public async Task<IActionResult> SeedDepartments([FromQuery] string tenantId = "11111111-1111-1111-1111-111111111111")
        {
            try
            {
                var tid = Guid.Parse(tenantId);
                
                var sql = $@"
DO $$
DECLARE
    v_tenant_id UUID := '{tid}';
BEGIN
    INSERT INTO department (id, tenant_id, department_code, department_name, department_type, description, status, is_24x7, requires_approval, created_at, updated_at)
    SELECT gen_random_uuid(), v_tenant_id, 'OPD', 'Outpatient Department', 'Clinical', 'Main OPD', 'Active', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_code = 'OPD' AND tenant_id = v_tenant_id);
    
    INSERT INTO department (id, tenant_id, department_code, department_name, department_type, description, status, is_24x7, requires_approval, created_at, updated_at)
    SELECT gen_random_uuid(), v_tenant_id, 'RETINA', 'Retina & Vitreous', 'Clinical', 'Retinal diseases', 'Active', false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_code = 'RETINA' AND tenant_id = v_tenant_id);

    INSERT INTO department (id, tenant_id, department_code, department_name, department_type, description, status, is_24x7, requires_approval, created_at, updated_at)
    SELECT gen_random_uuid(), v_tenant_id, 'GLAUCOMA', 'Glaucoma', 'Clinical', 'Glaucoma care', 'Active', false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_code = 'GLAUCOMA' AND tenant_id = v_tenant_id);

    INSERT INTO department (id, tenant_id, department_code, department_name, department_type, description, status, is_24x7, requires_approval, created_at, updated_at)
    SELECT gen_random_uuid(), v_tenant_id, 'CATARACT', 'Cataract & Anterior Segment', 'Clinical', 'Cataract surgery', 'Active', false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_code = 'CATARACT' AND tenant_id = v_tenant_id);

    INSERT INTO department (id, tenant_id, department_code, department_name, department_type, description, status, is_24x7, requires_approval, created_at, updated_at)
    SELECT gen_random_uuid(), v_tenant_id, 'CORNEA', 'Cornea & External Diseases', 'Clinical', 'Corneal diseases', 'Active', false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_code = 'CORNEA' AND tenant_id = v_tenant_id);

    INSERT INTO department (id, tenant_id, department_code, department_name, department_type, description, status, is_24x7, requires_approval, created_at, updated_at)
    SELECT gen_random_uuid(), v_tenant_id, 'PEDIATRIC', 'Pediatric Ophthalmology', 'Clinical', 'Pediatric eye care', 'Active', false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_code = 'PEDIATRIC' AND tenant_id = v_tenant_id);

    INSERT INTO department (id, tenant_id, department_code, department_name, department_type, description, status, is_24x7, requires_approval, created_at, updated_at)
    SELECT gen_random_uuid(), v_tenant_id, 'OPTOMETRY', 'Optometry', 'Clinical', 'Refraction services', 'Active', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_code = 'OPTOMETRY' AND tenant_id = v_tenant_id);

    INSERT INTO department (id, tenant_id, department_code, department_name, department_type, description, status, is_24x7, requires_approval, created_at, updated_at)
    SELECT gen_random_uuid(), v_tenant_id, 'EMERGENCY', 'Emergency & Trauma', 'Clinical', '24/7 emergency care', 'Active', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_code = 'EMERGENCY' AND tenant_id = v_tenant_id);

    INSERT INTO department (id, tenant_id, department_code, department_name, department_type, description, status, is_24x7, requires_approval, created_at, updated_at)
    SELECT gen_random_uuid(), v_tenant_id, 'OCT', 'OCT Imaging', 'Diagnostic', 'OCT scans', 'Active', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_code = 'OCT' AND tenant_id = v_tenant_id);

    INSERT INTO department (id, tenant_id, department_code, department_name, department_type, description, status, is_24x7, requires_approval, created_at, updated_at)
    SELECT gen_random_uuid(), v_tenant_id, 'VISUAL_FIELD', 'Visual Field Analysis', 'Diagnostic', 'Perimetry', 'Active', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_code = 'VISUAL_FIELD' AND tenant_id = v_tenant_id);

    INSERT INTO department (id, tenant_id, department_code, department_name, department_type, description, status, is_24x7, requires_approval, created_at, updated_at)
    SELECT gen_random_uuid(), v_tenant_id, 'PHARMACY', 'In-House Pharmacy', 'Support', 'Hospital pharmacy', 'Active', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_code = 'PHARMACY' AND tenant_id = v_tenant_id);

    INSERT INTO department (id, tenant_id, department_code, department_name, department_type, description, status, is_24x7, requires_approval, created_at, updated_at)
    SELECT gen_random_uuid(), v_tenant_id, 'PATHOLOGY', 'Pathology Laboratory', 'Diagnostic', 'Lab tests', 'Active', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_code = 'PATHOLOGY' AND tenant_id = v_tenant_id);

    INSERT INTO department (id, tenant_id, department_code, department_name, department_type, description, status, is_24x7, requires_approval, created_at, updated_at)
    SELECT gen_random_uuid(), v_tenant_id, 'OT', 'Operation Theatre', 'Clinical', 'Surgery', 'Active', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_code = 'OT' AND tenant_id = v_tenant_id);

    INSERT INTO department (id, tenant_id, department_code, department_name, department_type, description, status, is_24x7, requires_approval, created_at, updated_at)
    SELECT gen_random_uuid(), v_tenant_id, 'BILLING', 'Billing & Accounts', 'Administrative', 'Patient billing', 'Active', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_code = 'BILLING' AND tenant_id = v_tenant_id);

    INSERT INTO department (id, tenant_id, department_code, department_name, department_type, description, status, is_24x7, requires_approval, created_at, updated_at)
    SELECT gen_random_uuid(), v_tenant_id, 'FRONT_DESK', 'Front Desk', 'Administrative', 'Reception', 'Active', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM department WHERE department_code = 'FRONT_DESK' AND tenant_id = v_tenant_id);
END $$;
";

                await _context.Database.ExecuteSqlRawAsync(sql);
                
                var count = await _context.Departments
                    .Where(d => d.TenantId == tid && d.DeletedAt == null)
                    .CountAsync();
                    
                return Ok(new { 
                    success = true, 
                    message = $"Successfully seeded {count} departments for tenant {tid}"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { 
                    success = false, 
                    message = $"Error seeding departments: {ex.Message}",
                    details = ex.InnerException?.Message
                });
            }
        }

        [HttpPost("counselor-queue")]
        public async Task<IActionResult> SeedCounselorQueue()
        {
            try
            {
                // Get tenant ID from HTTP context (set by middleware from X-Tenant-ID header)
                var tenantIdClaim = User.FindFirst("TenantId");
                if (tenantIdClaim == null || !Guid.TryParse(tenantIdClaim.Value, out var tenantId))
                {
                    // Fallback: try to get from X-Tenant-ID header directly
                    if (Request.Headers.TryGetValue("X-Tenant-ID", out var tenantIdHeader) && Guid.TryParse(tenantIdHeader.FirstOrDefault(), out tenantId))
                    {
                        // Successfully got tenant ID from header
                    }
                    else  
                    {
                        // If no tenant in context or header, get first active tenant
                        var firstTenant = await _context.Tenants
                            .Where(t => t.Status == "Active")
                            .FirstOrDefaultAsync();
                        
                        if (firstTenant == null)
                            return BadRequest(new { message = "No active tenant found" });
                        
                        tenantId = firstTenant.Id;
                    }
                }

                // Get tenant details
                var tenant = await _context.Tenants.FindAsync(tenantId);
                if (tenant == null)
                    return BadRequest(new { message = $"Tenant {tenantId} not found" });

                var branch = await _context.Branches
                    .Where(b => b.TenantId == tenant.Id && b.DeletedAt == null)
                    .FirstOrDefaultAsync();

                if (branch == null)
                    return BadRequest(new { message = "No branch found for tenant" });

                // Get or create test patients
                var patients = new List<Patient>();
                var patientData = new[]
                {
                    new { FirstName = "Ramesh", LastName = "Kumar", Age = 65, Gender = "Male", MRN = "MRN001234" },
                    new { FirstName = "Priya", LastName = "Sharma", Age = 42, Gender = "Female", MRN = "MRN001235" },
                    new { FirstName = "Ahmed", LastName = "Khan", Age = 58, Gender = "Male", MRN = "MRN001236" }
                };

                foreach (var pd in patientData)
                {
                    var existing = await _context.Patients
                        .Where(p => p.MedicalRecordNumber == pd.MRN && p.TenantId == tenant.Id)
                        .FirstOrDefaultAsync();

                    if (existing == null)
                    {
                        existing = new Patient
                        {
                            Id = Guid.NewGuid(),
                            TenantId = tenant.Id,
                            BranchId = branch.Id,
                            FirstName = pd.FirstName,
                            LastName = pd.LastName,
                            DateOfBirth = DateTime.UtcNow.AddYears(-pd.Age),
                            Gender = pd.Gender,
                            ContactNumber = $"+91-98765432{10 + patients.Count}",
                            MedicalRecordNumber = pd.MRN,
                            BloodGroup = "O+",
                            InsuranceStatus = "Insured",
                            Status = "active",
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow,
                            CreatedByUserId = null,
                            UpdatedByUserId = null
                        };
                        _context.Patients.Add(existing);
                        await _context.SaveChangesAsync();
                    }
                    patients.Add(existing);
                }

                // Clear old sessions for these test patients to avoid conflicts
                var oldSessions = await _context.CounselingSession
                    .Where(s => s.TenantId == tenant.Id && patients.Select(p => p.Id).Contains(s.PatientId))
                    .ToListAsync();
                
                if (oldSessions.Any())
                {
                    // First delete queue items referencing these sessions (due to FK constraint)
                    var oldQueueItems = await _context.CounselorQueue
                        .Where(q => oldSessions.Select(s => s.Id).Contains(q.SessionId))
                        .ToListAsync();
                    _context.CounselorQueue.RemoveRange(oldQueueItems);
                    
                    // Then delete the sessions
                    _context.CounselingSession.RemoveRange(oldSessions);
                    await _context.SaveChangesAsync();
                }

                // Get a doctor for referring (required for counseling sessions)
                // Query directly from users table using raw SQL
                var connection = _context.Database.GetDbConnection();
                await connection.OpenAsync();
                using var command = connection.CreateCommand();
                command.CommandText = $"SELECT id FROM users WHERE tenant_id = '{tenant.Id}' LIMIT 1";
                var result = await command.ExecuteScalarAsync();
                await connection.CloseAsync();

                if (result == null || result == DBNull.Value)
                {
                    return BadRequest(new { message = "No users found in tenant" });
                }

                var doctor = Guid.Parse(result.ToString()!);

                // Per-patient surgery data: surgery name, eye laterality, category
                var surgeryData = new[]
                {
                    // Ramesh Kumar — Cataract Surgery (Right Eye)
                    new { Surgery = "Cataract Surgery (Phacoemulsification)", Eye = "RE", Category = "Surgery" },
                    // Priya Sharma   — LASIK (Both Eyes — bilateral refractive)
                    new { Surgery = "LASIK",                                   Eye = "BE", Category = "Surgery" },
                    // Ahmed Khan     — Cataract Surgery (Right Eye)
                    new { Surgery = "Cataract Surgery (Phacoemulsification)", Eye = "RE", Category = "Surgery" },
                };

                // Create counseling sessions for each patient
                var sessions = new List<CounselingSession>();
                for (var i = 0; i < patients.Count; i++)
                {
                    var sd = surgeryData[i];
                    var session = new CounselingSession
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenant.Id,
                        BranchId = branch.Id,
                        PatientId = patients[i].Id,
                        ReferredByDoctorId = doctor,
                        SessionNumber = $"CS-{DateTime.UtcNow:yyyyMMdd}-{sessions.Count + 1:D3}",
                        SessionType = "Initial",
                        SessionDate = DateTime.UtcNow,
                        PatientType = "Cash",
                        Status = "Scheduled",
                        CurrentStage = "Initial",
                        PackageDiscussed = false,
                        PendingDecision = true,
                        RecommendedSurgery   = sd.Surgery,
                        SurgeryTentativeEye  = sd.Eye,
                        SessionCategory      = sd.Category,
                        CreatedAt = DateTime.UtcNow
                    };
                    sessions.Add(session);
                    _context.CounselingSession.Add(session);
                }
                await _context.SaveChangesAsync();

                // Verify sessions were created
                if (sessions.Count != 3 || sessions.Any(s => s.Id == Guid.Empty))
                {
                    return StatusCode(500, new { message = "Failed to create counseling sessions" });
                }

                // Create queue items
                var queueItems = new[]
                {
                    new CounselorQueueItem
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenant.Id,
                        BranchId = branch.Id,
                        SessionId = sessions[0].Id,
                        PatientId = patients[0].Id,
                        TokenNumber = "T-001",
                        QueueType = "Counseling",
                        QueuePosition = 1,
                        PriorityScore = 85,
                        UrgencyLevel = "High",
                        AddedToQueueAt = DateTime.UtcNow.AddMinutes(-25),
                        EstimatedWaitMinutes = 25,
                        Status = "Waiting",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    },
                    new CounselorQueueItem
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenant.Id,
                        BranchId = branch.Id,
                        SessionId = sessions[1].Id,
                        PatientId = patients[1].Id,
                        TokenNumber = "T-002",
                        QueueType = "Counseling",
                        QueuePosition = 2,
                        PriorityScore = 55,
                        UrgencyLevel = "Normal",
                        AddedToQueueAt = DateTime.UtcNow.AddMinutes(-18),
                        EstimatedWaitMinutes = 18,
                        Status = "Waiting",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    },
                    new CounselorQueueItem
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenant.Id,
                        BranchId = branch.Id,
                        SessionId = sessions[2].Id,
                        PatientId = patients[2].Id,
                        TokenNumber = "T-003",
                        QueueType = "Counseling",
                        QueuePosition = 3,
                        PriorityScore = 30,
                        UrgencyLevel = "Low",
                        AddedToQueueAt = DateTime.UtcNow.AddMinutes(-10),
                        EstimatedWaitMinutes = 10,
                        Status = "Waiting",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    }
                };

                _context.CounselorQueue.AddRange(queueItems);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = $"Successfully seeded {queueItems.Length} counselor queue items",
                    tenantId = tenant.Id,
                    tenantName = tenant.Name,
                    branchId = branch.Id,
                    branchName = branch.Name,
                    queueItemsCreated = queueItems.Length,
                    patients = patients.Select((p, index) => new { 
                        p.Id, 
                        p.FirstName,
                        p.LastName,
                        p.MedicalRecordNumber, 
                        p.DateOfBirth,
                        TokenNumber = queueItems[index].TokenNumber,
                        UrgencyLevel = queueItems[index].UrgencyLevel,
                        Status = queueItems[index].Status
                    }).ToList()
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = $"Error seeding counselor queue: {ex.Message}",
                    details = ex.InnerException?.Message,
                    stackTrace = ex.StackTrace
                });
            }
        }

        /// <summary>
        /// Seed demo patients in the optometry queue (development/demo).
        /// Pass ?reset=true to clear today's optometry visits for the branch first.
        /// </summary>
        [HttpPost("optometry-queue")]
        public async Task<IActionResult> SeedOptometryQueue([FromQuery] bool reset = false)
        {
            try
            {
                var adminUser = await _context.Users
                    .FirstOrDefaultAsync(u => u.Email == "admin@test.com");
                if (adminUser == null)
                {
                    return BadRequest(new { message = "admin@test.com user not found" });
                }

                var tenant = await _context.Tenants.FindAsync(adminUser.TenantId);
                if (tenant == null)
                {
                    return BadRequest(new { message = "No tenant found" });
                }

                var branch = await _context.Branches
                    .Where(b => b.TenantId == tenant.Id && b.DeletedAt == null)
                    .OrderByDescending(b => b.Name == "Downtown Hospital")
                    .ThenBy(b => b.Name)
                    .FirstOrDefaultAsync();
                if (branch == null)
                {
                    return BadRequest(new { message = "No branch found" });
                }

                var today = DateTime.UtcNow.Date;
                var adminUserId = adminUser.Id;
                var doctorId = adminUserId;

                if (reset)
                {
                    var toRemove = await _context.Visits
                        .Where(v =>
                            v.BranchId == branch.Id &&
                            v.CurrentStation == "optometrist" &&
                            v.CheckedInAt.HasValue &&
                            v.CheckedInAt.Value.Date == today)
                        .ToListAsync();
                    if (toRemove.Count > 0)
                    {
                        _context.Visits.RemoveRange(toRemove);
                        await _context.SaveChangesAsync();
                    }
                }

                var patientList = await _context.Patients
                    .Where(p => p.TenantId == tenant.Id && p.DeletedAt == null)
                    .OrderBy(p => p.CreatedAt)
                    .Take(8)
                    .ToListAsync();

                var demoIndex = patientList.Count;
                while (patientList.Count < 8)
                {
                    demoIndex++;
                    var demoPatient = new Patient
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenant.Id,
                        BranchId = branch.Id,
                        MedicalRecordNumber = $"OPTO-DEMO-{demoIndex:D2}",
                        FirstName = "Demo",
                        LastName = $"Opto {demoIndex}",
                        DateOfBirth = DateTime.UtcNow.AddYears(-35 - demoIndex),
                        Gender = demoIndex % 2 == 0 ? "Female" : "Male",
                        Status = "Active",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                    };
                    _context.Patients.Add(demoPatient);
                    patientList.Add(demoPatient);
                }
                await _context.SaveChangesAsync();

                var scenarios = new[]
                {
                    new { Complaint = "Blurred vision, difficulty reading", Priority = "normal", Emergency = false, Reason = "INITIAL_REFRACTION", State = "InProgress" },
                    new { Complaint = "Sudden vision loss in left eye, floaters", Priority = "urgent", Emergency = true, Reason = "INITIAL_REFRACTION", State = "Waiting" },
                    new { Complaint = "Eye pain, headache, halos around lights", Priority = "urgent", Emergency = false, Reason = "INITIAL_REFRACTION", State = "Waiting" },
                    new { Complaint = "Routine eye check-up", Priority = "normal", Emergency = false, Reason = "INITIAL_REFRACTION", State = "Waiting" },
                    new { Complaint = "Annual diabetic eye screening", Priority = "normal", Emergency = false, Reason = "INITIAL_REFRACTION", State = "Waiting" },
                    new { Complaint = "Post-op follow-up refraction", Priority = "normal", Emergency = false, Reason = "INITIAL_REFRACTION", State = "Completed" },
                    new { Complaint = "Cataract evaluation — referred to doctor", Priority = "normal", Emergency = false, Reason = "INITIAL_REFRACTION", State = "Referred" },
                    new { Complaint = "Repeat refraction after OCT", Priority = "normal", Emergency = false, Reason = "POST_INVESTIGATION", State = "ReturnWaiting" },
                };

                var created = new List<string>();
                var seq = await _context.Visits
                    .Where(v => v.BranchId == branch.Id && v.CheckedInAt.HasValue && v.CheckedInAt.Value.Date == today)
                    .CountAsync();

                var branchPrefix = !string.IsNullOrEmpty(branch.BranchCode)
                    ? branch.BranchCode.ToUpper()[..Math.Min(3, branch.BranchCode.Length)]
                    : "GEN";

                for (var i = 0; i < Math.Min(patientList.Count, scenarios.Length); i++)
                {
                    var patient = patientList[i];
                    var demo = scenarios[i];

                    var existingVisit = await _context.Visits
                        .FirstOrDefaultAsync(v =>
                            v.PatientId == patient.Id &&
                            v.BranchId == branch.Id &&
                            v.DeletedAt == null &&
                            v.CurrentStation == "optometrist" &&
                            v.CheckedInAt.HasValue &&
                            v.CheckedInAt.Value.Date == today);

                    if (existingVisit != null)
                    {
                        created.Add($"Skipped (exists): {patient.FirstName} {patient.LastName} [{demo.State}]");
                        continue;
                    }

                    seq++;
                    var appointment = await EnsureDemoAppointmentAsync(tenant.Id, patient.Id, doctorId, today, i, demo.Priority, demo.Complaint);
                    var token = $"{branchPrefix}-{today:yyyyMMdd}-{seq:D3}";

                    var visit = new Visit
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenant.Id,
                        PatientId = patient.Id,
                        AppointmentId = appointment.Id,
                        BranchId = branch.Id,
                        DepartmentId = appointment.DepartmentId,
                        VisitType = demo.Reason == "POST_INVESTIGATION" ? "follow_up" : "new",
                        VisitCategory = "paid",
                        Status = "with_optometrist",
                        TokenNumber = token,
                        TokenSequence = seq,
                        CheckedInAt = DateTime.UtcNow.AddMinutes(-20 + i * 2),
                        CurrentStation = "optometrist",
                        IsEmergency = demo.Emergency,
                        Notes = demo.Complaint,
                        OptometryPassCount = demo.State == "ReturnWaiting" ? 2 : 1,
                        CreatedAt = DateTime.UtcNow,
                        CreatedByUserId = adminUserId,
                    };

                    _context.Visits.Add(visit);
                    await _context.SaveChangesAsync();

                    switch (demo.State)
                    {
                        case "ReturnWaiting":
                            await _optometryQueueService.RecordStationEventAsync(
                                tenant.Id, branch.Id, visit.Id, patient.Id, "optometrist", "queued", adminUserId,
                                reasonCode: "INITIAL_REFRACTION", reasonNotes: "First pass completed earlier");
                            await _optometryQueueService.RecordStationEventAsync(
                                tenant.Id, branch.Id, visit.Id, patient.Id, "optometrist", "started", adminUserId,
                                roomCode: "OPT-2", assignedToUserId: adminUserId);
                            await _optometryQueueService.RecordStationEventAsync(
                                tenant.Id, branch.Id, visit.Id, patient.Id, "optometrist", "completed", adminUserId);
                            await _optometryQueueService.RecordStationEventAsync(
                                tenant.Id, branch.Id, visit.Id, patient.Id, "optometrist", "queued", adminUserId,
                                reasonCode: demo.Reason, reasonNotes: demo.Complaint);
                            break;

                        default:
                            await _optometryQueueService.RecordStationEventAsync(
                                tenant.Id, branch.Id, visit.Id, patient.Id, "optometrist", "queued", adminUserId,
                                reasonCode: demo.Reason, reasonNotes: demo.Complaint);
                            break;
                    }

                    if (demo.State == "InProgress")
                    {
                        visit.AssignedTo = adminUserId;
                        visit.AssignedAt = DateTime.UtcNow;
                        visit.ActiveRoomCode = "OPT-1";
                        await _context.SaveChangesAsync();
                        await _optometryQueueService.RecordStationEventAsync(
                            tenant.Id, branch.Id, visit.Id, patient.Id, "optometrist", "started", adminUserId,
                            roomCode: "OPT-1", assignedToUserId: adminUserId);

                        var draftData = """{"visualAcuityData":{"distanceOD":"6/9","distanceOS":"6/12"},"tonometryData":{"iopOD":16,"iopOS":18}}""";
                        _context.ExaminationDrafts.Add(new ExaminationDraft
                        {
                            Id = Guid.NewGuid(),
                            PatientId = patient.Id,
                            DoctorId = adminUserId,
                            TenantId = tenant.Id,
                            VisitId = visit.Id,
                            Timestamp = DateTime.UtcNow,
                            ExpiresAt = DateTime.UtcNow.AddHours(24),
                            Data = draftData,
                            CompletionPercentage = 40,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow,
                        });
                        await _context.SaveChangesAsync();
                    }
                    else if (demo.State == "Completed")
                    {
                        await _optometryQueueService.RecordStationEventAsync(
                            tenant.Id, branch.Id, visit.Id, patient.Id, "optometrist", "started", adminUserId,
                            roomCode: "OPT-2", assignedToUserId: adminUserId);
                        visit.AssignedTo = null;
                        visit.AssignedAt = null;
                        visit.ActiveRoomCode = null;
                        await _context.SaveChangesAsync();
                        await _optometryQueueService.RecordStationEventAsync(
                            tenant.Id, branch.Id, visit.Id, patient.Id, "optometrist", "completed", adminUserId);
                    }
                    else if (demo.State == "Referred")
                    {
                        await _optometryQueueService.RecordStationEventAsync(
                            tenant.Id, branch.Id, visit.Id, patient.Id, "optometrist", "started", adminUserId,
                            roomCode: "OPT-1", assignedToUserId: adminUserId);
                        visit.AssignedTo = null;
                        visit.AssignedAt = null;
                        visit.ActiveRoomCode = null;
                        await _context.SaveChangesAsync();
                        await _optometryQueueService.RecordStationEventAsync(
                            tenant.Id, branch.Id, visit.Id, patient.Id, "optometrist", "referred", adminUserId,
                            reasonNotes: "Referred for cataract evaluation");
                    }

                    created.Add($"{token}: {patient.FirstName} {patient.LastName} [{demo.State}]");
                }

                return Ok(new
                {
                    success = true,
                    message = $"Seeded {created.Count} optometry queue entries",
                    branchId = branch.Id,
                    reset,
                    entries = created,
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = ex.Message,
                    details = ex.InnerException?.Message,
                    hint = "Run migrations/56 and 57 if schema is missing",
                });
            }
        }

        private async Task<Appointment> EnsureDemoAppointmentAsync(
            Guid tenantId,
            Guid patientId,
            Guid doctorId,
            DateTime today,
            int slotIndex,
            string priority,
            string complaint)
        {
            var appointment = await _context.Appointments
                .Where(a => a.PatientId == patientId && a.DeletedAt == null && a.AppointmentDate.Date == today)
                .FirstOrDefaultAsync();

            if (appointment != null)
            {
                appointment.Priority = priority;
                appointment.ReasonForVisit = complaint;
                appointment.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return appointment;
            }

            appointment = new Appointment
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                PatientId = patientId,
                DoctorId = doctorId,
                AppointmentDate = today,
                StartTime = new TimeSpan(9 + slotIndex, 0, 0),
                AppointmentType = "consultation",
                DurationMinutes = 15,
                Priority = priority,
                Status = "checked_in",
                ReasonForVisit = complaint,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };
            _context.Appointments.Add(appointment);
            await _context.SaveChangesAsync();
            return appointment;
        }
    }
}