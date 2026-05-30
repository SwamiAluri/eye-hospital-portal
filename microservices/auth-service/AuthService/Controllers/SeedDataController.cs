using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AuthService.Context;
using AuthService.Models;
using AuthService.Models.Domain;

namespace AuthService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SeedDataController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ILogger<SeedDataController> _logger;

        public SeedDataController(AppDbContext context, ILogger<SeedDataController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Seed sample counselor queue data for testing
        /// </summary>
        [HttpPost("counselor-queue")]
        [AllowAnonymous] // Temporary for seeding only - remove in production
        public async Task<IActionResult> SeedCounselorQueueData()
        {
            try
            {
                _logger.LogInformation("Starting counselor queue data seed...");

                // Get first active tenant
                var tenant = await _context.Tenants
                    .Where(t => t.Status == "Active")
                    .FirstOrDefaultAsync();

                if (tenant == null)
                {
                    return BadRequest(new { message = "No active tenant found. Please create a tenant first." });
                }

                var tenantId = tenant.Id;
                _logger.LogInformation("Using Tenant ID: {TenantId}", tenantId);

                // Get first branch
                var branch = await _context.Branches
                    .Where(b => b.TenantId == tenantId && b.DeletedAt == null)
                    .FirstOrDefaultAsync();

                if (branch == null)
                {
                    return BadRequest(new { message = "No branch found. Please create a branch first." });
                }

                var branchId = branch.Id;
                _logger.LogInformation("Using Branch ID: {BranchId}", branchId);

                // Get a user
                var user = await _context.Users
                    .Where(u => u.TenantId == tenantId && u.DeletedAt == null)
                    .FirstOrDefaultAsync();

                if (user == null)
                {
                    return BadRequest(new { message = "No user found. Please create users first." });
                }

                var userId = user.Id;
                _logger.LogInformation("Using User ID: {UserId}", userId);

                var createdPatients = new List<string>();
                var createdSessions = new List<string>();
                var createdQueueItems = new List<string>();

                // Generate unique session number suffix
                var randomSuffix = new Random().Next(1000, 9999);
                var sessionPrefix = $"CS-{DateTime.UtcNow:yyyyMMdd}-{randomSuffix}";

                // Create Patient 1: John Doe
                var patient1 = new Patient
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = branchId,
                    FirstName = "John",
                    LastName = "Doe",
                    DateOfBirth = new DateTime(1985, 3, 15),
                    Gender = "Male",
                    ContactNumber = "+1-555-0101",
                    Email = "john.doe@example.com",
                    MedicalRecordNumber = "MRN" + new Random().Next(100000, 999999),
                    BloodGroup = "O+",
                    AddressLine1 = "123 Main Street",
                    PinCode = "10001",
                    Country = "USA",
                    Status = "Active",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    CreatedByUserId = userId,
                    UpdatedByUserId = userId
                };
                _context.Patients.Add(patient1);
                createdPatients.Add($"John Doe (MRN: {patient1.MedicalRecordNumber})");

                // Create Patient 2: Jane Smith
                var patient2 = new Patient
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = branchId,
                    FirstName = "Jane",
                    LastName = "Smith",
                    DateOfBirth = new DateTime(1990, 7, 22),
                    Gender = "Female",
                    ContactNumber = "+1-555-0102",
                    Email = "jane.smith@example.com",
                    MedicalRecordNumber = "MRN" + new Random().Next(100000, 999999),
                    BloodGroup = "A+",
                    AddressLine1 = "456 Oak Avenue",
                    PinCode = "90001",
                    Country = "USA",
                    Status = "Active",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    CreatedByUserId = userId,
                    UpdatedByUserId = userId
                };
                _context.Patients.Add(patient2);
                createdPatients.Add($"Jane Smith (MRN: {patient2.MedicalRecordNumber})");

                // Create Patient 3: Michael Johnson
                var patient3 = new Patient
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = branchId,
                    FirstName = "Michael",
                    LastName = "Johnson",
                    DateOfBirth = new DateTime(1978, 11, 30),
                    Gender = "Male",
                    ContactNumber = "+1-555-0103",
                    Email = "michael.j@example.com",
                    MedicalRecordNumber = "MRN" + new Random().Next(100000, 999999),
                    BloodGroup = "B+",
                    AddressLine1 = "789 Pine Road",
                    PinCode = "60601",
                    Country = "USA",
                    Status = "Active",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    CreatedByUserId = userId,
                    UpdatedByUserId = userId
                };
                _context.Patients.Add(patient3);
                createdPatients.Add($"Michael Johnson (MRN: {patient3.MedicalRecordNumber})");

                await _context.SaveChangesAsync();
                _logger.LogInformation("Created 3 patients");

                // Create Counseling Sessions
                var session1 = new CounselingSession
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = branchId,
                    PatientId = patient1.Id,
                    CounselorId = userId,
                    ReferredByDoctorId = userId, // Using same user for simplicity
                    SessionNumber = $"{sessionPrefix}-001",
                    SessionType = "Initial",
                    SessionDate = DateTime.UtcNow,
                    PatientType = "Cash",
                    RecommendedSurgery = "Cataract Surgery",
                    Status = "Scheduled",
                    Urgency = "Routine",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    CreatedByUserId = userId,
                    UpdatedByUserId = userId
                };
                _context.CounselingSession.Add(session1);
                createdSessions.Add($"CS-001: Financial counseling");

                var session2 = new CounselingSession
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = branchId,
                    PatientId = patient2.Id,
                    CounselorId = userId,
                    ReferredByDoctorId = userId,
                    SessionNumber = $"{sessionPrefix}-002",
                    SessionType = "Initial",
                    SessionDate = DateTime.UtcNow,
                    PatientType = "Insurance",
                    RecommendedSurgery = "LASIK",
                    Status = "Scheduled",
                    Urgency = "Urgent",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    CreatedByUserId = userId,
                    UpdatedByUserId = userId
                };
                _context.CounselingSession.Add(session2);
                createdSessions.Add($"CS-002: Pre-surgery counseling");

                var session3 = new CounselingSession
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = branchId,
                    PatientId = patient3.Id,
                    CounselorId = userId,
                    ReferredByDoctorId = userId,
                    SessionNumber = $"{sessionPrefix}-003",
                    SessionType = "Initial",
                    SessionDate = DateTime.UtcNow,
                    PatientType = "Insurance",
                    Status = "Scheduled",
                    Urgency = "Routine",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    CreatedByUserId = userId,
                    UpdatedByUserId = userId
                };
                _context.CounselingSession.Add(session3);
                createdSessions.Add($"CS-003: Insurance verification");

                await _context.SaveChangesAsync();
                _logger.LogInformation("Created 3 counseling sessions");

                // Add to Counselor Queue
                var queue1 = new CounselorQueueItem
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = branchId,
                    SessionId = session1.Id,
                    PatientId = patient1.Id,
                    TokenNumber = "T-001",
                    QueueType = "FinancialCounseling",
                    QueuePosition = 1,
                    PriorityScore = 70,
                    UrgencyLevel = "Normal",
                    AddedToQueueAt = DateTime.UtcNow,
                    Status = "Waiting",
                    EstimatedWaitMinutes = 15,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.CounselorQueue.Add(queue1);
                createdQueueItems.Add("T-001: John Doe (Waiting - Financial)");

                var queue2 = new CounselorQueueItem
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = branchId,
                    SessionId = session2.Id,
                    PatientId = patient2.Id,
                    TokenNumber = "T-002",
                    QueueType = "PreSurgeryCounseling",
                    QueuePosition = 2,
                    PriorityScore = 85,
                    UrgencyLevel = "High",
                    AddedToQueueAt = DateTime.UtcNow,
                    Status = "Waiting",
                    EstimatedWaitMinutes = 10,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.CounselorQueue.Add(queue2);
                createdQueueItems.Add("T-002: Jane Smith (Waiting - Pre-Surgery, HIGH Priority)");

                var queue3 = new CounselorQueueItem
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    BranchId = branchId,
                    SessionId = session3.Id,
                    PatientId = patient3.Id,
                    TokenNumber = "T-003",
                    QueueType = "InsuranceVerification",
                    QueuePosition = 3,
                    PriorityScore = 60,
                    UrgencyLevel = "Low",
                    AddedToQueueAt = DateTime.UtcNow,
                    Status = "Waiting",
                    EstimatedWaitMinutes = 20,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.CounselorQueue.Add(queue3);
                createdQueueItems.Add("T-003: Michael Johnson (Waiting - Insurance)");

                await _context.SaveChangesAsync();
                _logger.LogInformation("Created 3 queue items");

                return Ok(new
                {
                    message = "Sample counselor queue data created successfully!",
                    summary = new
                    {
                        tenantId = tenantId,
                        branchId = branchId,
                        patientsCreated = createdPatients.Count,
                        sessionsCreated = createdSessions.Count,
                        queueItemsCreated = createdQueueItems.Count
                    },
                    details = new
                    {
                        patients = createdPatients,
                        sessions = createdSessions,
                        queueItems = createdQueueItems
                    },
                    nextSteps = new[]
                    {
                        "Refresh your browser",
                        "Go to: http://localhost:3000/dashboard/counsellors-desk/waiting-list",
                        "You should see 3 patients in the Waiting queue",
                        "Test real-time SignalR updates by adding more patients"
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error seeding counselor queue data");
                return StatusCode(500, new
                {
                    message = "Error seeding data",
                    error = ex.Message,
                    stackTrace = ex.StackTrace
                });
            }
        }
    }
}
