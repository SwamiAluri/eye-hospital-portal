'use client';

import { useState, useEffect } from 'react';
import { usersApi, rolesApi, departmentsApi, branchesApi } from '@/lib/api';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { useQualificationTypes } from '@/hooks/use-hr-masters';

interface Props {
  initialUser?: any;
  onClose?: () => void;
  onSuccess?: () => void;
}

export default function UserForm({ initialUser, onClose, onSuccess }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Dropdown data from database
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [allDepartments, setAllDepartments] = useState<Array<{ id: string; departmentName: string; parentDepartmentId?: string }>>([]);
  const [mainDepartments, setMainDepartments] = useState<Array<{ id: string; departmentName: string }>>([]);
  const [subDepartments, setSubDepartments] = useState<Array<{ id: string; departmentName: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  
  const [form, setForm] = useState({
    id: initialUser?.id || '',
    firstName: initialUser?.firstName || '',
    lastName: initialUser?.lastName || '',
    email: initialUser?.email || '',
    userName: initialUser?.userName || '',
    userType: initialUser?.userType || 'Staff',
    phoneNumber: initialUser?.phoneNumber || '',
    dateOfBirth: initialUser?.dateOfBirth || '',
    gender: initialUser?.gender || '',
    qualifications: initialUser?.qualifications || '',
    specialization: initialUser?.specialization || '',
    designation: initialUser?.designation || '',
    licenseNumber: initialUser?.licenseNumber || '',
    employeeId: initialUser?.employeeId || '',
    roleId: initialUser?.roleId || '',
    mainDepartmentId: '',
    subDepartmentId: initialUser?.departmentId || '',
    branchId: initialUser?.branchId || '',
  });

  // Update form when initialUser changes (for edit mode)
  useEffect(() => {
    if (initialUser) {
      console.log('🔍 EDIT MODE - Initial User Data:', {
        userType: initialUser.userType,
        roleId: initialUser.roleId,
        departmentId: initialUser.departmentId,
        branchId: initialUser.branchId
      });
      
      setForm({
        id: initialUser.id || '',
        firstName: initialUser.firstName || '',
        lastName: initialUser.lastName || '',
        email: initialUser.email || '',
        userName: initialUser.userName || '',
        userType: initialUser.userType || 'Staff',
        phoneNumber: initialUser.phoneNumber || '',
        dateOfBirth: initialUser.dateOfBirth || '',
        gender: initialUser.gender || '',
        qualifications: initialUser.qualifications || '',
        specialization: initialUser.specialization || '',
        designation: initialUser.designation || '',
        licenseNumber: initialUser.licenseNumber || '',
        employeeId: initialUser.employeeId || '',
        roleId: initialUser.roleId || '',
        mainDepartmentId: '',
        subDepartmentId: initialUser.departmentId || '',
        branchId: initialUser.branchId || '',
      });
    }
  }, [initialUser]);

  // Update mainDepartmentId when departments are loaded and user has a departmentId
  useEffect(() => {
    if (initialUser?.departmentId && allDepartments.length > 0) {
      const dept = allDepartments.find((d: any) => d.id === initialUser.departmentId);
      console.log('🔍 DEPARTMENT LOOKUP:', {
        searchingFor: initialUser.departmentId,
        found: dept,
        totalDepts: allDepartments.length,
        firstDeptId: allDepartments[0]?.id,
        firstDeptIdType: typeof allDepartments[0]?.id,
        userDeptIdType: typeof initialUser.departmentId
      });
      
      if (dept && dept.parentDepartmentId) {
        // This is a subdepartment, set the parent as main department
        console.log('✅ Found subdepartment, setting parent:', dept.parentDepartmentId);
        setForm(prev => ({ 
          ...prev, 
          mainDepartmentId: dept.parentDepartmentId,
          subDepartmentId: dept.id
        }));
      } else if (dept && !dept.parentDepartmentId) {
        // This is a main department
        console.log('✅ Found main department:', dept.id);
        setForm(prev => ({ 
          ...prev, 
          mainDepartmentId: dept.id,
          subDepartmentId: ''
        }));
      } else {
        console.log('❌ Department not found!');
      }
    }
  }, [initialUser, allDepartments]);

  // Log form state changes
  useEffect(() => {
    console.log('📝 FORM STATE UPDATED:', {
      userType: form.userType,
      roleId: form.roleId,
      mainDepartmentId: form.mainDepartmentId,
      subDepartmentId: form.subDepartmentId,
      branchId: form.branchId
    });
  }, [form.userType, form.roleId, form.mainDepartmentId, form.subDepartmentId, form.branchId]);

  // Load dropdown options from database
  useEffect(() => {
    const loadOptions = async () => {
      try {
        setLoading(true);
        const [rolesRes, deptsRes, branchesRes] = await Promise.all([
          rolesApi.getAll(),
          departmentsApi.getAll(),
          branchesApi.getAll(),
        ]);
        
        const loadedRoles = Array.isArray(rolesRes.data) ? rolesRes.data : [];
        setRoles(loadedRoles);
        console.log('🔍 LOADED ROLES:', loadedRoles.map((r: any) => ({ id: r.id, name: r.name })));
        
        // Separate main departments (no parent) from subdepartments
        const allDepts = Array.isArray(deptsRes.data) ? deptsRes.data : [];
        setAllDepartments(allDepts);
        const mainDepts = allDepts.filter((d: any) => !d.parentDepartmentId);
        setMainDepartments(mainDepts);
        console.log('🔍 LOADED DEPARTMENTS:', { 
          total: allDepts.length, 
          main: mainDepts.length,
          sampleMain: mainDepts.slice(0, 3).map((d: any) => ({ id: d.id, name: d.departmentName }))
        });
        
        const loadedBranches = branchesRes.data?.branches || branchesRes.data || [];
        setBranches(loadedBranches);
        console.log('🔍 LOADED BRANCHES:', loadedBranches.map((b: any) => ({ id: b.id, name: b.name })));
      } catch (err) {
        console.error('Failed to load dropdown options:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadOptions();
  }, []);

  // Update subdepartments when main department changes
  useEffect(() => {
    if (form.mainDepartmentId) {
      const subs = allDepartments.filter((d: any) => d.parentDepartmentId === form.mainDepartmentId);
      setSubDepartments(subs);
    } else {
      setSubDepartments([]);
      setForm(prev => ({ ...prev, subDepartmentId: '' }));
    }
  }, [form.mainDepartmentId, allDepartments]);

  // Auto-generate EmployeeID for new users
  useEffect(() => {
    if (!initialUser && !form.employeeId && form.userType) {
      const userTypePrefix = form.userType.toUpperCase().substring(0, 3);
      const randomNum = Math.floor(Math.random() * 9000) + 1000;
      const generatedId = `EMP-${userTypePrefix}-${randomNum}`;
      setForm(prev => ({ ...prev, employeeId: generatedId }));
    }
  }, [form.userType, initialUser, form.employeeId]);

  // Auto-generate username from employeeId
  useEffect(() => {
    if (!initialUser && form.employeeId) {
      const username = form.employeeId.toLowerCase();
      setForm(prev => ({ ...prev, userName: username }));
    }
  }, [form.employeeId, initialUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Reset subdepartment when main department changes
    if (name === 'mainDepartmentId') {
      setForm({ ...form, [name]: value, subDepartmentId: '' });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        userName: form.userName,
        userType: form.userType,
        phoneNumber: form.phoneNumber,
        dateOfBirth: form.dateOfBirth || null,
        gender: form.gender,
        qualifications: form.qualifications,
        specialization: form.specialization,
        designation: form.designation,
        licenseNumber: form.licenseNumber,
        employeeId: form.employeeId,
        branchId: form.branchId || null,
        departmentId: form.subDepartmentId || form.mainDepartmentId || null,
        primaryRole: form.roleId || null,
        password: '', // Let backend auto-generate
      };

      console.log('Submitting user payload:', payload);
      
      if (form.id) {
        await usersApi.update(form.id, payload);
      } else {
        await usersApi.create(payload);
      }
      onSuccess?.();
      onClose?.();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save user');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="ml-3 text-gray-600">Loading form options...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto px-1">
      {/* Personal Information */}
      <div className="bg-gray-50 p-3 rounded">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Personal Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
            <input 
              name="firstName" 
              value={form.firstName} 
              onChange={handleChange} 
              required
              className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
            <input 
              name="lastName" 
              value={form.lastName} 
              onChange={handleChange} 
              required
              className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500" 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <input 
              name="dateOfBirth" 
              type="date"
              value={form.dateOfBirth} 
              onChange={handleChange} 
              className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select 
              name="gender" 
              value={form.gender} 
              onChange={handleChange} 
              className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-gray-50 p-3 rounded">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Contact Information</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input 
            name="email" 
            type="email"
            value={form.email} 
            onChange={handleChange} 
            required
            className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500" 
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
            <input 
              name="userName" 
              value={form.userName} 
              onChange={handleChange} 
              required
              className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <PhoneInput
              country={'us'}
              value={form.phoneNumber}
              onChange={(phone) => setForm({ ...form, phoneNumber: phone })}
              containerClass="w-full"
              inputClass="w-full"
              buttonClass="border-gray-300"
              inputStyle={{
                width: '100%',
                height: '42px',
                fontSize: '14px',
                paddingLeft: '48px',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
              }}
              buttonStyle={{
                borderRadius: '0.375rem 0 0 0.375rem',
                border: '1px solid #d1d5db',
                backgroundColor: '#f9fafb',
              }}
              dropdownStyle={{
                borderRadius: '0.375rem',
              }}
              enableSearch
              searchPlaceholder="Search country"
              placeholder="+1 (555) 123-4567"
            />
          </div>
        </div>
      </div>

      {/* Professional Information */}
      <div className="bg-gray-50 p-3 rounded">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Professional Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
            <input 
              name="designation" 
              value={form.designation} 
              onChange={handleChange} 
              placeholder="e.g., Senior Consultant"
              className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
            <input 
              name="employeeId" 
              value={form.employeeId} 
              onChange={handleChange} 
              disabled={!!initialUser}
              placeholder="e.g., EMP-DOC-001"
              className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
            />
            {!initialUser && <p className="text-xs text-gray-500 mt-1">Auto-generated on create</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Qualifications</label>
            <select
              name="qualifications"
              value={form.qualifications}
              onChange={handleChange}
              className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Select qualification…</option>
              {qualificationTypes.map((t) => (
                <option key={t.value} value={t.label}>{t.label}</option>
              ))}
              {form.qualifications &&
                !qualificationTypes.some((t) => t.label === form.qualifications) && (
                  <option value={form.qualifications}>{form.qualifications}</option>
                )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
            <input 
              name="specialization" 
              value={form.specialization} 
              onChange={handleChange} 
              placeholder="e.g., Cardiology"
              className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500" 
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
          <input 
            name="licenseNumber" 
            value={form.licenseNumber} 
            onChange={handleChange} 
            placeholder="e.g., MCI-12345"
            className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500" 
          />
        </div>
      </div>

      {/* System Information */}
      <div className="bg-gray-50 p-3 rounded">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">System Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User Type *</label>
            <select 
              name="userType" 
              value={form.userType} 
              onChange={handleChange} 
              required
              className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Staff">Staff</option>
              <option value="Admin">Admin</option>
              <option value="Patient">Patient</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Primary Role *</label>
            <select 
              name="roleId" 
              value={form.roleId} 
              onChange={handleChange} 
              required
              className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Role ({roles.length} available)</option>
              {roles.map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Main Department</label>
            <select 
              name="mainDepartmentId" 
              value={form.mainDepartmentId} 
              onChange={handleChange} 
              className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select Department ({mainDepartments.length} available)</option>
              {mainDepartments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.departmentName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sub-Department</label>
            <select 
              name="subDepartmentId" 
              value={form.subDepartmentId} 
              onChange={handleChange} 
              disabled={!form.mainDepartmentId}
              className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {form.mainDepartmentId 
                  ? `Select Sub-Department (${subDepartments.length} available)` 
                  : 'Select Main Department first'}
              </option>
              {subDepartments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.departmentName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Branch *</label>
          <select 
            name="branchId" 
            value={form.branchId} 
            onChange={handleChange} 
            required
            className="w-full border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select Branch ({branches.length} available)</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-xs text-blue-700">
            <strong>Note:</strong> Additional roles and departments can be managed after user creation via "Manage Roles" and "Manage Departments" buttons.
          </p>
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4 border-t sticky bottom-0 bg-white">
        <button 
          type="button" 
          onClick={onClose} 
          disabled={isSaving}
          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={isSaving} 
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition disabled:bg-gray-400"
        >
          {isSaving ? 'Saving...' : 'Save User'}
        </button>
      </div>
    </form>
  );
}
