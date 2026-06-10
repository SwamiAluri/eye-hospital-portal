'use client';

import { useEffect, useState } from 'react';
import { licensesApi, employeesApi } from '@/lib/api';
import { useCredentialTypes } from '@/hooks/use-hr-masters';

interface License {
  id: string;
  employeeId: string;
  licenseType: string;
  licenseNumber: string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  verificationStatus: string;
  verifiedAt?: string;
  verifiedByUserId?: string;
  daysUntilExpiry?: number;
  employee?: {
    employeeNumber?: string;
    jobTitle?: string;
    user?: {
      firstName?: string;
      lastName?: string;
      email?: string;
    };
  };
}

interface Employee {
  id: string;
  employeeNumber?: string;
  jobTitle?: string;
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

export default function LicensesPage() {
  const { types: credentialTypes } = useCredentialTypes();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [statistics, setStatistics] = useState({
    expiring30Days: 0,
    expiring60Days: 0,
    expiring90Days: 0,
    expired: 0,
    pendingVerification: 0,
    verified: 0
  });

  // Form state
  const [formData, setFormData] = useState({
    employeeId: '',
    licenseType: '',
    licenseNumber: '',
    issuingAuthority: '',
    issueDate: '',
    expiryDate: '',
    documentUrl: ''
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [licenseTypeFilter, setLicenseTypeFilter] = useState('');
  const [verificationStatusFilter, setVerificationStatusFilter] = useState('');
  const [expiringFilter, setExpiringFilter] = useState(false);
  const [expiringInDays, setExpiringInDays] = useState(90);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchLicenses();
    fetchEmployees();
    fetchStatistics();
  }, [currentPage, searchTerm, licenseTypeFilter, verificationStatusFilter, expiringFilter, expiringInDays]);

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: currentPage,
        pageSize: itemsPerPage
      };

      if (searchTerm) params.searchTerm = searchTerm;
      if (licenseTypeFilter) params.licenseType = licenseTypeFilter;
      if (verificationStatusFilter) params.verificationStatus = verificationStatusFilter;
      if (expiringFilter) {
        params.expiringOnly = true;
        params.expiringInDays = expiringInDays;
      }

      const res = await licensesApi.getAll(params);
      console.log('📋 License API Response:', res.data);
      setLicenses(res.data.items || res.data.licenses || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err: any) {
      console.error('Error fetching licenses:', err);
      setError(err.response?.data?.message || 'Failed to fetch licenses');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await employeesApi.getAll({ page: 1, pageSize: 1000 });
      setEmployees(res.data.employees || []);
    } catch (err: any) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchStatistics = async () => {
    try {
      const res = await licensesApi.getStatistics();
      setStatistics(res.data);
    } catch (err: any) {
      console.error('Error fetching statistics:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (editingLicense) {
        await licensesApi.update(editingLicense.id, formData);
      } else {
        await licensesApi.create(formData);
      }
      setShowForm(false);
      setEditingLicense(null);
      resetForm();
      fetchLicenses();
      fetchStatistics();
    } catch (err: any) {
      console.error('Error saving license:', err);
      setError(err.response?.data?.message || 'Failed to save license');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (license: License) => {
    setEditingLicense(license);
    setFormData({
      employeeId: license.employeeId,
      licenseType: license.licenseType,
      licenseNumber: license.licenseNumber,
      issuingAuthority: license.issuingAuthority,
      issueDate: license.issueDate ? license.issueDate.split('T')[0] : '',
      expiryDate: license.expiryDate ? license.expiryDate.split('T')[0] : '',
      documentUrl: ''
    });
    setShowForm(true);
  };

  const handleVerify = async (licenseId: string, approved: boolean) => {
    try {
      await licensesApi.verify(licenseId, { approved, verificationNotes: '' });
      fetchLicenses();
      fetchStatistics();
    } catch (err: any) {
      console.error('Error verifying license:', err);
      setError(err.response?.data?.message || 'Failed to verify license');
    }
  };

  const handleRenew = async (licenseId: string) => {
    const newExpiryDate = prompt('Enter new expiry date (YYYY-MM-DD):');
    if (!newExpiryDate) return;

    try {
      await licensesApi.renew(licenseId, { newExpiryDate });
      fetchLicenses();
      fetchStatistics();
    } catch (err: any) {
      console.error('Error renewing license:', err);
      setError(err.response?.data?.message || 'Failed to renew license');
    }
  };

  const handleDelete = async (licenseId: string) => {
    if (!confirm('Are you sure you want to delete this license?')) return;

    try {
      await licensesApi.delete(licenseId);
      fetchLicenses();
      fetchStatistics();
    } catch (err: any) {
      console.error('Error deleting license:', err);
      setError(err.response?.data?.message || 'Failed to delete license');
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      licenseType: '',
      licenseNumber: '',
      issuingAuthority: '',
      issueDate: '',
      expiryDate: '',
      documentUrl: ''
    });
  };

  const getExpiryBadgeColor = (days?: number) => {
    if (!days) return 'bg-gray-100 text-gray-800';
    if (days < 0) return 'bg-red-100 text-red-800';
    if (days <= 30) return 'bg-orange-100 text-orange-800';
    if (days <= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getVerificationBadgeColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Professional Licenses</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingLicense(null);
              resetForm();
              setShowForm(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Add License
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <div className="text-red-600 text-sm font-medium">Expired</div>
          <div className="text-2xl font-bold text-red-700">{statistics.expired}</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
          <div className="text-orange-600 text-sm font-medium">30 Days</div>
          <div className="text-2xl font-bold text-orange-700">{statistics.expiring30Days}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <div className="text-yellow-600 text-sm font-medium">60 Days</div>
          <div className="text-2xl font-bold text-yellow-700">{statistics.expiring60Days}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <div className="text-blue-600 text-sm font-medium">90 Days</div>
          <div className="text-2xl font-bold text-blue-700">{statistics.expiring90Days}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <div className="text-yellow-600 text-sm font-medium">Pending</div>
          <div className="text-2xl font-bold text-yellow-700">{statistics.pendingVerification}</div>
        </div>
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <div className="text-green-600 text-sm font-medium">Verified</div>
          <div className="text-2xl font-bold text-green-700">{statistics.verified}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <select
            value={licenseTypeFilter}
            onChange={(e) => setLicenseTypeFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">All License Types</option>
            {credentialTypes.map((t) => (
              <option key={t.value} value={t.label}>{t.label}</option>
            ))}
          </select>
          <select
            value={verificationStatusFilter}
            onChange={(e) => setVerificationStatusFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={expiringFilter}
              onChange={(e) => setExpiringFilter(e.target.checked)}
              className="rounded"
            />
            <label className="text-sm">Expiring in</label>
            <select
              value={expiringInDays}
              onChange={(e) => setExpiringInDays(Number(e.target.value))}
              disabled={!expiringFilter}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
          </div>
          <button
            onClick={() => {
              setSearchTerm('');
              setLicenseTypeFilter('');
              setVerificationStatusFilter('');
              setExpiringFilter(false);
            }}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingLicense ? 'Edit License' : 'Add New License'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Employee *</label>
                <select
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  required
                  disabled={!!editingLicense}
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user?.firstName} {emp.user?.lastName} - {emp.employeeNumber || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">License Type *</label>
                  <select
                    value={formData.licenseType}
                    onChange={(e) => setFormData({ ...formData, licenseType: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  >
                    <option value="">Select Type</option>
                    {credentialTypes.map((t) => (
                      <option key={t.value} value={t.label}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">License Number *</label>
                  <input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Issuing Authority *</label>
                <input
                  type="text"
                  value={formData.issuingAuthority}
                  onChange={(e) => setFormData({ ...formData, issuingAuthority: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., State Medical Board"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Issue Date *</label>
                  <input
                    type="date"
                    value={formData.issueDate}
                    onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Expiry Date *</label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Document URL</label>
                <input
                  type="url"
                  value={formData.documentUrl}
                  onChange={(e) => setFormData({ ...formData, documentUrl: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                  placeholder="https://..."
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingLicense(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? 'Saving...' : editingLicense ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Licenses Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">License Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">License Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issuing Authority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  Loading licenses...
                </td>
              </tr>
            ) : licenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  No licenses found
                </td>
              </tr>
            ) : (
              licenses.map((license) => (
                <tr key={license.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      User ID: {license.userId?.substring(0, 8)}...
                    </div>
                    <div className="text-sm text-gray-500">Employee data pending</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{license.licenseType}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{license.licenseNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{license.issuingAuthority}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {license.expiryDate ? new Date(license.expiryDate).toLocaleDateString() : 'N/A'}
                    </div>
                    <span className={`inline-flex text-xs px-2 py-1 rounded ${getExpiryBadgeColor(license.daysUntilExpiry)}`}>
                      {license.daysUntilExpiry !== undefined
                        ? license.daysUntilExpiry < 0
                          ? `Expired ${Math.abs(license.daysUntilExpiry)}d ago`
                          : `${license.daysUntilExpiry}d left`
                        : 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex text-xs px-2 py-1 rounded ${getVerificationBadgeColor(license.verificationStatus)}`}>
                      {license.verificationStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(license)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      {license.verificationStatus === 'pending' && (
                        <>
                          <button
                            onClick={() => handleVerify(license.id, true)}
                            className="text-green-600 hover:text-green-800"
                          >
                            Verify
                          </button>
                          <button
                            onClick={() => handleVerify(license.id, false)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleRenew(license.id)}
                        className="text-purple-600 hover:text-purple-800"
                      >
                        Renew
                      </button>
                      <button
                        onClick={() => handleDelete(license.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-6">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
