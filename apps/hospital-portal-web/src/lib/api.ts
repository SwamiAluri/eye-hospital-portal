import axios, { AxiosInstance } from 'axios';
import { attachAuthRequestInterceptor, attachAuthResponseInterceptor } from './auth-interceptors';
import { unwrapPagedItems, type PagedResult } from './api/paged-result';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

let axiosInstance: AxiosInstance;

export const initializeApi = () => {
  axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add request interceptor to include tenant ID and token
  attachAuthRequestInterceptor(axiosInstance);

  // Add response interceptor for error handling + silent token refresh
  attachAuthResponseInterceptor(axiosInstance, {
    skipLogoutUrls: ['/patients', '/users', '/departments', '/appointments/stats'],
  });

  return axiosInstance;
};

export const getApi = () => {
  if (!axiosInstance) {
    return initializeApi();
  }
  return axiosInstance;
};

export const patientApi = {
  getAll: () => getApi().get('/patients'),
  getById: (id: string) => getApi().get(`/patients/${id}`),
  create: (data: any) => getApi().post('/patients', data),
  update: (id: string, data: any) => getApi().put(`/patients/${id}`, data),
  delete: (id: string) => getApi().delete(`/patients/${id}`)
};

export const examinationApi = {
  getAll: () => getApi().get('/examinations'),
  getById: (id: string) => getApi().get(`/examinations/${id}`),
  getByPatient: (patientId: string) => getApi().get(`/examinations/patient/${patientId}`),
  create: (data: any) => getApi().post('/examinations', data),
  update: (id: string, data: any) => getApi().put(`/examinations/${id}`, data),
  delete: (id: string) => getApi().delete(`/examinations/${id}`)
};

export const visitsApi = {
  getAll: () => getApi().get('/visits'),
  getById: (id: string) => getApi().get(`/visits/${id}`),
  getByPatient: (patientId: string, page?: number, pageSize?: number) => 
    getApi().get(`/visits/by-patient/${patientId}`, { params: { page, pageSize } }),
  getByAppointment: (appointmentId: string) => getApi().get(`/visits/by-appointment/${appointmentId}`),
  getQueue: (branchId: string, station?: string, assignedTo?: string) => 
    getApi().get(`/visits/queue/${branchId}`, { params: { station, assignedTo } }),
  checkIn: (data: any) => getApi().post('/visits/check-in', data),
  sendTo: (data: any) => getApi().post('/visits/send-to', data),
  complete: (visitId: string, data: any) => getApi().post(`/visits/${visitId}/complete`, data)
};

export const appointmentsApi = {
  getAll: (params?: any) => getApi().get('/appointments', { params }),
  getById: (id: string) => getApi().get(`/appointments/${id}`),
  getByPatient: async (patientId: string, pageSize = 100) => {
    const response = await getApi().get<PagedResult<unknown> | unknown[]>(
      `/appointments/patient/${patientId}`,
      { params: { page: 1, pageSize } },
    );
    return { ...response, data: unwrapPagedItems(response.data) };
  },
  getTodayByPatient: (patientId: string) => getApi().get(`/appointments/patient/${patientId}/today`),
  getStats: () => getApi().get('/appointments/stats'),
  create: (data: any) => getApi().post('/appointments', data),
  update: (id: string, data: any) => getApi().put(`/appointments/${id}`, data),
  cancel: (id: string, reason?: string) => getApi().post(`/appointments/${id}/cancel`, { reason }),
  reschedule: (id: string, data: any) => getApi().post(`/appointments/${id}/reschedule`, data),
  delete: (id: string) => getApi().delete(`/appointments/${id}`)
};

export const prescriptionsApi = {
  getAll: () => getApi().get('/prescriptions'),
  getById: (id: string) => getApi().get(`/prescriptions/${id}`),
  getByPatient: (patientId: string, status?: string) => 
    getApi().get(`/prescriptions/patient/${patientId}`, { params: { status } }),
  create: (data: any) => getApi().post('/prescriptions', data),
  update: (id: string, data: any) => getApi().put(`/prescriptions/${id}`, data),
  delete: (id: string) => getApi().delete(`/prescriptions/${id}`),
  markDispensed: (id: string, data: any) => getApi().post(`/prescriptions/${id}/dispense`, data)
};

export const opdBillsApi = {
  getAll: (params?: any) => getApi().get('/opdbills', { params }),
  getById: (id: string) => getApi().get(`/opdbills/${id}`),
  getByPatient: (patientId: string, page?: number, pageSize?: number) => 
    getApi().get('/opdbills', { params: { patientId, page, pageSize } }),
  getByAppointment: (appointmentId: string) => getApi().get(`/opdbills/by-appointment/${appointmentId}`),
  create: (data: any) => getApi().post('/opdbills', data),
  update: (id: string, data: any) => getApi().put(`/opdbills/${id}`, data),
  addPayment: (billId: string, data: any) => getApi().post(`/opdbills/${billId}/payment`, data),
  cancel: (id: string, reason?: string) => getApi().post(`/opdbills/${id}/cancel`, { reason })
};

export const authApi = {
  login: (email: string, password: string, tenantId: string) =>
    getApi().post('/auth/login', { email, password, tenantId }),
  
  changePassword: (currentPassword: string, newPassword: string) =>
    getApi().post('/auth/change-password', { currentPassword, newPassword }),
};

export const usersApi = {
  getAll: (params?: { pageNumber?: number; pageSize?: number }) => getApi().get('/users', { params }),
  getAllWithDetails: () => getApi().get('/users/with-details'),
  getById: (id: string) => getApi().get(`/users/${id}`),
  create: (data: any) => getApi().post('/users', data),
  update: (id: string, data: any) => getApi().put(`/users/${id}`, data),
  deactivate: (id: string) => getApi().post(`/users/${id}/deactivate`),
};

export const rolesApi = {
  getAll: () => getApi().get('/roles'),
  getAllWithUserCount: () => getApi().get('/roles/with-user-count'),
  getById: (id: string) => getApi().get(`/roles/${id}`),
  create: (data: any) => getApi().post('/roles', data),
  update: (id: string, data: any) => getApi().put(`/roles/${id}`, data),
  delete: (id: string) => getApi().delete(`/roles/${id}`),
  assignRole: (userId: string, roleId: string, branchId?: string) =>
    getApi().post(`/users/${userId}/roles`, { roleId, branchId }),
  getRolePermissions: (roleId: string) => getApi().get(`/roles/${roleId}/permissions`),
  assignPermissions: (roleId: string, permissionIds: string[]) =>
    getApi().post(`/roles/${roleId}/permissions`, { permissionIds }),
  removePermissions: (roleId: string, permissionIds: string[]) =>
    getApi().delete(`/roles/${roleId}/permissions`, { data: { permissionIds } }),
  cloneRole: (roleId: string, newRoleName: string, newRoleDescription?: string) =>
    getApi().post(`/roles/${roleId}/clone`, { name: newRoleName, description: newRoleDescription }),
  
  // Role Hierarchy APIs
  getHierarchy: () => getApi().get('/roles/hierarchy'),
  updateHierarchy: (roleId: string, data: any) => getApi().put(`/roles/${roleId}/hierarchy`, data),
  getInheritancePreview: (roleId: string) => getApi().get(`/roles/${roleId}/inheritance-preview`),
  refreshInheritance: (roleId: string) => getApi().post(`/roles/${roleId}/refresh-inheritance`),
  validateHierarchy: (roleId: string, parentRoleId?: string) => 
    getApi().post('/roles/validate-hierarchy', { roleId, parentRoleId }),
    
  // Role Template APIs
  getTemplates: (category?: string) => getApi().get(`/roles/templates${category ? `?category=${category}` : ''}`),
  createFromTemplate: (templateId: string, data: any) => 
    getApi().post(`/roles/from-template/${templateId}`, data),
    
  // User Role History APIs
  getUserRoleHistory: (userId: string) => getApi().get(`/roles/history/user/${userId}`),
  getAllRoleHistory: (filters?: any) => getApi().get('/roles/history', { params: filters }),
  
  // Bulk Role Operations
  bulkUpdateHierarchy: (operations: any[]) => getApi().post('/roles/bulk/hierarchy', { operations }),
  bulkRefreshInheritance: (roleIds: string[]) => getApi().post('/roles/bulk/refresh-inheritance', { roleIds }),
};

export const permissionsApi = {
  getAll: () => getApi().get('/permissions', { params: { pageSize: 500 } }), // Request all permissions
  getAllGrouped: () => getApi().get('/permissions/by-module'),
  getById: (id: string) => getApi().get(`/permissions/${id}`),
  create: (data: any) => getApi().post('/permissions', data),
  update: (id: string, data: any) => getApi().put(`/permissions/${id}`, data),
  delete: (id: string) => getApi().delete(`/permissions/${id}`),
  getByCategory: (category: string) => getApi().get(`/permissions/category/${category}`),
  bulkAssign: (roleId: string, permissionIds: string[]) =>
    getApi().post('/permissions/bulk-assign', { roleId, permissionIds }),
  bulkRemove: (roleId: string, permissionIds: string[]) =>
    getApi().delete('/permissions/bulk-remove', { data: { roleId, permissionIds } }),
  getMatrix: () => getApi().get('/permissions/matrix'),
  getStatistics: () => getApi().get('/permissions/statistics'),
  getUserPermissions: (userId: string) => getApi().get(`/permissions/user/${userId}`),
};

export const departmentsApi = {
  getAll: () => getApi().get('/departments'),
  getAllWithStaffCount: () => getApi().get('/departments/with-staff-count'),
  getById: (id: string) => getApi().get(`/departments/${id}`),
  getUserAccess: (userId: string) => getApi().get(`/departments/user/${userId}/access`),
  grantUserAccess: (userId: string, departmentId: string, data: any) =>
    getApi().post(`/departments/${departmentId}/users/${userId}/access`, data),
  revokeUserAccess: (userId: string, departmentId: string) =>
    getApi().delete(`/departments/${departmentId}/users/${userId}/access`),
};

export const branchesApi = {
  getAll: () => getApi().get('/branches'),
};

export const dashboardApi = {
  getStats: () => getApi().get('/admin/dashboard/stats'),
  getOverview: () => getApi().get('/admin/dashboard/overview'),
  getQuickStats: () => getApi().get('/admin/dashboard/quick-stats'),
  getRecentActivities: (limit: number = 10) => getApi().get('/admin/dashboard/recent-activities', { params: { limit } }),
  getAlerts: () => getApi().get('/admin/dashboard/alerts'),
  getActivitySeries: (hours: number = 24) =>
    getApi().get('/admin/dashboard/activity-series', { params: { hours } }),
  dismissAlert: (id: string) => getApi().delete(`/admin/dashboard/alerts/${id}`),
};

export const settingsApi = {
  getAll: () => getApi().get('/settings'),
  getByCategory: (category: string) => getApi().get(`/settings/${category}`),
  update: (category: string, settings: any) => getApi().put(`/settings/${category}`, settings),
  reset: (category: string) => getApi().post(`/settings/${category}/reset`),
};

export const licensesApi = {
  getAll: (params?: any) => getApi().get('/license', { params }),
  getById: (id: string) => getApi().get(`/license/${id}`),
  getByEmployee: (employeeId: string) => getApi().get(`/license/employee/${employeeId}`),
  getExpiring: (days: number = 90) => getApi().get(`/license/expiring`, { params: { days } }),
  getStatistics: () => getApi().get('/license/statistics'),
  create: (data: any) => getApi().post('/license', data),
  update: (id: string, data: any) => getApi().put(`/license/${id}`, data),
  verify: (id: string, data: { approved: boolean; verificationNotes?: string }) => 
    getApi().post(`/license/${id}/verify`, data),
  renew: (id: string, data: { newExpiryDate: string }) => 
    getApi().post(`/license/${id}/renew`, data),
  delete: (id: string) => getApi().delete(`/license/${id}`),
  sendRenewalReminders: () => getApi().post('/license/send-renewal-reminders'),
  fixTenantIds: () => getApi().post('/license/fix-tenant-ids'),
};

export const employeesApi = {
  getAll: (params?: any) => getApi().get('/employee', { params }),
  getById: (id: string) => getApi().get(`/employee/${id}`),
  getByUserId: (userId: string) => getApi().get(`/employee/user/${userId}`),
  getEmploymentTypes: () => getApi().get('/employee/employment-types'),
  create: (data: any) => getApi().post('/employee', data),
  update: (id: string, data: any) => getApi().put(`/employee/${id}`, data),
  delete: (id: string) => getApi().delete(`/employee/${id}`),
};

export const bulkOperationsApi = {
  getUserTemplate: () => getApi().get('/bulkoperations/template/users', { responseType: 'blob' }),
  getEmployeeTemplate: () => getApi().get('/bulkoperations/template/employees', { responseType: 'blob' }),
  importUsers: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return getApi().post('/bulkoperations/import/users', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importEmployees: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return getApi().post('/bulkoperations/import/employees', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  exportUsers: () => getApi().get('/bulkoperations/export/users', { responseType: 'blob' }),
  exportEmployees: () => getApi().get('/bulkoperations/export/employees', { responseType: 'blob' }),
  assignRoles: (userIds: string[], roleIds: string[]) => 
    getApi().post('/bulkoperations/assign-roles', { userIds, roleIds }),
  updateStatus: (targetIds: string[], status: string) => 
    getApi().post('/bulkoperations/update-status', { targetIds, status }),
  activate: (targetIds: string[]) => getApi().post('/bulkoperations/activate', { targetIds }),
  deactivate: (targetIds: string[]) => getApi().post('/bulkoperations/deactivate', { targetIds }),
  bulkDelete: (targetIds: string[]) => getApi().post('/bulkoperations/delete', { targetIds }),
};

export { userDepartmentAccessApi } from './api/user-department-access.api';
export { auditLogsApi, activationAuditLogsApi } from './api/audit-logs.api';
export { insuranceApi } from './api/insurance.api';

// ─── Master Data Module (April 2026) ────────────────────────────────────────
// Generic CRUD for all 53 entity types across 12 groups
export const masterValuesApi = {
  getGroups: () =>
    getApi().get('/master-values/groups'),

  /** Active-only dropdown lookup (master_data.lookup — all clinical roles). */
  lookup: (entityType: string) =>
    getApi().get(`/master-values/lookup/${encodeURIComponent(entityType)}`),

  getByEntityType: (entityType: string, includeInactive = false, page = 1, pageSize = 50) =>
    getApi().get(`/master-values/${entityType}`, { params: { includeInactive, page, pageSize } }),

  getById: (entityType: string, id: string) =>
    getApi().get(`/master-values/${entityType}/${id}`),

  getGroupStats: (groupKey: string) =>
    getApi().get(`/master-values/stats/${groupKey}`),

  create: (entityType: string, data: { code: string; label: string; description?: string; metadata?: string; sortOrder?: number }) =>
    getApi().post(`/master-values/${entityType}`, data),

  update: (entityType: string, id: string, data: { label: string; description?: string; metadata?: string; sortOrder?: number }) =>
    getApi().put(`/master-values/${entityType}/${id}`, data),

  enable: (entityType: string, id: string) =>
    getApi().post(`/master-values/${entityType}/${id}/enable`),

  disable: (entityType: string, id: string, reason?: string) =>
    getApi().post(`/master-values/${entityType}/${id}/disable`, { reason }),

  delete: (entityType: string, id: string) =>
    getApi().delete(`/master-values/${entityType}/${id}`),

  seedDefaults: () =>
    getApi().post('/master-values/seed-defaults'),
};

