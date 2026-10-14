using AuthService.Authorization;
using AuthService.Context;
using AuthService.Controllers;
using AuthService.Models.Domain;
using AuthService.Models.Identity;
using AuthService.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AuthService.Tests;

/// <summary>
/// Patient appointment list must omit soft-deleted rows. Tenant and permission stay as they are.
/// </summary>
public class PatientAppointmentSoftDeleteReadTests
{
    private static readonly Guid TenantId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid OtherTenantId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid PatientId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid DoctorId = Guid.Parse("55555555-5555-5555-5555-555555555555");

    [Fact]
    public async Task ActiveAppointment_IsReturned()
    {
        await using var db = CreateDb();
        var active = Appointment(TenantId, PatientId, deleted: null);
        await Seed(db, active);

        var result = await Service(db).GetPatientAppointmentsAsync(PatientId, TenantId);

        Assert.Contains(result.Items, item => item.Id == active.Id);
        Assert.Equal(1, result.TotalCount);
    }

    [Fact]
    public async Task SoftDeletedAppointment_IsExcluded()
    {
        await using var db = CreateDb();
        await Seed(db, Appointment(TenantId, PatientId, deleted: DateTime.UtcNow));

        var result = await Service(db).GetPatientAppointmentsAsync(PatientId, TenantId);

        Assert.Empty(result.Items);
        Assert.Equal(0, result.TotalCount);
    }

    [Fact]
    public async Task MixedAppointments_ReturnOnlyTheActiveRow()
    {
        await using var db = CreateDb();
        var active = Appointment(TenantId, PatientId, deleted: null);
        await Seed(db, active, Appointment(TenantId, PatientId, deleted: DateTime.UtcNow));

        var result = await Service(db).GetPatientAppointmentsAsync(PatientId, TenantId);

        Assert.Equal(active.Id, Assert.Single(result.Items).Id);
        Assert.Equal(1, result.TotalCount);
    }

    [Fact]
    public async Task OtherTenantAppointment_StaysHidden()
    {
        await using var db = CreateDb();
        await Seed(db, Appointment(OtherTenantId, PatientId, deleted: null));

        var result = await Service(db).GetPatientAppointmentsAsync(PatientId, TenantId);

        Assert.Empty(result.Items);
    }

    [Fact]
    public void PatientRead_KeepsAppointmentViewPermission()
    {
        var method = typeof(AppointmentsController).GetMethod(nameof(AppointmentsController.GetPatientAppointments));
        Assert.NotNull(method);
        var permission = Assert.Single(method!.GetCustomAttributes(typeof(RequirePermissionAttribute), false))
            as RequirePermissionAttribute;
        Assert.Equal("appointment.view", permission!.PermissionCode);
    }

    private static AppointmentService Service(AppDbContext db) =>
        new(db, NullLogger<AppointmentService>.Instance);

    private static async Task Seed(AppDbContext db, params Appointment[] appointments)
    {
        db.Users.Add(new AppUser
        {
            Id = DoctorId,
            UserName = "doctor.apt",
            NormalizedUserName = "DOCTOR.APT",
            Email = "doctor.apt@example.test",
            NormalizedEmail = "DOCTOR.APT@EXAMPLE.TEST",
            TenantId = TenantId,
            FirstName = "Ada",
            LastName = "Sen",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        db.Patients.Add(new Patient
        {
            Id = PatientId,
            TenantId = TenantId,
            MedicalRecordNumber = "MRN-APT",
            FirstName = "Asha",
            LastName = "Rao",
            Gender = "Female",
            DateOfBirth = new DateTime(1990, 1, 1),
        });
        db.Appointments.AddRange(appointments);
        await db.SaveChangesAsync();
    }

    private static Appointment Appointment(Guid tenantId, Guid patientId, DateTime? deleted) =>
        new()
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PatientId = patientId,
            DoctorId = DoctorId,
            AppointmentDate = new DateTime(2026, 9, 30, 9, 30, 0, DateTimeKind.Utc),
            AppointmentType = "Follow-up",
            DurationMinutes = 15,
            Status = "Scheduled",
            DeletedAt = deleted,
        };

    private static AppDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AppDbContext(options, new HttpContextAccessor());
    }
}
