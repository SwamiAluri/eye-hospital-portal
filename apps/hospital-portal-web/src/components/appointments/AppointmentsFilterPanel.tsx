'use client';

import { useState, useEffect, useMemo } from 'react';
import { Filter, X, Search, Calendar, Users, Stethoscope, Building2, Tag } from 'lucide-react';
import { useMasterValues } from '@/hooks/use-master-values';
import {
  resolveAppointmentStatusFilter,
  statusChipColor,
} from '@/lib/appointments/appointment-status-filter';

export interface AppointmentsFilters {
  search: string;
  doctors: string[];
  departments: string[];
  branches: string[];
  statuses: string[];
  priorities: string[];
  dateRange: {
    start: string;
    end: string;
  };
}

interface AppointmentsFilterPanelProps {
  filters: AppointmentsFilters;
  onFiltersChange: (filters: AppointmentsFilters) => void;
  doctors?: Array<{ id: string; name: string }>;
  departments?: Array<{ id: string; name: string }>;
  branches?: Array<{ id: string; name: string }>;
  showPanel: boolean;
  onTogglePanel: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  routine: 'green',
  urgent: 'yellow',
  emergency: 'red',
  low: 'green',
  normal: 'blue',
  high: 'yellow',
};

export default function AppointmentsFilterPanel({
  filters,
  onFiltersChange,
  doctors = [],
  departments = [],
  branches = [],
  showPanel,
  onTogglePanel
}: AppointmentsFilterPanelProps) {
  const { options: priorityOptions } = useMasterValues('appointment.priority');
  const { options: statusMaster } = useMasterValues('appointment.status');
  const statusOptions = useMemo(
    () => resolveAppointmentStatusFilter(statusMaster),
    [statusMaster],
  );
  const [localFilters, setLocalFilters] = useState<AppointmentsFilters>(filters);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  useEffect(() => {
    // Count active filters
    let count = 0;
    if (localFilters.search) count++;
    count += localFilters.doctors.length;
    count += localFilters.departments.length;
    count += localFilters.branches.length;
    if (localFilters.statuses.length < statusOptions.length) count++;
    if (priorityOptions.length > 0 && localFilters.priorities.length < priorityOptions.length) count++;
    if (localFilters.dateRange.start || localFilters.dateRange.end) count++;
    setActiveFiltersCount(count);
  }, [localFilters, statusOptions.length, priorityOptions.length]);

  const handleSearchChange = (value: string) => {
    const updated = { ...localFilters, search: value };
    setLocalFilters(updated);
    onFiltersChange(updated);
  };

  const toggleStatus = (status: string) => {
    const updated = {
      ...localFilters,
      statuses: localFilters.statuses.includes(status)
        ? localFilters.statuses.filter(s => s !== status)
        : [...localFilters.statuses, status]
    };
    setLocalFilters(updated);
    onFiltersChange(updated);
  };

  const togglePriority = (priority: string) => {
    const updated = {
      ...localFilters,
      priorities: localFilters.priorities.includes(priority)
        ? localFilters.priorities.filter(p => p !== priority)
        : [...localFilters.priorities, priority]
    };
    setLocalFilters(updated);
    onFiltersChange(updated);
  };

  const toggleDoctor = (doctorId: string) => {
    const updated = {
      ...localFilters,
      doctors: localFilters.doctors.includes(doctorId)
        ? localFilters.doctors.filter(d => d !== doctorId)
        : [...localFilters.doctors, doctorId]
    };
    setLocalFilters(updated);
    onFiltersChange(updated);
  };

  const toggleDepartment = (departmentId: string) => {
    const updated = {
      ...localFilters,
      departments: localFilters.departments.includes(departmentId)
        ? localFilters.departments.filter(d => d !== departmentId)
        : [...localFilters.departments, departmentId]
    };
    setLocalFilters(updated);
    onFiltersChange(updated);
  };

  const toggleBranch = (branchId: string) => {
    const updated = {
      ...localFilters,
      branches: localFilters.branches.includes(branchId)
        ? localFilters.branches.filter(b => b !== branchId)
        : [...localFilters.branches, branchId]
    };
    setLocalFilters(updated);
    onFiltersChange(updated);
  };

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    const updated = {
      ...localFilters,
      dateRange: { ...localFilters.dateRange, [field]: value }
    };
    setLocalFilters(updated);
    onFiltersChange(updated);
  };

  const clearAllFilters = () => {
    const cleared: AppointmentsFilters = {
      search: '',
      doctors: [],
      departments: [],
      branches: [],
      statuses: statusOptions.map((s) => s.value),
      priorities: priorityOptions.map((p) => p.value),
      dateRange: { start: '', end: '' }
    };
    setLocalFilters(cleared);
    onFiltersChange(cleared);
  };

  return (
    <>
      {/* Filter Toggle Button */}
      <button
        onClick={onTogglePanel}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
          showPanel
            ? 'bg-teal-600 text-white'
            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
        }`}
      >
        <Filter className="h-4 w-4" />
        <span className="hidden sm:inline">Filters</span>
        {activeFiltersCount > 0 && (
          <span className="bg-white text-teal-600 text-xs font-bold px-2 py-0.5 rounded-full">
            {activeFiltersCount}
          </span>
        )}
      </button>

      {/* Filter Panel */}
      {showPanel && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="text-sm text-gray-600">({activeFiltersCount} active)</span>
              )}
            </h3>
            <div className="flex gap-2">
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={onTogglePanel}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div className="col-span-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="h-4 w-4 inline mr-1" />
                Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={localFilters.search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onFiltersChange(localFilters);
                    }
                  }}
                  placeholder="Search by patient name, reason, or ID... (Press Enter to search)"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => onFiltersChange(localFilters)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-teal-600"
                  title="Search"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Date Range */}
            <div className="col-span-full md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={localFilters.dateRange.start}
                  onChange={(e) => handleDateRangeChange('start', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <input
                  type="date"
                  value={localFilters.dateRange.end}
                  onChange={(e) => handleDateRangeChange('end', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Tag className="h-4 w-4 inline mr-1" />
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.length === 0 ? (
                  <span className="text-xs text-gray-400">No statuses in Master Data</span>
                ) : (
                  statusOptions.map((status) => {
                    const color = statusChipColor(status);
                    return (
                      <button
                        key={status.value}
                        onClick={() => toggleStatus(status.value)}
                        className={`px-3 py-1 text-sm rounded-full transition-colors ${
                          localFilters.statuses.includes(status.value)
                            ? `bg-${color}-100 text-${color}-700 border-2 border-${color}-500`
                            : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:border-gray-300'
                        }`}
                      >
                        {status.label}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Tag className="h-4 w-4 inline mr-1" />
                Priority
              </label>
              <div className="flex flex-wrap gap-2">
                {priorityOptions.length === 0 ? (
                  <span className="text-xs text-gray-400">No priorities in Master Data</span>
                ) : (
                  priorityOptions.map((priority) => {
                    const color = PRIORITY_COLORS[priority.value.toLowerCase()] ?? 'gray';
                    return (
                      <button
                        key={priority.value}
                        onClick={() => togglePriority(priority.value)}
                        className={`px-3 py-1 text-sm rounded-full transition-colors ${
                          localFilters.priorities.includes(priority.value)
                            ? `bg-${color}-100 text-${color}-700 border-2 border-${color}-500`
                            : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:border-gray-300'
                        }`}
                      >
                        {priority.label}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Doctors */}
            {doctors.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Stethoscope className="h-4 w-4 inline mr-1" />
                  Doctors ({localFilters.doctors.length} selected)
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
                  {doctors.map(doctor => (
                    <label key={doctor.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localFilters.doctors.includes(doctor.id)}
                        onChange={() => toggleDoctor(doctor.id)}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">{doctor.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Departments */}
            {departments.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="h-4 w-4 inline mr-1" />
                  Departments ({localFilters.departments.length} selected)
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
                  {departments.map(dept => (
                    <label key={dept.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localFilters.departments.includes(dept.id)}
                        onChange={() => toggleDepartment(dept.id)}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">{dept.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Branches */}
            {branches.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Building2 className="h-4 w-4 inline mr-1" />
                  Branches ({localFilters.branches.length} selected)
                </label>
                <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
                  {branches.map(branch => (
                    <label key={branch.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localFilters.branches.includes(branch.id)}
                        onChange={() => toggleBranch(branch.id)}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm text-gray-700">{branch.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
