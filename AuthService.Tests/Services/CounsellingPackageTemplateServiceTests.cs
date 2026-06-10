using System;
using System.Linq;
using System.Threading.Tasks;
using AuthService.Context;
using AuthService.Models.Counselor;
using AuthService.Models.Domain;
using AuthService.Models.MasterData;
using AuthService.Services;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace AuthService.Tests.Services
{
    public class CounsellingPackageTemplateServiceTests : IDisposable
    {
        private readonly AppDbContext _context;
        private readonly CounsellingPackageTemplateService _service;
        private readonly Guid _tenantId = Guid.NewGuid();
        private readonly Guid _userId = Guid.NewGuid();

        public CounsellingPackageTemplateServiceTests()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;

            _context = new AppDbContext(options);
            _service = new CounsellingPackageTemplateService(_context, NullLogger<CounsellingPackageTemplateService>.Instance);
        }

        public void Dispose()
        {
            _context.Database.EnsureDeleted();
            _context.Dispose();
        }

        [Fact]
        public async Task CreateAsync_ValidRequest_PersistsTemplate()
        {
            var created = await _service.CreateAsync(_tenantId, new CreateCounsellingPackageTemplateRequest
            {
                Code = "CAT-TEST",
                Name = "Test Cataract Package",
                Category = "Cataract",
                PackageAmount = 42000m,
                MaxDiscountPercent = 40m,
                InvestigationIds = new() { Guid.NewGuid().ToString() },
                IsDefault = true,
            }, _userId);

            created.Should().NotBeNull();
            created.Code.Should().Be("CAT-TEST");
            created.PackageAmount.Should().Be(42000m);
            created.InvestigationIds.Should().HaveCount(1);

            var listed = await _service.GetAllAsync(_tenantId);
            listed.Should().ContainSingle(t => t.Code == "CAT-TEST");
        }

        [Fact]
        public async Task CreateAsync_DuplicateCode_Throws()
        {
            await _service.CreateAsync(_tenantId, new CreateCounsellingPackageTemplateRequest
            {
                Code = "DUP",
                Name = "First",
                PackageAmount = 1000m,
            }, _userId);

            var act = () => _service.CreateAsync(_tenantId, new CreateCounsellingPackageTemplateRequest
            {
                Code = "DUP",
                Name = "Second",
                PackageAmount = 2000m,
            }, _userId);

            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("*DUP*");
        }

        [Fact]
        public async Task UpdateAsync_ChangesAmountAndInvestigations()
        {
            var created = await _service.CreateAsync(_tenantId, new CreateCounsellingPackageTemplateRequest
            {
                Code = "UPD",
                Name = "Before",
                PackageAmount = 30000m,
            }, _userId);

            var invId = Guid.NewGuid().ToString();
            var updated = await _service.UpdateAsync(_tenantId, created.Id, new UpdateCounsellingPackageTemplateRequest
            {
                Name = "After",
                PackageAmount = 35000m,
                InvestigationIds = new() { invId },
            }, _userId);

            updated.Name.Should().Be("After");
            updated.PackageAmount.Should().Be(35000m);
            updated.InvestigationIds.Should().ContainSingle().Which.Should().Be(invId);
        }

        [Fact]
        public async Task DeleteAsync_SoftDeletesTemplate()
        {
            var created = await _service.CreateAsync(_tenantId, new CreateCounsellingPackageTemplateRequest
            {
                Code = "DEL",
                Name = "Delete Me",
                PackageAmount = 1000m,
            }, _userId);

            var deleted = await _service.DeleteAsync(_tenantId, created.Id, _userId);
            deleted.Should().BeTrue();

            var active = await _service.GetAllAsync(_tenantId, isActive: true);
            active.Should().BeEmpty();

            var row = await _context.CounsellingPackageTemplates.FirstAsync(t => t.Id == created.Id);
            row.DeletedAt.Should().NotBeNull();
        }

        [Fact]
        public async Task UpdateSettingsAsync_PersistsPercentAndFlatCap()
        {
            var settings = await _service.UpdateSettingsAsync(_tenantId, new UpdateCounsellingSettingsRequest
            {
                MaxDiscountPercent = 45m,
                MaxDiscountFlat = 15000m,
            }, _userId);

            settings.MaxDiscountPercent.Should().Be(45m);
            settings.MaxDiscountFlat.Should().Be(15000m);

            var reloaded = await _service.GetSettingsAsync(_tenantId);
            reloaded.MaxDiscountPercent.Should().Be(45m);
            reloaded.MaxDiscountFlat.Should().Be(15000m);

            var row = await _context.MasterValues.FirstAsync(m =>
                m.TenantId == _tenantId &&
                m.EntityType == "counsellor.settings" &&
                m.Code == "max_discount_percent");
            row.Metadata.Should().Contain("45");
            row.Metadata.Should().Contain("15000");
        }
    }
}
