using InventoryApi.Data;
using InventoryApi.Models.DTOs;
using InventoryApi.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace InventoryApi.Services;

public interface IVendorService
{
    Task<PagedResult<VendorDto>> ListAsync(Guid tenantId, int page, int pageSize,
        string? category, bool? isPreferred, CancellationToken ct);
    Task<VendorDto?> GetAsync(Guid tenantId, Guid id, CancellationToken ct);
    Task<VendorDto> CreateAsync(Guid tenantId, Guid userId, CreateVendorRequest req, CancellationToken ct);
    Task<VendorDto?> UpdateAsync(Guid tenantId, Guid id, Guid userId, CreateVendorRequest req, CancellationToken ct);
    Task<bool> DeleteAsync(Guid tenantId, Guid id, Guid userId, CancellationToken ct);
}

public sealed class VendorService : IVendorService
{
    private readonly InventoryDbContext _db;

    public VendorService(InventoryDbContext db) => _db = db;

    public async Task<PagedResult<VendorDto>> ListAsync(
        Guid tenantId, int page, int pageSize,
        string? category, bool? isPreferred, CancellationToken ct)
    {
        var q = _db.Vendors.Where(v => v.TenantId == tenantId && v.DeletedAt == null);
        if (!string.IsNullOrWhiteSpace(category))
            q = q.Where(v => v.VendorCategory == category);
        if (isPreferred.HasValue)
            q = q.Where(v => v.IsPreferred == isPreferred.Value);

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderByDescending(v => v.IsPreferred)
            .ThenBy(v => v.Name)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(v => ToDto(v))
            .ToListAsync(ct);
        return new PagedResult<VendorDto>(items, total, page, pageSize);
    }

    public async Task<VendorDto?> GetAsync(Guid tenantId, Guid id, CancellationToken ct)
    {
        var v = await _db.Vendors.FirstOrDefaultAsync(
            x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null, ct);
        return v is null ? null : ToDto(v);
    }

    public async Task<VendorDto> CreateAsync(
        Guid tenantId, Guid userId, CreateVendorRequest req, CancellationToken ct)
    {
        var vendor = new Vendor
        {
            Id                      = Guid.NewGuid(),
            TenantId                = tenantId,
            Name                    = req.Name,
            // VendorCode is left null — DB trigger auto-generates it
            VendorCategory          = string.IsNullOrWhiteSpace(req.VendorCategory) ? "general" : req.VendorCategory,
            IsPreferred             = req.IsPreferred,
            IsConsignmentVendor     = req.IsConsignmentVendor,
            ContactPerson           = req.ContactPerson,
            Phone                   = req.Phone,
            Email                   = req.Email,
            Address                 = req.Address,
            RegisteredAddress       = req.RegisteredAddress,
            Website                 = req.Website,
            GstNumber               = req.GstNumber,
            PanNumber               = req.PanNumber,
            CinNumber               = req.CinNumber,
            DrugLicenseNumber       = req.DrugLicenseNumber,
            DrugLicenseExpiry       = req.DrugLicenseExpiry,
            DrugLicense20B          = req.DrugLicense20B,
            DrugLicense20BExpiry    = req.DrugLicense20BExpiry,
            DrugLicense21B          = req.DrugLicense21B,
            DrugLicense21BExpiry    = req.DrugLicense21BExpiry,
            ApmcRegistration        = req.ApmcRegistration,
            FoodLicenseNumber       = req.FoodLicenseNumber,
            ImportExportCode        = req.ImportExportCode,
            SwiftCode               = req.SwiftCode,
            LatePaymentInterestRate = req.LatePaymentInterestRate,
            IsColdChainVendor       = req.IsColdChainVendor,
            BankName                = req.BankName,
            BankAccountNumber       = req.BankAccountNumber,
            BankIfscCode            = req.BankIfscCode,
            BankAccountHolderName   = req.BankAccountHolderName,
            BankAccountType         = string.IsNullOrWhiteSpace(req.BankAccountType) ? "current" : req.BankAccountType,
            CreditDays              = req.CreditDays,
            CreatedAt               = DateTime.UtcNow,
            UpdatedAt               = DateTime.UtcNow,
            CreatedByUserId         = userId,
            UpdatedByUserId         = userId
        };
        _db.Vendors.Add(vendor);
        await _db.SaveChangesAsync(ct);

        // Reload to pick up DB-generated vendor_code
        await _db.Entry(vendor).ReloadAsync(ct);
        return ToDto(vendor);
    }

    public async Task<VendorDto?> UpdateAsync(
        Guid tenantId, Guid id, Guid userId, CreateVendorRequest req, CancellationToken ct)
    {
        var vendor = await _db.Vendors.FirstOrDefaultAsync(
            x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null, ct);
        if (vendor is null) return null;

        vendor.Name                    = req.Name;
        vendor.VendorCategory          = string.IsNullOrWhiteSpace(req.VendorCategory) ? vendor.VendorCategory : req.VendorCategory;
        vendor.IsPreferred             = req.IsPreferred;
        vendor.IsConsignmentVendor     = req.IsConsignmentVendor;
        vendor.ContactPerson           = req.ContactPerson;
        vendor.Phone                   = req.Phone;
        vendor.Email                   = req.Email;
        vendor.Address                 = req.Address;
        vendor.RegisteredAddress       = req.RegisteredAddress;
        vendor.Website                 = req.Website;
        vendor.GstNumber               = req.GstNumber;
        vendor.PanNumber               = req.PanNumber;
        vendor.CinNumber               = req.CinNumber;
        vendor.DrugLicenseNumber       = req.DrugLicenseNumber;
        vendor.DrugLicenseExpiry       = req.DrugLicenseExpiry;
        vendor.DrugLicense20B          = req.DrugLicense20B;
        vendor.DrugLicense20BExpiry    = req.DrugLicense20BExpiry;
        vendor.DrugLicense21B          = req.DrugLicense21B;
        vendor.DrugLicense21BExpiry    = req.DrugLicense21BExpiry;
        vendor.ApmcRegistration        = req.ApmcRegistration;
        vendor.FoodLicenseNumber       = req.FoodLicenseNumber;
        vendor.ImportExportCode        = req.ImportExportCode;
        vendor.SwiftCode               = req.SwiftCode;
        vendor.LatePaymentInterestRate = req.LatePaymentInterestRate;
        vendor.IsColdChainVendor       = req.IsColdChainVendor;
        vendor.BankName                = req.BankName;
        vendor.BankAccountNumber       = req.BankAccountNumber;
        vendor.BankIfscCode            = req.BankIfscCode;
        vendor.BankAccountHolderName   = req.BankAccountHolderName;
        if (!string.IsNullOrWhiteSpace(req.BankAccountType))
            vendor.BankAccountType     = req.BankAccountType;
        vendor.CreditDays              = req.CreditDays;
        if (!string.IsNullOrWhiteSpace(req.Status))
            vendor.Status              = req.Status;
        vendor.UpdatedAt               = DateTime.UtcNow;
        vendor.UpdatedByUserId         = userId;

        await _db.SaveChangesAsync(ct);
        return ToDto(vendor);
    }

    public async Task<bool> DeleteAsync(Guid tenantId, Guid id, Guid userId, CancellationToken ct)
    {
        var vendor = await _db.Vendors.FirstOrDefaultAsync(
            x => x.Id == id && x.TenantId == tenantId && x.DeletedAt == null, ct);
        if (vendor is null) return false;
        vendor.DeletedAt      = DateTime.UtcNow;
        vendor.Status         = "inactive";
        vendor.UpdatedByUserId = userId;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private static VendorDto ToDto(Vendor v) => new(
        v.Id,
        v.Name,
        v.VendorCode,
        v.VendorCategory,
        v.IsPreferred,
        v.ContactPerson,
        v.Phone,
        v.Email,
        v.Address,
        v.RegisteredAddress,
        v.Website,
        v.GstNumber,
        v.PanNumber,
        v.CinNumber,
        v.DrugLicenseNumber,
        v.DrugLicenseExpiry,
        v.DrugLicense20B,
        v.DrugLicense20BExpiry,
        v.DrugLicense21B,
        v.DrugLicense21BExpiry,
        v.ApmcRegistration,
        v.FoodLicenseNumber,
        v.ImportExportCode,
        v.SwiftCode,
        v.LatePaymentInterestRate,
        v.IsColdChainVendor,
        v.BankName,
        v.BankAccountNumber,
        v.BankIfscCode,
        v.BankAccountHolderName,
        v.BankAccountType,
        v.CreditDays,
        v.OutstandingBalance,
        v.Status,
        v.IsConsignmentVendor);
}
