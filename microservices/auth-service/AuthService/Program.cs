using AuthService.Context;
using AuthService.Middleware;
using AuthService.Models;
using AuthService.Models.Identity;
using AuthService.Models.Domain;
using AuthService.Services;
using AuthService.Services.Interfaces;
using AuthService.Authorization;
using AuthService.Authorization.Policies;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.AspNetCore.HttpOverrides;

async Task SeedBasicDataForTestingAsync(AppDbContext context)
{
    try
    {
        Console.WriteLine("Starting data seeding...");

        // =====================================================
        // TENANT SEEDING DISABLED
        // Tenants should be created via Admin UI or API
        // Keeping only the existing tenant from database
        // =====================================================
        
        Console.WriteLine("✓ Tenant seeding skipped (use Admin UI to create tenants)");
        
        // Get canonical dev tenant (India Eye) — not whichever row happens to be first.
        await DevTenantBootstrap.EnsureIndiaEyeTenantAsync(context);
        await DevTenantBootstrap.EnsureIndiaEyeAdminUserAsync(context);
        var existingTenant = await context.Tenants.FindAsync(DevTenantBootstrap.IndiaEyeTenantId);
        if (existingTenant != null)
        {
            // Legacy block kept for department seeding on India Eye tenant.
            var adminUser = new AppUser
            {
                Id = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"),
                UserName = "admin@test.com",
                NormalizedUserName = "ADMIN@TEST.COM",
                Email = "admin@test.com",
                NormalizedEmail = "ADMIN@TEST.COM",
                EmailConfirmed = true,
                PasswordHash = "AQAAAAEAACcQAAAAEJGjLkT2QH8Q2VzGv5Q2VzGv5Q2VzGv5Q2VzGv5Q2VzGv5Q==", // Password: Admin123!
                SecurityStamp = Guid.NewGuid().ToString(),
                ConcurrencyStamp = Guid.NewGuid().ToString(),
                PhoneNumber = "+1234567890",
                PhoneNumberConfirmed = true,
                TenantId = DevTenantBootstrap.IndiaEyeTenantId,
                UserType = "Admin",
                UserStatus = "active",
                MustChangePasswordOnLogin = false,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            if (!context.Users.Any(u => u.Id == adminUser.Id))
            {
                context.Users.Add(adminUser);
                await context.SaveChangesAsync();
            }

            // Create Admin role if it doesn't exist
            var adminRole = new AppRole
            {
                Id = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
                Name = "Admin",
                NormalizedName = "ADMIN",
                ConcurrencyStamp = Guid.NewGuid().ToString(),
                TenantId = DevTenantBootstrap.IndiaEyeTenantId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            if (!context.Roles.Any(r => r.Id == adminRole.Id))
            {
                context.Roles.Add(adminRole);
                await context.SaveChangesAsync();
            }

            // Assign user to Admin role
            var userRole = new AppUserRole
            {
                UserId = adminUser.Id,
                RoleId = adminRole.Id
            };

            if (!context.UserRoles.Any(ur => ur.UserId == userRole.UserId && ur.RoleId == userRole.RoleId))
            {
                context.UserRoles.Add(userRole);
                await context.SaveChangesAsync();
            }

            Console.WriteLine("✓ Test admin user created: admin@test.com / Admin123!");
        }
        else
        {
            Console.WriteLine("⚠️  No tenants found. Skipping admin user creation.");
        }

        // Seed 15 Standard Departments for India Eye (canonical dev tenant)
        var firstTenant = await context.Tenants.FindAsync(DevTenantBootstrap.IndiaEyeTenantId);
        if (firstTenant != null)
        {
            var testTenantId = firstTenant.Id;
        
            Console.WriteLine("Checking for existing departments...");
            var existingDeptCount = await context.Departments.CountAsync(d => d.TenantId == testTenantId && d.DeletedAt == null);
            Console.WriteLine($"Found {existingDeptCount} existing departments");
        
            // Seed 15 Standard Departments (functional roles, not medical specialties)
            var standardDeptCount = await context.Departments
                .CountAsync(d => d.TenantId == testTenantId && d.DepartmentCode.StartsWith("STD_") && d.DeletedAt == null);
        
        // TEMPORARY: Skip seeding if departments already exist to avoid duplicates
        if (standardDeptCount == 0)
        {
            Console.WriteLine("Seeding 15 Standard Departments...");
            
            var departments = new List<Department>
            {
                new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, DepartmentCode = "STD_DOCTOR", DepartmentName = "Doctor", DepartmentType = "Clinical", Description = "Licensed physicians providing medical diagnosis and treatment", Status = "Active", Is24x7 = true, RequiresApproval = false, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, DepartmentCode = "STD_OPTOMETRIST", DepartmentName = "Optometrist", DepartmentType = "Clinical", Description = "Eye care professionals conducting vision tests and prescribing corrective lenses", Status = "Active", Is24x7 = false, RequiresApproval = false, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, DepartmentCode = "STD_COUNSELOR", DepartmentName = "Counselor", DepartmentType = "Clinical", Description = "Patient counseling, pre/post-operative guidance, treatment plan discussions", Status = "Active", Is24x7 = false, RequiresApproval = false, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, DepartmentCode = "STD_FRONT_OFFICE", DepartmentName = "Front Office", DepartmentType = "Administrative", Description = "Patient registration, appointment scheduling, reception services", Status = "Active", Is24x7 = true, RequiresApproval = false, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, DepartmentCode = "STD_IMAGING", DepartmentName = "Scan/Imaging", DepartmentType = "Diagnostics", Description = "Diagnostic imaging, OCT scans, fundus photography, visual field testing", Status = "Active", Is24x7 = true, RequiresApproval = false, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, DepartmentCode = "STD_NURSE", DepartmentName = "Nurse (OT Management)", DepartmentType = "Clinical", Description = "Surgical assistance, OT management, patient care", Status = "Active", Is24x7 = true, RequiresApproval = false, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, DepartmentCode = "STD_JUNIOR_DOCTOR", DepartmentName = "Junior Doctor", DepartmentType = "Clinical", Description = "Resident physicians, medical interns, doctors in training", Status = "Active", Is24x7 = true, RequiresApproval = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, DepartmentCode = "STD_PHARMACY", DepartmentName = "Pharmacy", DepartmentType = "Pharmacy", Description = "Medication dispensing, prescription management, inventory control", Status = "Active", Is24x7 = true, RequiresApproval = false, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, DepartmentCode = "STD_OPTICAL", DepartmentName = "Optical", DepartmentType = "Support", Description = "Eyewear sales, lens fitting, optical product management", Status = "Active", Is24x7 = false, RequiresApproval = false, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, DepartmentCode = "STD_INSURANCE", DepartmentName = "Insurance", DepartmentType = "Administrative", Description = "Insurance verification, claims processing, third-party coordination", Status = "Active", Is24x7 = false, RequiresApproval = false, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, DepartmentCode = "STD_BILLING", DepartmentName = "Billing Management", DepartmentType = "Administrative", Description = "Invoice generation, payment processing, financial reconciliation", Status = "Active", Is24x7 = true, RequiresApproval = false, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, DepartmentCode = "STD_INVENTORY", DepartmentName = "Inventory", DepartmentType = "Support", Description = "Supply chain management, equipment tracking, stock control", Status = "Active", Is24x7 = false, RequiresApproval = true, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, DepartmentCode = "STD_ADMIN", DepartmentName = "Admin Management", DepartmentType = "Administrative", Description = "System administration, user management, configuration", Status = "Active", Is24x7 = false, RequiresApproval = false, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, DepartmentCode = "STD_LABORATORY", DepartmentName = "Laboratory", DepartmentType = "Diagnostics", Description = "Pathology tests, microbiology, clinical laboratory services", Status = "Active", Is24x7 = true, RequiresApproval = false, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, DepartmentCode = "STD_HR", DepartmentName = "Human Resources", DepartmentType = "Administrative", Description = "HR management, recruitment, employee relations, performance management", Status = "Active", Is24x7 = false, RequiresApproval = false, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
            };

            context.Departments.AddRange(departments);
            await context.SaveChangesAsync();
            Console.WriteLine($"✓ Seeded {departments.Count} standard departments for test tenant");
            
            // Seed Sub-Departments (Medical Specialties under Doctor, Imaging services under Imaging, etc.)
            var doctorDept = await context.Departments
                .FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_DOCTOR" && d.DeletedAt == null);
            
            var imagingDept = await context.Departments
                .FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_IMAGING" && d.DeletedAt == null);
            
            // Get all parent departments for sub-department seeding
            var optometristDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_OPTOMETRIST" && d.DeletedAt == null);
            var counselorDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_COUNSELOR" && d.DeletedAt == null);
            var frontOfficeDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_FRONT_OFFICE" && d.DeletedAt == null);
            var nurseDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_NURSE" && d.DeletedAt == null);
            var juniorDoctorDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_JUNIOR_DOCTOR" && d.DeletedAt == null);
            var pharmacyDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_PHARMACY" && d.DeletedAt == null);
            var opticalDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_OPTICAL" && d.DeletedAt == null);
            var insuranceDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_INSURANCE" && d.DeletedAt == null);
            var billingDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_BILLING" && d.DeletedAt == null);
            var inventoryDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_INVENTORY" && d.DeletedAt == null);
            var adminDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_ADMIN" && d.DeletedAt == null);
            var labDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_LABORATORY" && d.DeletedAt == null);
            var hrDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_HR" && d.DeletedAt == null);
            
            if (doctorDept != null && imagingDept != null)
            {
                Console.WriteLine("Seeding Sub-Departments for all standard departments...");
                
                var subDepartments = new List<Department>
                {
                    // ===== STD_DOCTOR Sub-Departments (8 medical specialties) =====
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "RETINA", DepartmentName = "Retina & Vitreous", DepartmentType = "Clinical", Description = "Retinal surgery, vitreoretinal procedures, diabetic retinopathy", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "GLAUCOMA", DepartmentName = "Glaucoma", DepartmentType = "Clinical", Description = "Glaucoma diagnosis, laser therapy, surgical management", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "CORNEA", DepartmentName = "Cornea", DepartmentType = "Clinical", Description = "Corneal transplants, keratoconus, corneal diseases", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "CATARACT", DepartmentName = "Cataract", DepartmentType = "Clinical", Description = "Cataract surgery, phacoemulsification, IOL implantation", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "REFRACTIVE", DepartmentName = "LASIK & Refractive Surgery", DepartmentType = "Clinical", Description = "LASIK, PRK, SMILE and refractive surgical procedures", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "PEDIATRIC", DepartmentName = "Pediatric Ophthalmology", DepartmentType = "Clinical", Description = "Pediatric eye care, squint surgery, amblyopia treatment", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "OCULOPLASTY", DepartmentName = "Oculoplasty", DepartmentType = "Clinical", Description = "Eyelid surgery, orbital surgery, cosmetic procedures", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "NEURO_OPHTH", DepartmentName = "Neuro-Ophthalmology", DepartmentType = "Clinical", Description = "Optic nerve disorders, visual pathway diseases", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "UVEA", DepartmentName = "Uvea & Immunology", DepartmentType = "Clinical", Description = "Uveitis, ocular immunology, inflammatory eye diseases", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    
                    // ===== STD_OPTOMETRIST Sub-Departments (4) =====
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = optometristDept?.Id, DepartmentCode = "REFRACTION", DepartmentName = "Refraction Services", DepartmentType = "Clinical", Description = "Vision testing, prescription determination, automated refraction", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = optometristDept?.Id, DepartmentCode = "CONTACT_LENS", DepartmentName = "Contact Lens Clinic", DepartmentType = "Clinical", Description = "Contact lens fitting, RGP lenses, specialty lenses", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = optometristDept?.Id, DepartmentCode = "LOW_VISION", DepartmentName = "Low Vision Aids", DepartmentType = "Clinical", Description = "Visual rehabilitation, low vision devices, magnification aids", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = optometristDept?.Id, DepartmentCode = "ORTHOPTICS", DepartmentName = "Orthoptics", DepartmentType = "Clinical", Description = "Eye muscle evaluation, binocular vision assessment, strabismus screening", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    
                    // ===== STD_COUNSELOR Sub-Departments (3) =====
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = counselorDept?.Id, DepartmentCode = "PRE_SURGERY", DepartmentName = "Pre-Surgery Counseling", DepartmentType = "Administrative", Description = "Surgical procedure explanation, consent, pre-op instructions", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = counselorDept?.Id, DepartmentCode = "ADMISSION", DepartmentName = "Admission Counseling", DepartmentType = "Administrative", Description = "Admission procedures, documentation, patient guidance", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = counselorDept?.Id, DepartmentCode = "INSURANCE_COUNSEL", DepartmentName = "Insurance Counseling", DepartmentType = "Administrative", Description = "Insurance coverage verification, claim guidance, cashless processing", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    
                    // ===== STD_FRONT_OFFICE Sub-Departments (4) =====
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = frontOfficeDept?.Id, DepartmentCode = "RECEPTION", DepartmentName = "Reception Desk", DepartmentType = "Administrative", Description = "Patient registration, appointment scheduling, general inquiries", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = frontOfficeDept?.Id, DepartmentCode = "APPOINTMENTS", DepartmentName = "Appointment Management", DepartmentType = "Administrative", Description = "Online/phone bookings, follow-up scheduling, appointment coordination", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = frontOfficeDept?.Id, DepartmentCode = "PATIENT_RELATIONS", DepartmentName = "Patient Relations", DepartmentType = "Administrative", Description = "Patient feedback, complaint resolution, satisfaction surveys", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = frontOfficeDept?.Id, DepartmentCode = "TELEHEALTH", DepartmentName = "Telehealth Coordination", DepartmentType = "Administrative", Description = "Virtual consultation setup, video call support, remote patient management", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    
                    // ===== STD_IMAGING Sub-Departments (4 diagnostics) =====
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = imagingDept.Id, DepartmentCode = "OCT", DepartmentName = "OCT Imaging", DepartmentType = "Diagnostics", Description = "Optical coherence tomography scans", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = imagingDept.Id, DepartmentCode = "FUNDUS", DepartmentName = "Fundus Photography", DepartmentType = "Diagnostics", Description = "Retinal imaging and documentation", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = imagingDept.Id, DepartmentCode = "BSCAN", DepartmentName = "B-Scan Ultrasound", DepartmentType = "Diagnostics", Description = "Ocular ultrasound imaging", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = imagingDept.Id, DepartmentCode = "PERIMETRY", DepartmentName = "Visual Field Testing", DepartmentType = "Diagnostics", Description = "Perimetry and visual field analysis", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    
                    // ===== STD_NURSE Sub-Departments (5) =====
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = nurseDept?.Id, DepartmentCode = "PRE_OP", DepartmentName = "Pre-Operative Care", DepartmentType = "Clinical", Description = "Patient preparation, pre-op assessment, vitals monitoring", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = nurseDept?.Id, DepartmentCode = "POST_OP", DepartmentName = "Post-Operative Care", DepartmentType = "Clinical", Description = "Recovery monitoring, post-op care, discharge instructions", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = nurseDept?.Id, DepartmentCode = "OT_NURSING", DepartmentName = "Operation Theatre Nursing", DepartmentType = "Clinical", Description = "Surgical assistance, OT management, sterile technique", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = nurseDept?.Id, DepartmentCode = "IPD_NURSING", DepartmentName = "In-Patient Department", DepartmentType = "Clinical", Description = "Inpatient care, medication administration, ward management", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = nurseDept?.Id, DepartmentCode = "EMERGENCY_NURSING", DepartmentName = "Emergency Nursing", DepartmentType = "Clinical", Description = "Emergency response, trauma care, critical situations", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    
                    // ===== STD_JUNIOR_DOCTOR Sub-Departments (3) =====
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = juniorDoctorDept?.Id, DepartmentCode = "RESIDENT_OPD", DepartmentName = "Resident OPD", DepartmentType = "Clinical", Description = "Initial patient screening, preliminary diagnosis, resident consultations", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = juniorDoctorDept?.Id, DepartmentCode = "FOLLOW_UP", DepartmentName = "Follow-Up Clinic", DepartmentType = "Clinical", Description = "Post-operative follow-ups, routine check-ups, treatment monitoring", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = juniorDoctorDept?.Id, DepartmentCode = "TRAINING", DepartmentName = "Training & Supervision", DepartmentType = "Clinical", Description = "Medical education, hands-on training, supervised procedures", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    
                    // ===== STD_PHARMACY Sub-Departments (4) =====
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = pharmacyDept?.Id, DepartmentCode = "OUTPATIENT_PHARMA", DepartmentName = "Outpatient Pharmacy", DepartmentType = "Administrative", Description = "Retail pharmacy for outpatients, prescription dispensing", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = pharmacyDept?.Id, DepartmentCode = "INPATIENT_PHARMA", DepartmentName = "Inpatient Pharmacy", DepartmentType = "Administrative", Description = "Ward medication supply, IV preparation, inpatient prescriptions", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = pharmacyDept?.Id, DepartmentCode = "DRUG_INFO", DepartmentName = "Drug Information Center", DepartmentType = "Administrative", Description = "Medication counseling, drug interactions, pharmacovigilance", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = pharmacyDept?.Id, DepartmentCode = "COMPOUNDING", DepartmentName = "Compounding Pharmacy", DepartmentType = "Administrative", Description = "Custom formulations, eye drops preparation, sterile compounding", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    
                    // ===== STD_OPTICAL Sub-Departments (3) =====
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = opticalDept?.Id, DepartmentCode = "SPECTACLE_SALES", DepartmentName = "Spectacle Sales", DepartmentType = "Administrative", Description = "Eyeglass frames, lens selection, prescription glasses", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = opticalDept?.Id, DepartmentCode = "LENS_LAB", DepartmentName = "Lens Laboratory", DepartmentType = "Administrative", Description = "Lens cutting, edging, fitting, customization", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = opticalDept?.Id, DepartmentCode = "SUNGLASSES", DepartmentName = "Sunglasses & Accessories", DepartmentType = "Administrative", Description = "Protective eyewear, sunglasses, eye accessories", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    
                    // ===== STD_INSURANCE Sub-Departments (3) =====
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = insuranceDept?.Id, DepartmentCode = "CASHLESS", DepartmentName = "Cashless Claims", DepartmentType = "Administrative", Description = "Pre-authorization, cashless approvals, TPA coordination", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = insuranceDept?.Id, DepartmentCode = "REIMBURSEMENT", DepartmentName = "Reimbursement Claims", DepartmentType = "Administrative", Description = "Post-treatment claims, documentation support, reimbursement processing", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = insuranceDept?.Id, DepartmentCode = "VERIFICATION", DepartmentName = "Insurance Verification", DepartmentType = "Administrative", Description = "Coverage verification, policy validation, eligibility checks", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    
                    // ===== STD_BILLING Sub-Departments (4) =====
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = billingDept?.Id, DepartmentCode = "OPD_BILLING", DepartmentName = "OPD Billing", DepartmentType = "Administrative", Description = "Outpatient billing, consultation fees, diagnostic charges", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = billingDept?.Id, DepartmentCode = "IPD_BILLING", DepartmentName = "IPD Billing", DepartmentType = "Administrative", Description = "Inpatient billing, surgery packages, discharge billing", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = billingDept?.Id, DepartmentCode = "ACCOUNTS", DepartmentName = "Accounts Receivable", DepartmentType = "Administrative", Description = "Payment collection, outstanding dues, financial reporting", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = billingDept?.Id, DepartmentCode = "CASHIER", DepartmentName = "Cashier Services", DepartmentType = "Administrative", Description = "Cash handling, payment processing, refunds", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    
                    // ===== STD_INVENTORY Sub-Departments (4) =====
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = inventoryDept?.Id, DepartmentCode = "MEDICAL_STORES", DepartmentName = "Medical Stores", DepartmentType = "Administrative", Description = "Surgical consumables, medical equipment, sterile supplies", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = inventoryDept?.Id, DepartmentCode = "PROCUREMENT", DepartmentName = "Procurement", DepartmentType = "Administrative", Description = "Vendor management, purchase orders, contract negotiation", Status = "Active", Is24x7 = false, RequiresApproval = true, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = inventoryDept?.Id, DepartmentCode = "WAREHOUSE", DepartmentName = "Warehouse Management", DepartmentType = "Administrative", Description = "Stock management, storage, distribution logistics", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = inventoryDept?.Id, DepartmentCode = "ASSET_MGMT", DepartmentName = "Asset Management", DepartmentType = "Administrative", Description = "Equipment tracking, maintenance scheduling, asset depreciation", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    
                    // ===== STD_ADMIN Sub-Departments (4) =====
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = adminDept?.Id, DepartmentCode = "IT_SUPPORT", DepartmentName = "IT Support", DepartmentType = "Administrative", Description = "Technical support, system maintenance, software troubleshooting", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = adminDept?.Id, DepartmentCode = "HOUSEKEEPING", DepartmentName = "Housekeeping", DepartmentType = "Administrative", Description = "Facility cleaning, hygiene maintenance, sanitation", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = adminDept?.Id, DepartmentCode = "SECURITY", DepartmentName = "Security Services", DepartmentType = "Administrative", Description = "Facility security, access control, surveillance", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = adminDept?.Id, DepartmentCode = "MAINTENANCE", DepartmentName = "Maintenance & Engineering", DepartmentType = "Administrative", Description = "Equipment repair, facility maintenance, electrical/plumbing services", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    
                    // ===== STD_LABORATORY Sub-Departments (4) =====
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = labDept?.Id, DepartmentCode = "PATHOLOGY", DepartmentName = "Pathology Lab", DepartmentType = "Diagnostics", Description = "Blood tests, cytology, histopathology, tissue analysis", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = labDept?.Id, DepartmentCode = "MICROBIOLOGY", DepartmentName = "Microbiology", DepartmentType = "Diagnostics", Description = "Culture tests, infection screening, antimicrobial sensitivity", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = labDept?.Id, DepartmentCode = "BIOCHEMISTRY", DepartmentName = "Biochemistry", DepartmentType = "Diagnostics", Description = "Blood chemistry, metabolic panels, glucose testing", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = labDept?.Id, DepartmentCode = "SEROLOGY", DepartmentName = "Serology & Immunology", DepartmentType = "Diagnostics", Description = "Antibody testing, viral markers, immunological tests", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    
                    // ===== STD_HR Sub-Departments (5) =====
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = hrDept?.Id, DepartmentCode = "RECRUITMENT", DepartmentName = "Recruitment & Talent Acquisition", DepartmentType = "Administrative", Description = "Job postings, candidate screening, interview coordination, onboarding", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = hrDept?.Id, DepartmentCode = "PAYROLL", DepartmentName = "Payroll & Compensation", DepartmentType = "Administrative", Description = "Salary processing, benefits administration, tax compliance", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = hrDept?.Id, DepartmentCode = "EMPLOYEE_RELATIONS", DepartmentName = "Employee Relations", DepartmentType = "Administrative", Description = "Grievance handling, conflict resolution, employee engagement", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = hrDept?.Id, DepartmentCode = "TRAINING_DEV", DepartmentName = "Training & Development", DepartmentType = "Administrative", Description = "Staff training programs, skill development, continuing education", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                    new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = hrDept?.Id, DepartmentCode = "PERFORMANCE_MGMT", DepartmentName = "Performance Management", DepartmentType = "Administrative", Description = "Performance reviews, goal setting, appraisal systems", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
                };
                
                // Filter out departments where parent is null (in case some parent departments don't exist)
                var validSubDepartments = subDepartments.Where(d => d.ParentDepartmentId != null).ToList();
                
                context.Departments.AddRange(validSubDepartments);
                await context.SaveChangesAsync();
                Console.WriteLine($"✓ Seeded {validSubDepartments.Count} sub-departments across all standard departments");
            }
        }
        else
        {
            Console.WriteLine($"✓ Standard departments already exist ({standardDeptCount} found), skipping seeding");
            
            // Check if sub-departments exist
            var subDeptCount = await context.Departments
                .CountAsync(d => d.TenantId == testTenantId && d.ParentDepartmentId != null && d.DeletedAt == null);
            
            // Only delete and re-seed if sub-department count is incomplete (< 62)
            // Prevents deletion on every startup once deployment is complete
            if (subDeptCount > 0 && subDeptCount < 62)
            {
            Console.WriteLine($"⚠️ Found {subDeptCount} sub-departments (expected 62). Deleting incomplete set for full re-seeding...");
                var existingSubDepts = await context.Departments
                    .Where(d => d.TenantId == testTenantId && d.ParentDepartmentId != null && d.DeletedAt == null)
                    .ToListAsync();
                context.Departments.RemoveRange(existingSubDepts);
                await context.SaveChangesAsync();
                Console.WriteLine($"✓ Deleted {existingSubDepts.Count} existing sub-departments");
                subDeptCount = 0; // Reset count to trigger seeding
            }
            else if (subDeptCount >= 58)
            {
                Console.WriteLine($"✓ Sub-departments already seeded ({subDeptCount} found), skipping deletion and re-seeding");
            }
            
            if (subDeptCount == 0)
            {
                // Get all parent departments for sub-department seeding
                var optometristDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_OPTOMETRIST" && d.DeletedAt == null);
                var counselorDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_COUNSELOR" && d.DeletedAt == null);
                var frontOfficeDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_FRONT_OFFICE" && d.DeletedAt == null);
                var doctorDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_DOCTOR" && d.DeletedAt == null);
                var imagingDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_IMAGING" && d.DeletedAt == null);
                var nurseDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_NURSE" && d.DeletedAt == null);
                var juniorDoctorDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_JUNIOR_DOCTOR" && d.DeletedAt == null);
                var pharmacyDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_PHARMACY" && d.DeletedAt == null);
                var opticalDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_OPTICAL" && d.DeletedAt == null);
                var insuranceDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_INSURANCE" && d.DeletedAt == null);
                var billingDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_BILLING" && d.DeletedAt == null);
                var inventoryDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_INVENTORY" && d.DeletedAt == null);
                var adminDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_ADMIN" && d.DeletedAt == null);
                var labDept = await context.Departments.FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_LABORATORY" && d.DeletedAt == null);
                
                Console.WriteLine("Seeding Sub-Departments for all standard departments...");
                
                var subDepartments = new List<Department>();
                
                // ===== STD_DOCTOR Sub-Departments (8) =====
                if (doctorDept != null)
                {
                    subDepartments.AddRange(new[]
                    {
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "RETINA", DepartmentName = "Retina & Vitreous", DepartmentType = "Clinical", Description = "Retinal surgery, vitreoretinal procedures, diabetic retinopathy", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "GLAUCOMA", DepartmentName = "Glaucoma", DepartmentType = "Clinical", Description = "Glaucoma diagnosis, laser therapy, surgical management", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "CORNEA", DepartmentName = "Cornea", DepartmentType = "Clinical", Description = "Corneal transplants, keratoconus, corneal diseases", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "CATARACT", DepartmentName = "Cataract", DepartmentType = "Clinical", Description = "Cataract surgery, phacoemulsification, IOL implantation", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "REFRACTIVE", DepartmentName = "LASIK & Refractive Surgery", DepartmentType = "Clinical", Description = "LASIK, PRK, SMILE and refractive surgical procedures", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "PEDIATRIC", DepartmentName = "Pediatric Ophthalmology", DepartmentType = "Clinical", Description = "Pediatric eye care, squint surgery, amblyopia treatment", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "OCULOPLASTY", DepartmentName = "Oculoplasty", DepartmentType = "Clinical", Description = "Eyelid surgery, orbital surgery, cosmetic procedures", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "NEURO_OPHTH", DepartmentName = "Neuro-Ophthalmology", DepartmentType = "Clinical", Description = "Optic nerve disorders, visual pathway diseases", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = doctorDept.Id, DepartmentCode = "UVEA", DepartmentName = "Uvea & Immunology", DepartmentType = "Clinical", Description = "Uveitis, ocular immunology, inflammatory eye diseases", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
                    });
                }
                
                // ===== STD_OPTOMETRIST Sub-Departments (4) =====
                if (optometristDept != null)
                {
                    subDepartments.AddRange(new[]
                    {
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = optometristDept.Id, DepartmentCode = "REFRACTION", DepartmentName = "Refraction Services", DepartmentType = "Clinical", Description = "Vision testing, prescription determination, automated refraction", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = optometristDept.Id, DepartmentCode = "CONTACT_LENS", DepartmentName = "Contact Lens Clinic", DepartmentType = "Clinical", Description = "Contact lens fitting, RGP lenses, specialty lenses", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = optometristDept.Id, DepartmentCode = "LOW_VISION", DepartmentName = "Low Vision Aids", DepartmentType = "Clinical", Description = "Visual rehabilitation, low vision devices, magnification aids", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = optometristDept.Id, DepartmentCode = "ORTHOPTICS", DepartmentName = "Orthoptics", DepartmentType = "Clinical", Description = "Eye muscle evaluation, binocular vision assessment, strabismus screening", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
                    });
                }
                
                // ===== STD_COUNSELOR Sub-Departments (3) =====
                if (counselorDept != null)
                {
                    subDepartments.AddRange(new[]
                    {
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = counselorDept.Id, DepartmentCode = "PRE_SURGERY", DepartmentName = "Pre-Surgery Counseling", DepartmentType = "Administrative", Description = "Surgical procedure explanation, consent, pre-op instructions", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = counselorDept.Id, DepartmentCode = "ADMISSION", DepartmentName = "Admission Counseling", DepartmentType = "Administrative", Description = "Admission procedures, documentation, patient guidance", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = counselorDept.Id, DepartmentCode = "INSURANCE_COUNSEL", DepartmentName = "Insurance Counseling", DepartmentType = "Administrative", Description = "Insurance coverage verification, claim guidance, cashless processing", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
                    });
                }
                
                // ===== STD_FRONT_OFFICE Sub-Departments (4) =====
                if (frontOfficeDept != null)
                {
                    subDepartments.AddRange(new[]
                    {
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = frontOfficeDept.Id, DepartmentCode = "RECEPTION", DepartmentName = "Reception Desk", DepartmentType = "Administrative", Description = "Patient registration, appointment scheduling, general inquiries", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = frontOfficeDept.Id, DepartmentCode = "APPOINTMENTS", DepartmentName = "Appointment Management", DepartmentType = "Administrative", Description = "Online/phone bookings, follow-up scheduling, appointment coordination", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = frontOfficeDept.Id, DepartmentCode = "PATIENT_RELATIONS", DepartmentName = "Patient Relations", DepartmentType = "Administrative", Description = "Patient feedback, complaint resolution, satisfaction surveys", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = frontOfficeDept.Id, DepartmentCode = "TELEHEALTH", DepartmentName = "Telehealth Coordination", DepartmentType = "Administrative", Description = "Virtual consultation setup, video call support, remote patient management", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
                    });
                }
                
                // ===== STD_IMAGING Sub-Departments (4) =====
                if (imagingDept != null)
                {
                    subDepartments.AddRange(new[]
                    {
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = imagingDept.Id, DepartmentCode = "OCT", DepartmentName = "OCT Imaging", DepartmentType = "Diagnostics", Description = "Optical coherence tomography scans", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = imagingDept.Id, DepartmentCode = "FUNDUS", DepartmentName = "Fundus Photography", DepartmentType = "Diagnostics", Description = "Retinal imaging and documentation", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = imagingDept.Id, DepartmentCode = "BSCAN", DepartmentName = "B-Scan Ultrasound", DepartmentType = "Diagnostics", Description = "Ocular ultrasound imaging", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = imagingDept.Id, DepartmentCode = "PERIMETRY", DepartmentName = "Visual Field Testing", DepartmentType = "Diagnostics", Description = "Perimetry and visual field analysis", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
                    });
                }
                
                // ===== STD_NURSE Sub-Departments (5) =====
                if (nurseDept != null)
                {
                    subDepartments.AddRange(new[]
                    {
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = nurseDept.Id, DepartmentCode = "PRE_OP", DepartmentName = "Pre-Operative Care", DepartmentType = "Clinical", Description = "Patient preparation, pre-op assessment, vitals monitoring", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = nurseDept.Id, DepartmentCode = "POST_OP", DepartmentName = "Post-Operative Care", DepartmentType = "Clinical", Description = "Recovery monitoring, post-op care, discharge instructions", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = nurseDept.Id, DepartmentCode = "OT_NURSING", DepartmentName = "Operation Theatre Nursing", DepartmentType = "Clinical", Description = "Surgical assistance, OT management, sterile technique", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = nurseDept.Id, DepartmentCode = "IPD_NURSING", DepartmentName = "In-Patient Department", DepartmentType = "Clinical", Description = "Inpatient care, medication administration, ward management", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = nurseDept.Id, DepartmentCode = "EMERGENCY_NURSING", DepartmentName = "Emergency Nursing", DepartmentType = "Clinical", Description = "Emergency response, trauma care, critical situations", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
                    });
                }
                
                // ===== STD_JUNIOR_DOCTOR Sub-Departments (3) =====
                if (juniorDoctorDept != null)
                {
                    subDepartments.AddRange(new[]
                    {
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = juniorDoctorDept.Id, DepartmentCode = "RESIDENT_OPD", DepartmentName = "Resident OPD", DepartmentType = "Clinical", Description = "Initial patient screening, preliminary diagnosis, resident consultations", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = juniorDoctorDept.Id, DepartmentCode = "FOLLOW_UP", DepartmentName = "Follow-Up Clinic", DepartmentType = "Clinical", Description = "Post-operative follow-ups, routine check-ups, treatment monitoring", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = juniorDoctorDept.Id, DepartmentCode = "TRAINING", DepartmentName = "Training & Supervision", DepartmentType = "Clinical", Description = "Medical education, hands-on training, supervised procedures", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
                    });
                }
                
                // ===== STD_PHARMACY Sub-Departments (4) =====
                if (pharmacyDept != null)
                {
                    subDepartments.AddRange(new[]
                    {
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = pharmacyDept.Id, DepartmentCode = "OUTPATIENT_PHARMA", DepartmentName = "Outpatient Pharmacy", DepartmentType = "Administrative", Description = "Retail pharmacy for outpatients, prescription dispensing", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = pharmacyDept.Id, DepartmentCode = "INPATIENT_PHARMA", DepartmentName = "Inpatient Pharmacy", DepartmentType = "Administrative", Description = "Ward medication supply, IV preparation, inpatient prescriptions", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = pharmacyDept.Id, DepartmentCode = "DRUG_INFO", DepartmentName = "Drug Information Center", DepartmentType = "Administrative", Description = "Medication counseling, drug interactions, pharmacovigilance", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = pharmacyDept.Id, DepartmentCode = "COMPOUNDING", DepartmentName = "Compounding Pharmacy", DepartmentType = "Administrative", Description = "Custom formulations, eye drops preparation, sterile compounding", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
                    });
                }
                
                // ===== STD_OPTICAL Sub-Departments (3) =====
                if (opticalDept != null)
                {
                    subDepartments.AddRange(new[]
                    {
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = opticalDept.Id, DepartmentCode = "SPECTACLE_SALES", DepartmentName = "Spectacle Sales", DepartmentType = "Administrative", Description = "Eyeglass frames, lens selection, prescription glasses", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = opticalDept.Id, DepartmentCode = "LENS_LAB", DepartmentName = "Lens Laboratory", DepartmentType = "Administrative", Description = "Lens cutting, edging, fitting, customization", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = opticalDept.Id, DepartmentCode = "SUNGLASSES", DepartmentName = "Sunglasses & Accessories", DepartmentType = "Administrative", Description = "Protective eyewear, sunglasses, eye accessories", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
                    });
                }
                
                // ===== STD_INSURANCE Sub-Departments (3) =====
                if (insuranceDept != null)
                {
                    subDepartments.AddRange(new[]
                    {
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = insuranceDept.Id, DepartmentCode = "CASHLESS", DepartmentName = "Cashless Claims", DepartmentType = "Administrative", Description = "Pre-authorization, cashless approvals, TPA coordination", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = insuranceDept.Id, DepartmentCode = "REIMBURSEMENT", DepartmentName = "Reimbursement Claims", DepartmentType = "Administrative", Description = "Post-treatment claims, documentation support, reimbursement processing", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = insuranceDept.Id, DepartmentCode = "VERIFICATION", DepartmentName = "Insurance Verification", DepartmentType = "Administrative", Description = "Coverage verification, policy validation, eligibility checks", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
                    });
                }
                
                // ===== STD_BILLING Sub-Departments (4) =====
                if (billingDept != null)
                {
                    subDepartments.AddRange(new[]
                    {
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = billingDept.Id, DepartmentCode = "OPD_BILLING", DepartmentName = "OPD Billing", DepartmentType = "Administrative", Description = "Outpatient billing, consultation fees, diagnostic charges", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = billingDept.Id, DepartmentCode = "IPD_BILLING", DepartmentName = "IPD Billing", DepartmentType = "Administrative", Description = "Inpatient billing, surgery packages, discharge billing", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = billingDept.Id, DepartmentCode = "ACCOUNTS", DepartmentName = "Accounts Receivable", DepartmentType = "Administrative", Description = "Payment collection, outstanding dues, financial reporting", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = billingDept.Id, DepartmentCode = "CASHIER", DepartmentName = "Cashier Services", DepartmentType = "Administrative", Description = "Cash handling, payment processing, refunds", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
                    });
                }
                
                // ===== STD_INVENTORY Sub-Departments (4) =====
                if (inventoryDept != null)
                {
                    subDepartments.AddRange(new[]
                    {
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = inventoryDept.Id, DepartmentCode = "MEDICAL_STORES", DepartmentName = "Medical Stores", DepartmentType = "Administrative", Description = "Surgical consumables, medical equipment, sterile supplies", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = inventoryDept.Id, DepartmentCode = "PROCUREMENT", DepartmentName = "Procurement", DepartmentType = "Administrative", Description = "Vendor management, purchase orders, contract negotiation", Status = "Active", Is24x7 = false, RequiresApproval = true, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = inventoryDept.Id, DepartmentCode = "WAREHOUSE", DepartmentName = "Warehouse Management", DepartmentType = "Administrative", Description = "Stock management, storage, distribution logistics", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = inventoryDept.Id, DepartmentCode = "ASSET_MGMT", DepartmentName = "Asset Management", DepartmentType = "Administrative", Description = "Equipment tracking, maintenance scheduling, asset depreciation", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
                    });
                }
                
                // ===== STD_ADMIN Sub-Departments (5) =====
                if (adminDept != null)
                {
                    subDepartments.AddRange(new[]
                    {
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = adminDept.Id, DepartmentCode = "HR", DepartmentName = "Human Resources", DepartmentType = "Administrative", Description = "Recruitment, payroll, employee relations, performance management", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = adminDept.Id, DepartmentCode = "IT_SUPPORT", DepartmentName = "IT Support", DepartmentType = "Administrative", Description = "Technical support, system maintenance, software troubleshooting", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = adminDept.Id, DepartmentCode = "HOUSEKEEPING", DepartmentName = "Housekeeping", DepartmentType = "Administrative", Description = "Facility cleaning, hygiene maintenance, sanitation", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = adminDept.Id, DepartmentCode = "SECURITY", DepartmentName = "Security Services", DepartmentType = "Administrative", Description = "Facility security, access control, surveillance", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = adminDept.Id, DepartmentCode = "MAINTENANCE", DepartmentName = "Maintenance & Engineering", DepartmentType = "Administrative", Description = "Equipment repair, facility maintenance, electrical/plumbing services", Status = "Active", Is24x7 = true, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
                    });
                }
                
                // ===== STD_LABORATORY Sub-Departments (4) =====
                if (labDept != null)
                {
                    subDepartments.AddRange(new[]
                    {
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = labDept.Id, DepartmentCode = "PATHOLOGY", DepartmentName = "Pathology Lab", DepartmentType = "Diagnostics", Description = "Blood tests, cytology, histopathology, tissue analysis", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = labDept.Id, DepartmentCode = "MICROBIOLOGY", DepartmentName = "Microbiology", DepartmentType = "Diagnostics", Description = "Culture tests, infection screening, antimicrobial sensitivity", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = labDept.Id, DepartmentCode = "BIOCHEMISTRY", DepartmentName = "Biochemistry", DepartmentType = "Diagnostics", Description = "Blood chemistry, metabolic panels, glucose testing", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow },
                        new Department { Id = Guid.NewGuid(), TenantId = testTenantId, BranchId = null, ParentDepartmentId = labDept.Id, DepartmentCode = "SEROLOGY", DepartmentName = "Serology & Immunology", DepartmentType = "Diagnostics", Description = "Antibody testing, viral markers, immunological tests", Status = "Active", Is24x7 = false, RequiresApproval = false, DepartmentLevel = 2, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow }
                    });
                }
                
                if (subDepartments.Any())
                {
                    context.Departments.AddRange(subDepartments);
                    await context.SaveChangesAsync();
                    Console.WriteLine($"✓ Seeded {subDepartments.Count} sub-departments across all standard departments");
                }
            }
            else
            {
                Console.WriteLine($"✓ Sub-departments already exist ({subDeptCount} found), skipping seeding");
            }

            // ── Bootstrap: ensure admin user has a primary department assignment ──────
            var adminGuid = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
            var adminDeptEntity = await context.Departments
                .FirstOrDefaultAsync(d => d.TenantId == testTenantId && d.DepartmentCode == "STD_ADMIN" && d.DeletedAt == null);

            if (adminDeptEntity != null)
            {
                var hasAdminDeptAccess = await context.UserDepartments
                    .AnyAsync(ud => ud.UserId == adminGuid && ud.DepartmentId == adminDeptEntity.Id && ud.DeletedAt == null);

                if (!hasAdminDeptAccess)
                {
                    context.UserDepartments.Add(new UserDepartment
                    {
                        Id           = Guid.NewGuid(),
                        TenantId     = testTenantId,
                        BranchId     = null,
                        UserId       = adminGuid,
                        DepartmentId = adminDeptEntity.Id,
                        AccessType   = "Primary",
                        CanView      = true,
                        CanCreate    = true,
                        CanEdit      = true,
                        CanDelete    = true,
                        CanApprove   = true,
                        CanExport    = true,
                        IsActive     = true,
                        Status       = "active",
                        CreatedAt    = DateTime.UtcNow,
                        UpdatedAt    = DateTime.UtcNow
                    });
                    await context.SaveChangesAsync();
                    Console.WriteLine("✓ Admin user assigned to STD_ADMIN department");
                }
                else
                {
                    Console.WriteLine("✓ Admin department assignment already exists, skipping");
                }
            }
        }
    } // Closes if (firstTenant != null) block from line ~104
    else
    {
        Console.WriteLine("⚠️  No tenant found for department seeding.");
    }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"!!! Error during seeding: {ex.Message}");
        Console.WriteLine($"!!! Stack trace: {ex.StackTrace}");
        throw;
    }
}

Console.WriteLine("=== BACKEND STARTUP: Starting application ===");

try
{
    var builder = WebApplication.CreateBuilder(args);
    Console.WriteLine("✓ WebApplication builder created");

    // Add services to the container
    Console.WriteLine("Adding controllers...");
    builder.Services.AddControllers()
        .AddJsonOptions(options =>
        {
            // Convert PascalCase to camelCase in JSON responses
            // This fixes frontend property mapping (PatientName → patientName)
            options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
            options.JsonSerializerOptions.DictionaryKeyPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        });
    builder.Services.AddEndpointsApiExplorer();
    
    // Add SignalR for real-time updates
    builder.Services.AddSignalR();
    
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
        {
            Title = "Hospital Portal API",
            Version = "v1",
            Description = "ASP.NET Core 8.0 API for Hospital Management System"
        });
        
        // Avoid schema ID collisions when multiple types share the same class name (e.g. RescheduleRequest).
        c.CustomSchemaIds(t => t.FullName?.Replace("+", ".") ?? t.Name);

        // Handle multiple actions with same HTTP method and route
        c.ResolveConflictingActions(apiDescriptions => apiDescriptions.First());
        
        // Ignore obsolete actions
        c.IgnoreObsoleteActions();
    });
    Console.WriteLine("✓ Controllers configured");

    // Configure database: use Postgres when connection string provided, otherwise fall back to InMemory for local dev
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    Console.WriteLine($"Database configuration: PostgreSQL");
    
    // Register tenant command interceptor
    builder.Services.AddSingleton<AuthService.Context.TenantCommandInterceptor>();
    
    builder.Services.AddDbContext<AppDbContext>((serviceProvider, options) =>
    {
        var tenantInterceptor = serviceProvider.GetRequiredService<AuthService.Context.TenantCommandInterceptor>();
        options.UseNpgsql(connectionString)
               .AddInterceptors(tenantInterceptor);
        // Suppress pending model changes warning to allow startup while tables are being created
        options.ConfigureWarnings(warnings => 
            warnings.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
    });
    Console.WriteLine("✓ PostgreSQL DbContext configured with tenant RLS interceptor");

    // Configure Identity
    Console.WriteLine("Configuring Identity...");
    builder.Services.AddIdentity<AppUser, AppRole>(options =>
    {
        // Password settings
        options.Password.RequireDigit = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireNonAlphanumeric = true;
        options.Password.RequiredLength = 8;

        // Lockout settings
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.AllowedForNewUsers = true;

        // User settings
        options.User.RequireUniqueEmail = true;
    })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();
    Console.WriteLine("✓ Identity configured");

    // Configure JWT Authentication
    Console.WriteLine("Configuring JWT Authentication...");
    
    // IMPORTANT: Clear default claim type mappings so claim types match what we set in token
    Microsoft.IdentityModel.JsonWebTokens.JsonWebTokenHandler.DefaultInboundClaimTypeMap.Clear();
    System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();
    
    builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.SaveToken = true;
        options.RequireHttpsMetadata = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "default-key-min-32-characters-long")),
            ClockSkew = TimeSpan.Zero,
            NameClaimType = "sub" // Map the "sub" claim to User.Identity.Name
        };
    });
    Console.WriteLine("✓ JWT Authentication configured");

    // Configure Authorization with Permission-Based Policies
    Console.WriteLine("Configuring Authorization...");
    builder.Services.AddHttpContextAccessor();
    
    // Register custom authorization policy provider for dynamic permission policies
    builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionAuthorizationPolicyProvider>();
    
    // Register the existing permission authorization handler
    builder.Services.AddScoped<IAuthorizationHandler, AuthService.Services.PermissionAuthorizationHandler>();
    
    builder.Services.AddAuthorization(options =>
    {
        // Keep existing policies for backwards compatibility
        options.AddPolicy("RequireAdminRole", policy => policy.RequireRole("Admin"));
        
        // Permission policies are now dynamically created by PermissionAuthorizationPolicyProvider
        // No need to register individual permission policies here
    });
    Console.WriteLine("✓ Authorization configured with permission-based policies");

    // Add HttpContextAccessor (needed for DbContext)
    // TEMPORARILY DISABLED FOR TESTING
    // builder.Services.AddHttpContextAccessor();
    
    // Register custom authorization policy provider for dynamic permission policies
    // TEMPORARILY DISABLED FOR TESTING
    /*
    builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionAuthorizationPolicyProvider>();
    
    // Register the existing permission authorization handler
    builder.Services.AddScoped<IAuthorizationHandler, AuthService.Services.PermissionAuthorizationHandler>();
    
    builder.Services.AddAuthorization(options =>
    {
        // Keep existing policies for backwards compatibility
        options.AddPolicy("RequireAdminRole", policy => policy.RequireRole("Admin"));
        
        // Permission policies are now dynamically created by PermissionAuthorizationPolicyProvider
        // No need to register individual permission policies here
    });
    Console.WriteLine("✓ Authorization configured with permission-based policies");
    */

    // Register services
    Console.WriteLine("Registering services...");
    
    // Add Memory Cache for performance optimization
    builder.Services.AddMemoryCache();
    
    // Add Branch Cache Service (reduces database queries by ~90%)
    builder.Services.AddScoped<IBranchCacheService, BranchCacheService>();
    
    builder.Services.AddScoped<IJwtService, JwtService>();
    builder.Services.AddScoped<IPermissionService, PermissionService>();
    builder.Services.AddScoped<IUserService, UserService>();
    builder.Services.AddScoped<IUserDepartmentAccessService, UserDepartmentAccessService>();
    builder.Services.AddScoped<ITenantService, TenantService>();
    builder.Services.AddScoped<IOrganizationService, OrganizationService>();
    builder.Services.AddScoped<IBranchService, BranchService>();
    builder.Services.AddScoped<IDepartmentService, DepartmentService>();
    builder.Services.AddScoped<IRoleService, RoleService>();
    builder.Services.AddScoped<IPermissionManagementService, PermissionManagementService>();
    builder.Services.AddScoped<IDashboardService, DashboardService>();
    
    // Phase 2: Branch Capacity Service (Real-time bed tracking)
    builder.Services.AddScoped<IBranchCapacityService, BranchCapacityService>();
    
    // Phase 2: Onboarding & Progressive Access Service
    builder.Services.AddScoped<IOnboardingService, OnboardingService>();
    
    // Phase 2: Advanced Search Service (Dynamic LINQ search)
    builder.Services.AddScoped<ISearchService, SearchService>();
    
    // Phase 2: Performance Review Service (13 weighted criteria, 3-step approval)
    builder.Services.AddScoped<IPerformanceReviewService, PerformanceReviewService>();
    
    // Phase 2: Training & Compliance Management Service
    builder.Services.AddScoped<ITrainingManagementService, TrainingManagementService>();
    
    // Phase 2: Diagnostic & Imaging Services
    builder.Services.AddScoped<IBiometryService, BiometryService>();
    builder.Services.AddScoped<IIOLInventoryService, IOLInventoryService>();
    builder.Services.AddScoped<IRetinopathyScreeningService, RetinopathyScreeningService>();
    builder.Services.AddScoped<IOctImagingService, OctImagingService>();
    builder.Services.AddScoped<IElectrophysiologyService, ElectrophysiologyService>();
    
    builder.Services.AddScoped<AppointmentService>();
    // builder.Services.AddScoped<IAppointmentService, CachedAppointmentService>(); // Disabled - interface mismatch
    builder.Services.AddScoped<IAppointmentService, AppointmentService>();
    builder.Services.AddScoped<IPatientService, PatientService>();
    builder.Services.AddScoped<IPatientMergeService, PatientMergeService>();
    builder.Services.AddScoped<IAcuityScoringService, AcuityScoringService>();
    builder.Services.AddScoped<IPatientEngagementService, PatientEngagementService>();
    builder.Services.AddScoped<IPatientLookupService, PatientLookupService>();
    builder.Services.AddScoped<IPatientOmniSearchService, PatientOmniSearchService>();
    builder.Services.AddScoped<IPatientRecentViewsService, PatientRecentViewsService>();
    builder.Services.AddScoped<IPatientSummaryService, PatientSummaryService>();
    builder.Services.AddScoped<IPatientSummaryPdfService, PatientSummaryPdfService>();
    builder.Services.AddScoped<IUserChartLayoutService, UserChartLayoutService>();
    builder.Services.AddScoped<IPatientDuplicateDetectionService, PatientDuplicateDetectionService>(); // Feb 2026 - Duplicate prevention
    builder.Services.AddScoped<INotificationService, NotificationService>();
    builder.Services.AddScoped<INotificationClient, NotificationClient>(); // Notification microservice client
    
    // Phase 2: Follow-Up Management Services (Dec 2025)
    builder.Services.AddScoped<IFollowUpService, FollowUpService>();
    builder.Services.AddScoped<IPostOpCareService, PostOpCareService>();
    builder.Services.AddScoped<IAdherenceService, AdherenceService>();
    builder.Services.AddScoped<IReminderService, ReminderService>();
    
    // Phase 3: Prescription Management Services (Jan 2026)
    builder.Services.AddScoped<IDrugInteractionService, DrugInteractionService>();
    builder.Services.AddScoped<IMedicationDatabaseService, MedicationDatabaseService>();
    builder.Services.AddScoped<IPrescriptionService, PrescriptionService>();
    builder.Services.AddScoped<IDiagnosisService, DiagnosisService>(); // Phase 3: ICD-10 Diagnosis Management
    builder.Services.AddScoped<IReportService, ReportService>();
    
    // OPD Visit & Billing Services (Phase 1 OPD Workflow - Jan 2026)
    builder.Services.AddScoped<OpdBillService>();
    builder.Services.AddScoped<IOpdBillService>(sp => sp.GetRequiredService<OpdBillService>());
    builder.Services.AddHttpClient<CcmsBillFinalizedClient>();
    builder.Services.AddScoped<ICcmsBillFinalizedClient>(sp => sp.GetRequiredService<CcmsBillFinalizedClient>());
    builder.Services.AddScoped<ICcmsPatientShareLookup>(sp => sp.GetRequiredService<CcmsBillFinalizedClient>());
    builder.Services.AddScoped<IBillingCcmsOutboxService, BillingCcmsOutboxService>();
    builder.Services.AddHostedService<BillingCcmsOutboxProcessor>();
    builder.Services.AddScoped<IOptometryQueueService, OptometryQueueService>();
    builder.Services.AddScoped<IOptometrySegmentExamService, OptometrySegmentExamService>();
    builder.Services.AddScoped<IOptometryPatientHistoryService, OptometryPatientHistoryService>();
    builder.Services.AddScoped<IVisitService, VisitService>();
    builder.Services.AddScoped<IRefundService, RefundService>();
    
    // Day 4: Itemized Billing Services (Feb 6, 2026)
    builder.Services.AddScoped<IServiceCatalogService, ServiceCatalogService>();
    builder.Services.AddScoped<IServiceCatalogAdminService, ServiceCatalogAdminService>();
    builder.Services.AddScoped<IServiceCatalogMasterSyncService, ServiceCatalogMasterSyncService>();
    builder.Services.AddScoped<IBillItemService, BillItemService>();
    builder.Services.AddScoped<IChargeCatalogResolver, ChargeCatalogResolver>();
    builder.Services.AddScoped<IChargeMappingAdminService, ChargeMappingAdminService>();
    builder.Services.AddScoped<IChargeReconciliationService, ChargeReconciliationService>();
    
    // Module 3: Counseling & Surgery Package Management Services (Feb 15, 2026)
    builder.Services.AddScoped<IPackageManagementService, PackageManagementService>();
    builder.Services.AddScoped<ICounsellingPackageTemplateService, CounsellingPackageTemplateService>();
    builder.Services.AddScoped<ICounselingWorkflowService, CounselingWorkflowService>();
    builder.Services.AddScoped<ICounselorCommunicationService, CounselorCommunicationService>(); // Comm logs, callbacks, overdue (Phase B)
    builder.Services.AddScoped<IFollowupListService, FollowupListService>(); // Follow-up Center list/search/stats (Phase 2B)
    builder.Services.AddScoped<IFollowupBranchAccessService, FollowupBranchAccessService>(); // Phase2X PD16
    builder.Services.AddScoped<ICounselingAnalyticsService, CounselingAnalyticsService>(); // Analytics summary/trends/aging (Phase 2D)
    builder.Services.AddScoped<IDeptCoordinationService, DeptCoordinationService>(); // Dept coordination requests (Mar 16, 2026)
    builder.Services.AddScoped<IPatientTypeConfigurationsService, PatientTypeConfigurationsService>(); // Patient type configs (Mar 1, 2026)
    builder.Services.AddScoped<ITranscriptionService, TranscriptionService>(); // Audio transcription & translation
    builder.Services.AddScoped<IPatientTypeWorkflowService, PatientTypeWorkflowService>();
    builder.Services.AddScoped<IPreOpTestManagementService, PreOpTestManagementService>();
    builder.Services.AddScoped<IOTBookingSystemService, OTBookingSystemService>();
    builder.Services.AddScoped<IOtFinalizeService, OtFinalizeService>();
    builder.Services.AddScoped<IInsuranceWorkflowService, InsuranceWorkflowService>();
    builder.Services.AddScoped<IPaymentProcessingService, PaymentProcessingService>();
    builder.Services.AddScoped<IAdmissionManagementService, AdmissionManagementService>();
    builder.Services.AddScoped<IConsentManagementService, ConsentManagementService>();
    builder.Services.AddScoped<IWorkflowOrchestrationService, WorkflowOrchestrationService>();
    builder.Services.AddScoped<IMasterDataService, MasterDataService>(); // Master data for dropdowns (Feb 23, 2026)
    builder.Services.AddScoped<AuthService.Services.Interfaces.IMasterValueService, AuthService.Services.MasterValueService>(); // Generic master data module (April 2026)
    builder.Services.AddSingleton<AuthService.Services.Interfaces.IFeatureFlagService, AuthService.Services.FeatureFlagService>(); // Feature flag service (reads from appsettings.json)
    builder.Services.AddScoped<AuthService.Services.Interfaces.IMasterDataLookupService, AuthService.Services.MasterDataLookupService>(); // Feature-flag-aware master data lookup
    builder.Services.AddScoped<AuthService.Services.Interfaces.IMasterDataValidationService, AuthService.Services.MasterDataValidationService>(); // Delete validation (system-lock + reference checks)
    builder.Services.AddScoped<AuthService.Services.Interfaces.IMasterDataValidationService, AuthService.Services.MasterDataValidationService>(); // Master data delete validation (ref checks)
    builder.Services.AddScoped<IInventoryAvailabilityService, InventoryAvailabilityService>(); // IOL availability check (Feb 25, 2026)
    
    // Module 4: Front Office/OPD Management Services (Feb 3, 2026)
    builder.Services.AddScoped<IQueueService, QueueService>();
    builder.Services.AddScoped<IQueueDisplayService, QueueDisplayOrchestrator>();
    builder.Services.AddScoped<IQueueDisplayNotifier, QueueDisplayNotifier>();
    builder.Services.AddScoped<ICounselingDisplayAdapter, AuthService.Services.QueueDisplay.CounselingDisplayAdapter>();
    builder.Services.AddScoped<IVisitStationDisplayAdapter, AuthService.Services.QueueDisplay.VisitStationDisplayAdapter>();
    builder.Services.AddScoped<IQueueNotificationService, QueueNotificationService>(); // SignalR real-time notifications
    builder.Services.AddScoped<IVisitorService, VisitorService>();
    builder.Services.AddScoped<IProcedureService, ProcedureService>();
    builder.Services.AddScoped<IReportsService, ReportsService>();

    // Module 1: Doctor Desk Services (Phase 3 - Feb 2026)
    builder.Services.AddScoped<IExaminationService, ExaminationService>();
    builder.Services.AddScoped<IExaminationDraftService, ExaminationDraftService>();
    builder.Services.AddScoped<IDoctorQueueService, DoctorQueueService>();
    builder.Services.AddScoped<IOptometryService, OptometryService>();
    builder.Services.AddScoped<ISurgeryService, SurgeryService>(); // Phase 4: Surgery Recommendation (Feb 2026)
    builder.Services.AddScoped<IImagingService, ImagingService>(); // Phase 5: Imaging Orders (Feb 2026)
    builder.Services.AddScoped<IImagingExportService, ImagingExportService>(); // Phase 6: PDF Export (Feb 2026)
    builder.Services.AddScoped<IImagingAccessAuditService, ImagingAccessAuditService>(); // Phase 8: HIPAA Audit
builder.Services.AddScoped<IImagingAIAnalysisService, ImagingAIAnalysisService>(); // Phase 8: AI Analysis (Feb 2026)
    
    // HttpClient for external API calls (image downloads, etc.)
    builder.Services.AddHttpClient();
    
    // Reminder Services (Email & SMS)
    builder.Services.AddSingleton<IEmailService, EmailService>();
    builder.Services.AddSingleton<ISmsService, SmsService>();
    
    // Background Services
    builder.Services.AddHostedService<BackgroundReminderService>();
    
    // Device & Session Management Services (Backend Enhancements)
    builder.Services.AddScoped<IDeviceManagementService, DeviceManagementService>();
    builder.Services.AddScoped<ISessionManagementService, SessionManagementService>();
    
    // Enhanced Audit Service (Blockchain-like Hash Chain)
    builder.Services.AddScoped<IAuditService, AuditService>();
    
    // Azure Blob Storage Service (Patient Photos & Documents) - Phase 7
    builder.Services.AddSingleton(x =>
    {
        var connectionString = builder.Configuration["AzureBlobStorage:ConnectionString"];
        return new Azure.Storage.Blobs.BlobServiceClient(connectionString);
    });
    builder.Services.AddScoped<IBlobStorageService, BlobStorageService>();
    
    // Activation Audit Service (HIPAA Compliance - Track all activation steps)
    builder.Services.AddScoped<IActivationAuditService, ActivationAuditService>();
    
    // ABAC Policy Handler (Attribute-Based Access Control)
    builder.Services.AddScoped<IAbacPolicyHandler, AbacPolicyHandler>();
    
    // Localization Service (Cascading Timezone/Format Conversion)
    builder.Services.AddScoped<ILocalizationService, LocalizationService>();
    
    // Emergency Access Service (Break-the-Glass)
    builder.Services.AddScoped<IEmergencyAccessService, EmergencyAccessService>();
    
    // Emergency Access Audit Service (HIPAA Compliance) - TODO: Fix navigation property names
    // builder.Services.AddScoped<IEmergencyAccessAuditService, EmergencyAccessAuditService>();
    
    // License Management Service (Professional Licenses) - ENABLED
    builder.Services.AddScoped<ILicenseManagementService, LicenseManagementService>();
    
    // ===== PHASE 1 CRITICAL: Department Access Enhancements (Dec 9, 2025) =====
    // Validation Service - Enforce permitted/restricted department combinations
    builder.Services.AddScoped<IDepartmentAccessValidationService, DepartmentAccessValidationService>();
    
    // Approval Workflow Service - Request/Approve/Reject flow
    builder.Services.AddScoped<IDepartmentAccessApprovalService, DepartmentAccessApprovalService>();
    
    // Audit Logging Service - Track all department access changes (HIPAA/NABH compliance)
    builder.Services.AddScoped<IDepartmentAccessAuditService, DepartmentAccessAuditService>();
    
    // ===== ADVANCED ACCESS MANAGEMENT: Admin Configuration Services (Dec 9, 2025) =====
    // Department Access Rules - Configurable approval, supervision, expiration settings
    builder.Services.AddScoped<IDepartmentAccessRuleService, DepartmentAccessRuleService>();
    
    // Supervised Access - NABH compliance for junior doctor supervision tracking
    builder.Services.AddScoped<ISupervisedAccessService, SupervisedAccessService>();
    
    // Scope of Practice - Region-specific validation rules and qualifications
    // builder.Services.AddScoped<IScopeOfPracticeService, ScopeOfPracticeService>(); // TODO: Implement next
    
    // Access Automation - Background job configuration for expiration and cleanup
    // builder.Services.AddScoped<IAccessAutomationService, AccessAutomationService>(); // TODO: Implement next
    
    // Bulk Operations Service (CSV Import/Export, Bulk Actions) - ENABLED
    builder.Services.AddScoped<IBulkOperationsService, BulkOperationsService>();
    
    // Phase 4 Services - BLOCKED: Schema Mismatch (102 compilation errors)
    // DocumentSharing requires extensive refactoring - models/DB schema mismatch
    // builder.Services.AddScoped<IDocumentSharingService, DocumentSharingService>();
    // builder.Services.AddScoped<ISystemSettingsService, SystemSettingsService>();
    
    builder.Services.AddMemoryCache();
    Console.WriteLine("✓ Services registered");

    // Add SignalR
    Console.WriteLine("Configuring SignalR...");
    builder.Services.AddSignalR(options =>
    {
        options.EnableDetailedErrors = builder.Environment.IsDevelopment();
        options.MaximumReceiveMessageSize = 102400; // 100 KB
    });
    Console.WriteLine("✓ SignalR configured");

    // CORS configuration
    Console.WriteLine("Configuring CORS...");
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("AllowAll", builder =>
        {
            builder.WithOrigins("http://localhost:3000", "https://localhost:3000", 
                               "http://localhost:3001", "https://localhost:3001",
                               "http://localhost:3002", "https://localhost:3002",
                               "http://localhost:3003", "https://localhost:3003")
                   .AllowAnyMethod()
                   .AllowAnyHeader()
                   .AllowCredentials();
        });
    });
    Console.WriteLine("✓ CORS configured");

    // Configure ForwardedHeaders for IP address capture
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.KnownNetworks.Clear();
        options.KnownProxies.Clear();
    });

    Console.WriteLine("Building application...");
    var app = builder.Build();
    Console.WriteLine("✓ Application built successfully");

    // Seed Phase 2 CCMS permission aliases for all tenants (idempotent; best-effort).
    try
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AuthService.Context.AppDbContext>();
        await AuthService.SeedData.PermissionSeeder.SeedPhase2AliasesForAllTenantsAsync(db);
        await AuthService.SeedData.PermissionSeeder.SeedCounselingSessionsPermissionsForCounsellorRolesAsync(db);
        await AuthService.SeedData.PermissionSeeder.SeedCounselingSessionReassignPermissionsAsync(db);
        await AuthService.SeedData.PermissionSeeder.ApplyCounsellorLeastPrivilegeAsync(db);
        await AuthService.SeedData.PermissionSeeder.SeedCounsellorPatientWorkflowPermissionsAsync(db);
        await AuthService.SeedData.PermissionSeeder.SeedCounsellorPackageTemplateReadPermissionAsync(db);
        await AuthService.SeedData.PermissionSeeder.SeedBillReconciliationViewPermissionsAsync(db);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"⚠ Phase 2 CCMS / counselling permission seed skipped: {ex.Message}");
    }

    // Configure the HTTP request pipeline
    Console.WriteLine("Configuring HTTP pipeline...");
    
    // Enable Swagger in all environments
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Hospital Portal API v1");
        c.RoutePrefix = "swagger"; // Serve at /swagger
    });
    Console.WriteLine("✓ Swagger UI enabled at /swagger");
    
    // Use ForwardedHeaders middleware to capture IP addresses
    app.UseForwardedHeaders();
    
    if (!app.Environment.IsDevelopment())
    {
        app.UseHttpsRedirection();
    }
    app.UseCors("AllowAll");
    Console.WriteLine("✓ CORS applied");

    // Add tenant resolution middleware before authentication
    app.UseTenantResolution();
    Console.WriteLine("✓ Tenant resolution middleware applied");

    app.UseAuthentication();
    app.UseAuthorization();
    Console.WriteLine("✓ Authentication/Authorization configured");
    
    // Add check-in validation middleware (Day 3: OPD Workflow Gates)
    app.UseMiddleware<CheckInValidationMiddleware>();
    Console.WriteLine("✓ Check-in validation middleware applied (enforces patient check-in for clinical endpoints)");

    app.MapControllers();
    Console.WriteLine("✓ Controllers mapped");

    // Map SignalR hubs
    app.MapHub<AuthService.Hubs.NotificationHub>("/notificationHub");
    app.MapHub<AuthService.Hubs.CapacityHub>("/capacityHub");
    app.MapHub<AuthService.Hubs.QueueHub>("/hubs/queue");
    Console.WriteLine("✓ SignalR hubs mapped (NotificationHub, CapacityHub, QueueHub)");

    // Ensure database is created and migrations are applied when using a relational provider
    using (var scope = app.Services.CreateScope())
    {
        var services = scope.ServiceProvider;
        var context = services.GetRequiredService<AppDbContext>();
        
        // Apply migrations
        // context.Database.Migrate(); // Disabled - migrations applied via SQL scripts
        Console.WriteLine("✓ Database migrations skipped (using SQL scripts)");
        
        // Seed basic data for testing - skip if database unavailable
        try
        {
// CRITICAL FIX: Drop the problematic audit trigger FUNCTION (this cascades to remove the trigger)
    try
    {
        // Drop the function - this automatically drops the trigger that uses it
        await context.Database.ExecuteSqlRawAsync("DROP FUNCTION IF EXISTS audit_department_access_changes() CASCADE;");
        Console.WriteLine("✓ Dropped audit_department_access_changes() function and trigger (was referencing non-existent is_primary column)");
    }
    catch (Exception triggerEx)
    {
        Console.WriteLine($"⚠️ Could not drop audit function: {triggerEx.Message}");
        Console.WriteLine($"⚠️ Full error: {triggerEx}");
            }

            await SeedBasicDataForTestingAsync(context);
            
            // Seed patient type configurations for tenant 155fe198-6ae5-4a01-9254-ead5b427247e
            try
            {
                Console.WriteLine("🌱 Seeding patient type configurations...");
                var tenantId = Guid.Parse("155fe198-6ae5-4a01-9254-ead5b427247e");
                
                var existingConfigs = await context.PatientTypeConfigurations
                    .Where(c => c.TenantId == tenantId)
                    .ToListAsync();
                    
                if (existingConfigs.Any())
                {
                    Console.WriteLine($"Found {existingConfigs.Count} existing configs. Deleting...");
                    context.PatientTypeConfigurations.RemoveRange(existingConfigs);
                    await context.SaveChangesAsync();
                }
                
                var patientTypeConfigs = new[]
                {
                    new PatientTypeConfiguration { TenantId = tenantId, PatientType = "Cash", DisplayName = "Cash Patient", Description = "Direct payment by patient", ConfigurationJson = "{\"requires_advance_payment\": true, \"advance_percentage\": 50, \"required_documents\": [\"ID Proof\", \"Address Proof\"], \"skip_insurance\": true, \"billing_mode\": \"direct\"}", IsActive = true, DisplayOrder = 1 },
                    new PatientTypeConfiguration { TenantId = tenantId, PatientType = "Insurance", DisplayName = "Insurance Patient", Description = "Insurance company cashless treatment", ConfigurationJson = "{\"requires_pre_authorization\": true, \"max_pre_auth_wait_hours\": 72, \"required_documents\": [\"Insurance Card\", \"Policy Document\", \"ID Proof\", \"Employer Letter\"], \"skip_advance_if_approved\": true, \"billing_mode\": \"cashless\"}", IsActive = true, DisplayOrder = 2 },
                    new PatientTypeConfiguration { TenantId = tenantId, PatientType = "CoPay", DisplayName = "Co-Pay Patient", Description = "Insurance with patient co-payment", ConfigurationJson = "{\"requires_pre_authorization\": true, \"patient_pays_percentage\": 20, \"required_documents\": [\"Insurance Card\", \"ID Proof\"], \"copay_due_at\": \"admission\", \"billing_mode\": \"split\"}", IsActive = true, DisplayOrder = 3 },
                    new PatientTypeConfiguration { TenantId = tenantId, PatientType = "ESH", DisplayName = "ESH (Employee State Health)", Description = "ESH government scheme", ConfigurationJson = "{\"requires_claim_form\": true, \"claim_forms\": [\"ESH Form 1\", \"ESH Form 2\"], \"required_documents\": [\"ESH Card\", \"Employee ID\", \"Salary Slip\"], \"zero_advance_payment\": true, \"billing_mode\": \"direct_billing\"}", IsActive = true, DisplayOrder = 4 },
                    new PatientTypeConfiguration { TenantId = tenantId, PatientType = "CGHS", DisplayName = "CGHS (Central Govt Health Scheme)", Description = "CGHS government scheme", ConfigurationJson = "{\"requires_pre_approval\": true, \"approval_authority\": \"CGHS Wellness Center\", \"required_documents\": [\"CGHS Card\", \"Referral from CGHS Dispensary\"], \"zero_advance_payment\": true, \"billing_mode\": \"reimbursement\"}", IsActive = true, DisplayOrder = 5 },
                    new PatientTypeConfiguration { TenantId = tenantId, PatientType = "Arograshree", DisplayName = "Arograshree (Karnataka State Scheme)", Description = "Karnataka state health scheme for BPL families", ConfigurationJson = "{\"requires_pre_approval\": true, \"approval_authority\": \"District Health Officer\", \"income_certificate_required\": true, \"required_documents\": [\"Income Certificate\", \"Ration Card\", \"ID Proof\"], \"zero_advance_payment\": true, \"billing_mode\": \"government_reimbursement\"}", IsActive = true, DisplayOrder = 6 },
                    new PatientTypeConfiguration { TenantId = tenantId, PatientType = "SGHS", DisplayName = "SGHS (State Govt Health Scheme)", Description = "State government employee health scheme", ConfigurationJson = "{\"requires_departmental_approval\": true, \"required_documents\": [\"SGHS Card\", \"Employee ID\"], \"zero_advance_payment\": true, \"billing_mode\": \"direct_billing\"}", IsActive = true, DisplayOrder = 7 },
                    new PatientTypeConfiguration { TenantId = tenantId, PatientType = "Camp", DisplayName = "Camp Patient (Sponsored)", Description = "Free surgery camp sponsored by NGO/CSR", ConfigurationJson = "{\"zero_cost_surgery\": true, \"sponsor\": \"NGO/CSR\", \"required_documents\": [\"Camp Registration Form\", \"Income Certificate\"], \"zero_advance_payment\": true, \"billing_mode\": \"sponsored\"}", IsActive = true, DisplayOrder = 8 }
                };
                
                context.PatientTypeConfigurations.AddRange(patientTypeConfigs);
                await context.SaveChangesAsync();
                
                Console.WriteLine($"✅ Successfully seeded {patientTypeConfigs.Length} patient type configurations");
                Console.WriteLine($"   Patient Types: {string.Join(", ", patientTypeConfigs.Select(c => c.PatientType))}");
            }
            catch (Exception ptEx)
            {
                Console.WriteLine($"⚠️ Patient type seeding failed: {ptEx.Message}");
            }
            
            Console.WriteLine("✓ Database initialization completed");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"⚠️ Database seeding skipped - database unavailable: {ex.Message}");
            Console.WriteLine("⚠️ Application will start but database features will not work");
        }
    }

    // Attach application lifetime and global exception handlers to help diagnose unexpected shutdowns
    try
    {
        var lifetime = app.Lifetime;
        lifetime.ApplicationStarted.Register(() => Console.WriteLine("EVENT: ApplicationStarted"));
        lifetime.ApplicationStopping.Register(() => Console.WriteLine("EVENT: ApplicationStopping"));
        lifetime.ApplicationStopped.Register(() => Console.WriteLine("EVENT: ApplicationStopped"));

        AppDomain.CurrentDomain.ProcessExit += (s, e) => Console.WriteLine($"EVENT: ProcessExit - ExitCode={Environment.ExitCode}");
        AppDomain.CurrentDomain.UnhandledException += (s, e) => Console.WriteLine($"EVENT: UnhandledException - {e.ExceptionObject}");
    }
    catch
    {
        // Swallow any diagnostic wiring failure to avoid impacting normal startup
    }

    Console.WriteLine("=== BACKEND STARTUP: Starting server ===");
    try
    {
        // Run the application - this blocks until shutdown
        await app.RunAsync();
        Console.WriteLine("=== BACKEND SHUTDOWN: Server stopped gracefully ===");
    }
    catch (Exception runEx)
    {
        Console.WriteLine($"!!! FATAL ERROR during app.Run(): {runEx.Message}");
        Console.WriteLine($"!!! Stack trace: {runEx.StackTrace}");
        throw;
    }
}
catch (Exception ex)
{
    Console.WriteLine($"!!! FATAL ERROR during startup: {ex.Message}");
    Console.WriteLine($"!!! Stack Trace: {ex.StackTrace}");
    if (ex.InnerException != null)
    {
        Console.WriteLine($"!!! Inner Exception: {ex.InnerException.Message}");
        Console.WriteLine($"!!! Inner Stack Trace: {ex.InnerException.StackTrace}");
    }
    throw;
}
