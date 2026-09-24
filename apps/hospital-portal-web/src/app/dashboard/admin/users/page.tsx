'use client';

import { useEffect, useState } from 'react';
import { usersApi, rolesApi, departmentsApi, branchesApi, permissionsApi } from '@/lib/api';
import Link from 'next/link';
import { useConfirmation } from '@/components/common/ConfirmationDialog';
import UserForm from '@/components/admin/UserForm';
import UserDepartmentAccessModal from '@/components/admin/UserDepartmentAccessModal';
import BranchAssignmentModal from '@/components/admin/BranchAssignmentModal';
import UserActivationModal from '@/components/admin/UserActivationModal';
import AdminMfaResetModal from '@/components/admin/AdminMfaResetModal';

interface UserRow {
  id: string;
  userName: string;
  email: string;
  phoneNumber?: string;
  firstName: string;
  lastName: string;
  userType: string;
  userStatus: string;
  employeeId?: string;
  designation?: string;
  qualifications?: string;
  specialization?: string;
  licenseNumber?: string;
  dateOfBirth?: string;
  gender?: string;
  branchId?: string;
  departmentId?: string;
  roleId?: string;
  roles?: string[];
  departments?: Array<{ departmentId: string; departmentName: string; isPrimary: boolean }>;
  primaryDepartment?: string;
  branch?: string;
  permissions?: Array<{ id: string; code: string; name: string; module: string }>;
  permissionsLoading?: boolean;
}

export default function UsersPage() {
  const { showConfirmation, ConfirmationComponent } = useConfirmation();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showMfaResetModal, setShowMfaResetModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedUserName, setSelectedUserName] = useState<string>('');
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>('');
  const [selectedUserPhone, setSelectedUserPhone] = useState<string>('');  
  const [expandedPermissions, setExpandedPermissions] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Filter options
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; departmentName: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await usersApi.getAllWithDetails();
      console.log('Users API response:', res);
      console.log('Users data:', res.data);
      console.log('Number of users:', res.data?.length);
      setUsers(res.data || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.response?.data?.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const [rolesRes, deptsRes, branchesRes] = await Promise.all([
        rolesApi.getAll(),
        departmentsApi.getAll(),
        branchesApi.getAll(),
      ]);
      console.log('Roles response:', rolesRes.data);
      console.log('Departments response:', deptsRes.data);
      console.log('Branches response:', branchesRes.data);
      
      // Filter out roles with empty/null names to prevent white space in dropdown
      const validRoles = Array.isArray(rolesRes.data) 
        ? rolesRes.data.filter(r => r.name && r.name.trim().length > 0) 
        : [];
      setRoles(validRoles);
      
      setDepartments(Array.isArray(deptsRes.data) ? deptsRes.data : []);
      // Branches API returns { branches: [], totalCount, ... }
      setBranches(branchesRes.data?.branches || branchesRes.data || []);
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchFilterOptions();
  }, []);

  const handleEdit = (user: UserRow) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleViewPermissions = async (user: UserRow) => {
    if (expandedPermissions === user.id) {
      setExpandedPermissions(null);
      return;
    }

    // Toggle expansion
    setExpandedPermissions(user.id);

    // If permissions not loaded, fetch them
    if (!user.permissions) {
      // Mark as loading
      setUsers(prevUsers => prevUsers.map(u => 
        u.id === user.id ? { ...u, permissionsLoading: true } : u
      ));

      try {
        const response = await permissionsApi.getUserPermissions(user.id);
        console.log('User permissions response:', response.data);
        
        // Extract permissions from response
        const permissions = response.data?.permissions || [];
        
        // Update user with permissions
        setUsers(prevUsers => prevUsers.map(u => 
          u.id === user.id ? { ...u, permissions, permissionsLoading: false } : u
        ));
      } catch (err: any) {
        console.error('Error fetching user permissions:', err);
        setUsers(prevUsers => prevUsers.map(u => 
          u.id === user.id ? { ...u, permissions: [], permissionsLoading: false } : u
        ));
        setError(err.response?.data?.message || 'Failed to fetch permissions');
      }
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    try {
      await usersApi.deactivate(id);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to deactivate user');
    }
  };

  const handleManageDepartments = (user: UserRow) => {
    setSelectedUserId(user.id);
    // Use userName if available, fallback to firstName + lastName, or email
    const displayName = user.userName || 
                        (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null) || 
                        user.email || 
                        'Unknown User';
    setSelectedUserName(displayName);
    setShowDepartmentModal(true);
  };

  const handleManageBranches = (user: UserRow) => {
    setSelectedUserId(user.id);
    const displayName = user.userName || 
                        (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null) || 
                        user.email || 
                        'Unknown User';
    setSelectedUserName(displayName);
    setShowBranchModal(true);
  };

  const handleActivateUser = (user: UserRow) => {
    setSelectedUserId(user.id);
    const displayName = user.userName || 
                        (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null) || 
                        user.email || 
                        'Unknown User';
    setSelectedUserName(displayName);
    setSelectedUserEmail(user.email);
    setSelectedUserPhone(user.phoneNumber || '');
    setShowActivationModal(true);
  };

  const handleResetMfa = (user: UserRow) => {
    setSelectedUserId(user.id);
    const displayName = user.userName || 
                        (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null) || 
                        user.email || 
                        'Unknown User';
    setSelectedUserName(displayName);
    setSelectedUserEmail(user.email);
    setShowMfaResetModal(true);
  };

  const handleResetPassword = (user: UserRow) => {
    const displayName = user.userName || `${user.firstName} ${user.lastName}`;
    showConfirmation({
      title: 'Send Password Reset',
      message: `Send password reset email to ${displayName} (${user.email})?`,
      variant: 'info',
      confirmText: 'Send Email',
      onConfirm: async () => {
        try {
          setError('');
          await usersApi.requestPasswordReset(user.id);
        } catch (err: any) {
          const message =
            err.response?.data?.message ||
            err.message ||
            'Failed to send password reset email';
          setError(message);
          // Re-throw so ConfirmationDialog stays open and does not treat as success.
          throw err;
        }
      },
    });
  };

  // Apply filters
  const filteredUsers = users.filter(u => {
    const matchesSearch = searchTerm === '' ||
      u.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.userName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === '' || (u.roles && u.roles.includes(roleFilter));
    const matchesDept = departmentFilter === '' || 
      (u.departments && u.departments.some(d => d.departmentName === departmentFilter));
    const matchesBranch = branchFilter === '' || u.branch === branchFilter;
    
    return matchesSearch && matchesRole && matchesDept && matchesBranch;
  });

  // Pagination calculations
  const totalUsers = filteredUsers.length;
  const totalPages = Math.ceil(totalUsers / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, departmentFilter, branchFilter]);

  return (
    <div className="flex flex-col">
      <ConfirmationComponent />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-gray-600 mt-1">
            Showing {totalUsers > 0 ? startIndex + 1 : 0}-{Math.min(endIndex, totalUsers)} of {totalUsers} users
            {(searchTerm || roleFilter || departmentFilter || branchFilter) && ' (filtered)'}
          </p>
        </div>
        <div>
          <button
            onClick={handleCreate}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            Create User
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-3 mb-3 grid grid-cols-4 gap-3 flex-shrink-0">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            disabled={loading}
          >
            <option value="">All Roles ({roles.length})</option>
            {roles.map(r => (
              <option key={r.id} value={r.name}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            disabled={loading}
          >
            <option value="">All Departments ({departments.length})</option>
            {departments.map(d => (
              <option key={d.id} value={d.departmentName}>{d.departmentName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            disabled={loading}
          >
            <option value="">All Branches ({branches.length})</option>
            {branches.map(b => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow flex flex-col">
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Departments</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      <span className="ml-3">Loading users...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.map((u) => (
              <>
              <tr key={u.id}>
                <td className="px-4 py-3 whitespace-nowrap">{u.firstName} {u.lastName}</td>
                <td className="px-4 py-3 whitespace-nowrap">{u.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.roles && u.roles.length > 0 ? (
                      u.roles.map((role, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                          {role}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 text-sm">No roles</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    {u.departments && u.departments.length > 0 ? (
                      <>
                        {u.departments.slice(0, 2).map((dept, idx) => (
                          <span key={idx} className="text-sm">
                            {dept.departmentName}
                            {dept.isPrimary && (
                              <span className="ml-1 text-xs text-indigo-600 font-medium">(Primary)</span>
                            )}
                          </span>
                        ))}
                        {u.departments.length > 2 && (
                          <button
                            onClick={() => handleManageDepartments(u)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 text-left"
                          >
                            +{u.departments.length - 2} more
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400 text-sm">No departments</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {u.branch || <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    u.userStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {u.userStatus || 'active'}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => handleEdit(u)} className="text-blue-600 hover:text-blue-900">Edit User</button>
                    <button onClick={() => handleViewPermissions(u)} className="text-indigo-600 hover:text-indigo-900">
                      {expandedPermissions === u.id ? '▼ Hide' : '▶'} View Permissions
                    </button>
                    <button onClick={() => handleManageDepartments(u)} className="text-purple-600 hover:text-purple-900">Manage Departments</button>
                    <button onClick={() => handleManageBranches(u)} className="text-purple-600 hover:text-purple-900">Manage Branches</button>
                    <button onClick={() => handleActivateUser(u)} className="text-green-600 hover:text-green-900">Activate User</button>
                    <button onClick={() => handleResetMfa(u)} className="text-orange-600 hover:text-orange-900">Reset MFA</button>
                    <button onClick={() => handleResetPassword(u)} className="text-amber-600 hover:text-amber-900">Reset Password</button>
                    <button onClick={() => handleDelete(u.id)} className="text-red-600 hover:text-red-900">Deactivate</button>
                  </div>
                </td>
              </tr>
              {/* Expanded Permissions Row */}
              {expandedPermissions === u.id && (
                <tr className="bg-blue-50">
                  <td colSpan={7} className="px-4 py-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700 mb-3">
                        Permissions for {u.firstName} {u.lastName}:
                      </p>
                      {u.permissionsLoading ? (
                        <div className="flex items-center gap-2 text-gray-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                          <span className="text-sm">Loading permissions...</span>
                        </div>
                      ) : u.permissions && u.permissions.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                          {u.permissions.map((perm: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-sm bg-white px-3 py-2 rounded border border-blue-200">
                              <span className="font-medium text-gray-700">{perm.name || perm.code}</span>
                              {perm.module && (
                                <span className="text-xs text-gray-500">({perm.module})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">
                          No permissions assigned to this user's roles
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              </>
              ))}
              {!loading && paginatedUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {searchTerm || roleFilter || departmentFilter || branchFilter ? 'No users match your filters' : 'No users found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalUsers > 0 && (
          <div className="border-t bg-gray-50 px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Show:</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-700">per page</span>
              </div>
              <div className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
              >
                Prev
              </button>
              
              {/* Page numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-2 py-1 text-xs border rounded-md ${
                        currentPage === pageNum
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-gray-300 hover:bg-gray-50 bg-white'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
              >
                Last
              </button>
            </div>
          </div>
        </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <UserForm
              initialUser={editingUser}
              onClose={() => { setShowForm(false); fetchUsers(); }}
            />
          </div>
        </div>
      )}

      {showDepartmentModal && (
        <UserDepartmentAccessModal
          userId={selectedUserId}
          userName={selectedUserName}
          onClose={() => {
            setShowDepartmentModal(false);
            fetchUsers();
          }}
        />
      )}

      {showBranchModal && (
        <BranchAssignmentModal
          userId={selectedUserId}
          userName={selectedUserName}
          onClose={() => {
            setShowBranchModal(false);
            fetchUsers();
          }}
          onSuccess={() => {
            setShowBranchModal(false);
            fetchUsers();
          }}
        />
      )}

      {showActivationModal && (
        <UserActivationModal
          userId={selectedUserId}
          userName={selectedUserName}
          userEmail={selectedUserEmail}
          userPhone={selectedUserPhone}
          onClose={() => {
            setShowActivationModal(false);
            fetchUsers();
          }}
          onSuccess={() => {
            setShowActivationModal(false);
            fetchUsers();
          }}
        />
      )}

      {showMfaResetModal && (
        <AdminMfaResetModal
          userId={selectedUserId}
          userName={selectedUserName}
          userEmail={selectedUserEmail}
          onClose={() => {
            setShowMfaResetModal(false);
          }}
          onSuccess={() => {
            setShowMfaResetModal(false);
          }}
        />
      )}
    </div>
  );
}
