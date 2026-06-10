'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { appointmentsApi, Appointment } from '@/lib/api/appointments-enhanced.api';
import AppointmentModal from '@/components/AppointmentModal';
import DoctorAvailabilityManager from '@/components/appointments/DoctorAvailabilityManager';
import { SpecialtySlotManager } from '@/components/appointments/SpecialtySlotManager';
import { EyeAppointmentBooking } from '@/components/appointments/EyeAppointmentBooking';
import AppointmentsFilterPanel, { AppointmentsFilters } from '@/components/appointments/AppointmentsFilterPanel';
import AppointmentsActionButtons from '@/components/appointments/AppointmentsActionButtons';
import CheckInModal from '@/components/appointments/CheckInModal';
import UnifiedAppointmentBooking from '@/components/appointments/UnifiedAppointmentBooking';
import { toast } from 'sonner';
import { useMasterValues } from '@/hooks/use-master-values';
import { masterLabelForValue } from '@/lib/master-data/appointment-master';
import { AppointmentCancelDialog } from '@/components/appointments/AppointmentCancelDialog';
import { Bell, RefreshCw, Clock, TrendingUp, AlertCircle, Calendar as CalendarIcon, AlertTriangle, CalendarDays, List, UserCog, BarChart3, Plus, Filter, Users, CheckCircle, Eye, Scissors, LogIn, X, MapPin, Stethoscope, FileText, User } from 'lucide-react';

type TabType = 'calendar' | 'list' | 'availability' | 'specialty-slots' | 'analytics';

const EnhancedAppointmentCalendar = dynamic(
  () => import('@/components/appointments/EnhancedAppointmentCalendar'),
  { ssr: false }
);

export default function AppointmentsPage() {
  const { options: priorityOptions } = useMasterValues('appointment.priority');
  const [activeTab, setActiveTab] = useState<TabType>('calendar');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEyeBookingOpen, setIsEyeBookingOpen] = useState(false);
  const [selectedPatientForBooking, setSelectedPatientForBooking] = useState<{ id: string; name: string } | null>(null);
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [initialDate, setInitialDate] = useState<Date | undefined>();
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    cancelled: 0,
    scheduled: 0,
    confirmed: 0,
    inProgress: 0,
    noShow: 0,
    conflicts: 0
  });
  const [realTimeConnected, setRealTimeConnected] = useState(false);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [appointmentForCheckIn, setAppointmentForCheckIn] = useState<Appointment | null>(null);
  const [isUnifiedBookingOpen, setIsUnifiedBookingOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTargetIds, setCancelTargetIds] = useState<string[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [filters, setFilters] = useState<AppointmentsFilters>({
    search: '',
    doctors: [],
    departments: [],
    branches: [],
    statuses: ['scheduled', 'confirmed', 'in-progress'],
    priorities: [],
    dateRange: { start: '', end: '' },
    appointmentCategory: undefined,
    specialty: undefined
  });

  useEffect(() => {
    if (filters.priorities.length === 0 && priorityOptions.length > 0) {
      setFilters((prev) => ({
        ...prev,
        priorities: priorityOptions.map((p) => p.value),
      }));
    }
  }, [priorityOptions, filters.priorities.length]);

  useEffect(() => {
    loadAppointments();
    loadStats();
    setupRealTimeConnection();

    return () => {
      // Cleanup real-time connection
      if ((window as any).appointmentsEventSource) {
        (window as any).appointmentsEventSource.close();
      }
    };
  }, []);

  // Apply filters whenever filters or appointments change
  useEffect(() => {
    applyFilters();
  }, [filters, appointments]);

  const setupRealTimeConnection = () => {
    try {
      const eventSource = new EventSource(`${process.env.NEXT_PUBLIC_API_URL}/appointments/updates`);
      
      eventSource.onopen = () => {
        setRealTimeConnected(true);
        console.log('Real-time connection established');
      };

      eventSource.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          handleRealTimeUpdate(update);
        } catch (error) {
          console.error('Error parsing real-time update:', error);
        }
      };

      eventSource.onerror = () => {
        setRealTimeConnected(false);
        console.error('Real-time connection error');
        eventSource.close();
        
        // Retry connection after 5 seconds
        setTimeout(() => {
          if (!(window as any).appointmentsEventSource) {
            setupRealTimeConnection();
          }
        }, 5000);
      };

      (window as any).appointmentsEventSource = eventSource;
    } catch (error) {
      console.error('Failed to setup real-time connection:', error);
    }
  };

  const handleRealTimeUpdate = (update: any) => {
    console.log('Real-time update received:', update);
    
    switch (update.action) {
      case 'created':
      case 'updated':
        setAppointments(prev => {
          const index = prev.findIndex(a => a.id === update.appointment.id);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = update.appointment;
            return updated;
          } else {
            return [...prev, update.appointment];
          }
        });
        break;
      
      case 'deleted':
        setAppointments(prev => prev.filter(a => a.id !== update.appointmentId));
        break;
      
      case 'conflict-detected':
        // Show notification about conflict
        alert(`Conflict detected: ${update.message}`);
        loadAppointments(); // Reload to get latest state
        break;
    }
    
    loadStats(); // Update stats on any change
  };

  const applyFilters = () => {
    let filtered = [...appointments];

    // Search filter - search by patient name, reason, and ID
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(apt => 
        apt.patientName?.toLowerCase().includes(searchLower) ||
        apt.patientId?.toLowerCase().includes(searchLower) ||
        apt.reasonForVisit?.toLowerCase().includes(searchLower) ||
        apt.notes?.toLowerCase().includes(searchLower) ||
        apt.id.toLowerCase().includes(searchLower)
      );
    }

    // Status filter - case-insensitive comparison
    if (filters.statuses.length > 0) {
      filtered = filtered.filter(apt => 
        filters.statuses.some(status => status.toLowerCase() === apt.status.toLowerCase())
      );
    }

    // Priority filter - case-insensitive comparison
    // Keep appointments without priority set, filter only those that have a priority
    if (filters.priorities.length > 0) {
      filtered = filtered.filter(apt => {
        if (!apt.priority) return true;
        return filters.priorities.some(p => p.toLowerCase() === apt.priority?.toLowerCase());
      });
    }

    // Doctor filter
    if (filters.doctors.length > 0) {
      filtered = filtered.filter(apt => filters.doctors.includes(apt.doctorId));
    }

    // Department filter
    if (filters.departments.length > 0) {
      filtered = filtered.filter(apt => apt.departmentId && filters.departments.includes(apt.departmentId));
    }

    // Branch filter
    if (filters.branches.length > 0) {
      filtered = filtered.filter(apt => filters.branches.includes(apt.branchId));
    }

    // Date range filter
    if (filters.dateRange.start) {
      filtered = filtered.filter(apt => apt.appointmentDate >= filters.dateRange.start);
    }
    if (filters.dateRange.end) {
      filtered = filtered.filter(apt => apt.appointmentDate <= filters.dateRange.end);
    }

    setFilteredAppointments(filtered);
  };

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const response = await appointmentsApi.getAll({
        startDate,
        endDate,
        pageSize: 1000  // Fetch all appointments for the month
      });
      
      console.log('📥 API Response:', {
        totalItems: response.data.items?.length || 0,
        statusCounts: response.data.items?.reduce((acc:any, apt:any) => {
          acc[apt.status] = (acc[apt.status] || 0) + 1;
          return acc;
        }, {})
      });
      
      setAppointments(response.data.items || []);
    } catch (error) {
      console.error('Failed to load appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await appointmentsApi.getStats(today, today);
      const data = response.data;
      
      // Skip conflict check for stats (too expensive)
      // Conflicts are checked when booking individual appointments
      
      // Count appointments by status (case-insensitive)
      const countByStatus = (status: string) => 
        appointments.filter(a => a.status.toLowerCase() === status.toLowerCase()).length;
      
      setStats({
        total: data.totalToday || 0,
        completed: data.completedToday || countByStatus('completed'),
        cancelled: data.cancelledToday || countByStatus('cancelled'),
        scheduled: countByStatus('scheduled'),
        confirmed: countByStatus('confirmed'),
        inProgress: countByStatus('in-progress'),
        noShow: data.noShowToday || countByStatus('no-show'),
        conflicts: 0 // Checked during individual bookings
      });
    } catch (error: any) {
      // Don't log error if it's just unauthorized (user not logged in yet)
      if (error?.response?.status !== 401) {
        console.error('Failed to load stats:', error);
      }
      
      // Fallback: calculate stats from loaded appointments
      if (appointments.length > 0) {
        const countByStatus = (status: string) => 
          appointments.filter(a => a.status.toLowerCase() === status.toLowerCase()).length;
        
        setStats({
          total: appointments.length,
          completed: countByStatus('completed'),
          cancelled: countByStatus('cancelled'),
          scheduled: countByStatus('scheduled'),
          confirmed: countByStatus('confirmed'),
          inProgress: countByStatus('in-progress'),
          noShow: countByStatus('no-show'),
          conflicts: 0
        });
      }
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedAppointmentIds.length === 0) {
      alert('Please select appointments first');
      return;
    }

    try {
      switch (action) {
        case 'confirm':
          await appointmentsApi.bulkUpdate({
            appointmentIds: selectedAppointmentIds,
            status: 'confirmed'
          });
          alert(`Confirmed ${selectedAppointmentIds.length} appointments`);
          break;

        case 'cancel':
          setCancelTargetIds([...selectedAppointmentIds]);
          setCancelDialogOpen(true);
          return;

        case 'send-reminders':
          for (const id of selectedAppointmentIds) {
            await appointmentsApi.sendReminder(id, 'both');
          }
          alert(`Sent reminders for ${selectedAppointmentIds.length} appointments`);
          break;
      }

      setSelectedAppointmentIds([]);
      await loadAppointments();
      await loadStats();
    } catch (error) {
      console.error('Bulk action failed:', error);
      alert('Bulk action failed. Please try again.');
    }
  };

  const handleEventClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsFormOpen(true);
  };

  const handleDateClick = (date: Date) => {
    setInitialDate(date);
    setSelectedAppointment(null);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedAppointment(null);
    setInitialDate(undefined);
  };

  const handleFormSave = async () => {
    handleFormClose();
    await loadAppointments();
    await loadStats();
  };

  const handleConfirmCancel = async (reason: string) => {
    if (cancelTargetIds.length === 0) return;
    const ids = [...cancelTargetIds];
    const count = ids.length;
    setCancelling(true);
    try {
      if (count === 1) {
        await appointmentsApi.cancel(ids[0], reason);
      } else {
        await appointmentsApi.bulkCancel({
          appointmentIds: ids,
          cancellationReason: reason,
        });
      }
      setCancelDialogOpen(false);
      setCancelTargetIds([]);
      setSelectedAppointmentIds([]);
      if (selectedAppointment && ids.includes(selectedAppointment.id)) {
        handleFormClose();
      }
      await loadAppointments();
      await loadStats();
      toast.success(
        count === 1 ? 'Appointment cancelled' : `Cancelled ${count} appointments`,
      );
    } catch (error) {
      console.error('Failed to cancel appointment(s):', error);
      toast.error('Failed to cancel appointment(s)');
    } finally {
      setCancelling(false);
    }
  };

  const handleEventDrop = async (appointmentId: string, newDate: Date, newStartTime: string) => {
    try {
      await appointmentsApi.reschedule(appointmentId, newDate.toISOString().split('T')[0], newStartTime);
      await loadAppointments();
    } catch (error) {
      console.error('Failed to reschedule appointment:', error);
    }
  };

  const handleSendReminders = async () => {
    try {
      const upcomingAppointments = await appointmentsApi.getUpcomingReminders(24);
      for (const apt of upcomingAppointments.data) {
        await appointmentsApi.sendReminder(apt.id, 'both');
      }
      alert(`Sent reminders for ${upcomingAppointments.data.length} appointments`);
    } catch (error) {
      console.error('Failed to send reminders:', error);
      alert('Failed to send reminders');
    }
  };

  const handleCheckIn = (appointment: Appointment) => {
    setAppointmentForCheckIn(appointment);
    setCheckInModalOpen(true);
  };

  const handleCheckInSuccess = async (result: { tokenNumber: string }) => {
    setCheckInModalOpen(false);
    setAppointmentForCheckIn(null);
    toast.success(`Patient checked in successfully! Token: ${result.tokenNumber}`);
    await loadAppointments();
    await loadStats();
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-600 mt-1">Manage and schedule patient appointments</p>
        </div>
        <div className="flex items-center gap-3">
          {realTimeConnected && (
            <span className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
              Live
            </span>
          )}
          <button
            onClick={() => setIsUnifiedBookingOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm"
            title="Book New Appointment"
          >
            <Plus className="w-5 h-5" />
            <span>Book New Appointment</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Today</p>
              <p className="text-lg font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Completed</p>
              <p className="text-lg font-bold text-gray-900">{stats.completed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-yellow-50 text-yellow-600">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Scheduled</p>
              <p className="text-lg font-bold text-gray-900">{stats.scheduled}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-600">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Confirmed</p>
              <p className="text-lg font-bold text-gray-900">{stats.confirmed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-gray-600">In Progress</p>
              <p className="text-lg font-bold text-gray-900">{stats.inProgress}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-50 text-red-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Conflicts</p>
              <p className="text-lg font-bold text-gray-900">{stats.conflicts}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Card */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Tabs Navigation */}
        <div className="flex items-center gap-1 p-1 border-b border-gray-200 bg-gray-50">
          <TabButton
            active={activeTab === 'calendar'}
            onClick={() => setActiveTab('calendar')}
            icon={CalendarDays}
            label="Calendar"
          />
          <TabButton
            active={activeTab === 'list'}
            onClick={() => setActiveTab('list')}
            icon={List}
            label="List"
          />
          <TabButton
            active={activeTab === 'availability'}
            onClick={() => setActiveTab('availability')}
            icon={UserCog}
            label="Availability"
          />
          <TabButton
            active={activeTab === 'specialty-slots'}
            onClick={() => setActiveTab('specialty-slots')}
            icon={Scissors}
            label="Specialty Slots"
          />
          <TabButton
            active={activeTab === 'analytics'}
            onClick={() => setActiveTab('analytics')}
            icon={BarChart3}
            label="Analytics"
          />
          
          <div className="flex-1"></div>
          
          {/* Quick Actions */}
          {selectedAppointmentIds.length > 0 && (
            <div className="flex items-center gap-2 pr-2">
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-lg">
                <span className="text-sm font-medium text-blue-700">{selectedAppointmentIds.length} selected</span>
                <button
                  onClick={() => handleBulkAction('confirm')}
                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Confirm
                </button>
                <button
                  onClick={() => handleBulkAction('cancel')}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filter Panel (Collapsible) */}
        {showFilterPanel && (
          <div className="border-b border-gray-200 bg-gray-50">
            <AppointmentsFilterPanel
              filters={filters}
              onFiltersChange={setFilters}
              showPanel={showFilterPanel}
              onTogglePanel={() => setShowFilterPanel(false)}
            />
          </div>
        )}
        {/* Tab Content */}
        <div className="p-4">
          {/* Calendar View */}
          {activeTab === 'calendar' && (
            <div className="min-h-[600px]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <EnhancedAppointmentCalendar
                  appointments={filteredAppointments}
                  onEventClick={handleEventClick}
                  onDateClick={handleDateClick}
                  onEventDrop={handleEventDrop}
                  loading={loading}
                  enableRealTime={true}
                  enableConflictDetection={true}
                  viewModes={['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'resourceTimelineWeek']}
                />
              )}
            </div>
          )}

          {/* List View */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {filteredAppointments.length} Appointments
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowFilterPanel(!showFilterPanel)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                      showFilterPanel
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                    <span>Filters</span>
                    {Object.values(filters).filter(v => Array.isArray(v) ? v.length > 0 : v && v !== '').length > 0 && (
                      <span className="bg-white text-blue-600 text-xs px-2 py-0.5 rounded-full">
                        {Object.values(filters).filter(v => Array.isArray(v) ? v.length > 0 : v && v !== '').length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={loadAppointments}
                    className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </button>
                </div>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredAppointments.length === 0 ? (
                <div className="text-center py-12 text-gray-500 border border-gray-200 rounded-lg">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>No appointments found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAppointments.map((apt) => (
                    <AppointmentListItem
                      key={apt.id}
                      appointment={apt}
                      selected={selectedAppointmentIds.includes(apt.id)}
                      onSelect={(checked) => {
                        if (checked) {
                          setSelectedAppointmentIds([...selectedAppointmentIds, apt.id]);
                        } else {
                          setSelectedAppointmentIds(selectedAppointmentIds.filter(id => id !== apt.id));
                        }
                      }}
                      onClick={() => handleEventClick(apt)}
                      onCheckIn={handleCheckIn}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Availability View */}
          {activeTab === 'availability' && (
            <div className="space-y-4">
              <DoctorAvailabilityManager onAvailabilityUpdate={loadAppointments} />
            </div>
          )}

          {/* Specialty Slots View */}
          {activeTab === 'specialty-slots' && (
            <div className="space-y-4">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Eye className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-1">Eye Hospital Specialty Slots</h3>
                    <p className="text-sm text-blue-800">
                      Configure OPD and Surgery slots with eye-specific appointment types, durations, and requirements (Pre-op clearance, IOL selection, etc.)
                    </p>
                  </div>
                </div>
              </div>
              <SpecialtySlotManager onSlotsUpdated={loadAppointments} />
            </div>
          )}

          {/* Analytics View */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 border border-gray-200 rounded-lg bg-gradient-to-br from-blue-50 to-white">
                  <div className="text-sm text-gray-600 mb-1">Total Appointments</div>
                  <div className="text-3xl font-bold text-gray-900">{appointments.length}</div>
                  <div className="text-sm text-green-600 mt-2 flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    12% from last week
                  </div>
                </div>
                <div className="p-6 border border-gray-200 rounded-lg bg-gradient-to-br from-green-50 to-white">
                  <div className="text-sm text-gray-600 mb-1">Completion Rate</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {appointments.length > 0 ? Math.round((stats.completed / appointments.length) * 100) : 0}%
                  </div>
                  <div className="text-sm text-green-600 mt-2 flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    5% improvement
                  </div>
                </div>
                <div className="p-6 border border-gray-200 rounded-lg bg-gradient-to-br from-purple-50 to-white">
                  <div className="text-sm text-gray-600 mb-1">Average Duration</div>
                  <div className="text-3xl font-bold text-gray-900">32 min</div>
                  <div className="text-sm text-gray-600 mt-2">Consistent</div>
                </div>
              </div>
              <div className="text-center py-16 text-gray-500 border border-gray-200 rounded-lg bg-gray-50">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">Detailed Analytics</p>
                <p className="text-sm">Charts and insights coming soon</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legacy Appointment Form Modal - for creating new appointments */}
      {isFormOpen && !selectedAppointment && (
        <AppointmentModal
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSuccess={handleFormSave}
        />
      )}

      {/* Appointment Details Modal - for viewing existing appointments */}
      {isFormOpen && selectedAppointment && (
        <AppointmentDetailsModal
          appointment={selectedAppointment}
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onCheckIn={() => {
            handleFormClose();
            handleCheckIn(selectedAppointment);
          }}
          onReschedule={() => {
            // TODO: Implement reschedule functionality
            handleFormClose();
            toast.info('Reschedule functionality coming soon');
          }}
          onCancel={() => {
            setCancelTargetIds([selectedAppointment.id]);
            setCancelDialogOpen(true);
          }}
        />
      )}

      {/* Eye Hospital Appointment Booking */}
      {isEyeBookingOpen && selectedPatientForBooking && (
        <EyeAppointmentBooking
          patientId={selectedPatientForBooking.id}
          patientName={selectedPatientForBooking.name}
          open={isEyeBookingOpen}
          onClose={() => {
            setIsEyeBookingOpen(false);
            setSelectedPatientForBooking(null);
          }}
          onSuccess={() => {
            setIsEyeBookingOpen(false);
            setSelectedPatientForBooking(null);
            loadAppointments();
            loadStats();
          }}
        />
      )}

      {/* Check-In Modal with Inline Billing & Payment */}
      {checkInModalOpen && appointmentForCheckIn && (
        <CheckInModal
          appointmentId={appointmentForCheckIn.id}
          patientId={appointmentForCheckIn.patientId}
          patientName={appointmentForCheckIn.patientName}
          appointmentDate={appointmentForCheckIn.appointmentDate}
          appointmentTime={appointmentForCheckIn.startTime}
          branchId={appointmentForCheckIn.branchId}
          isOpen={checkInModalOpen}
          onClose={() => {
            setCheckInModalOpen(false);
            setAppointmentForCheckIn(null);
          }}
          onSuccess={handleCheckInSuccess}
        />
      )}

      {/* Unified Appointment Booking Modal */}
      {isUnifiedBookingOpen && (
        <UnifiedAppointmentBooking
          onClose={() => setIsUnifiedBookingOpen(false)}
          onSuccess={() => {
            loadAppointments();
            loadStats();
          }}
        />
      )}

      <AppointmentCancelDialog
        open={cancelDialogOpen}
        title={cancelTargetIds.length > 1 ? `Cancel ${cancelTargetIds.length} appointments` : 'Cancel appointment'}
        onClose={() => {
          setCancelDialogOpen(false);
          setCancelTargetIds([]);
        }}
        onConfirm={handleConfirmCancel}
        confirming={cancelling}
      />
    </div>
  );
}

// Tab Button Component
function TabButton({ active, onClick, icon: Icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
        active
          ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
          : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm hidden sm:inline">{label}</span>
    </button>
  );
}

// Appointment List Item Component
function AppointmentListItem({ appointment, selected, onSelect, onClick, onCheckIn }: {
  appointment: Appointment;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onClick: () => void;
  onCheckIn: (appointment: Appointment) => void;
}) {
  const { options: priorityOptions } = useMasterValues('appointment.priority');

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'scheduled': 'bg-blue-100 text-blue-700',
      'confirmed': 'bg-green-100 text-green-700',
      'in-progress': 'bg-orange-100 text-orange-700',
      'completed': 'bg-gray-100 text-gray-700',
      'cancelled': 'bg-red-100 text-red-700',
      'no-show': 'bg-purple-100 text-purple-700',
    };
    return colors[status.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'low': 'bg-gray-100 text-gray-600',
      'normal': 'bg-blue-100 text-blue-600',
      'high': 'bg-orange-100 text-orange-600',
      'urgent': 'bg-red-100 text-red-600',
    };
    return colors[priority?.toLowerCase()] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div
      className={`p-4 border rounded-lg cursor-pointer transition-all ${
        selected ? 'bg-blue-50 border-blue-300' : 'border-gray-200 hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(e.target.checked);
          }}
          className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900 truncate">{appointment.patientName}</h4>
              <p className="text-sm text-gray-600 truncate">{appointment.reasonForVisit}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {['scheduled', 'confirmed'].includes(appointment.status?.toLowerCase()) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCheckIn(appointment);
                  }}
                  className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors"
                  title="Check-In Patient"
                >
                  <LogIn className="w-3 h-3" />
                  Check-In
                </button>
              )}
              <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(appointment.status)}`}>
                {appointment.status}
              </span>
              {appointment.priority && (
                <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getPriorityColor(appointment.priority)}`}>
                  {masterLabelForValue(priorityOptions, appointment.priority)}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span className="truncate">{appointment.doctorName}</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {new Date(appointment.appointmentDate).toLocaleDateString()}{appointment.startTime ? ` at ${appointment.startTime}` : ''}
            </span>
            {appointment.departmentName && (
              <span className="text-gray-500 truncate">{appointment.departmentName}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Appointment Details Modal - for viewing/managing existing appointments
function AppointmentDetailsModal({ 
  appointment, 
  isOpen, 
  onClose, 
  onCheckIn,
  onCancel,
  onReschedule
}: {
  appointment: Appointment;
  isOpen: boolean;
  onClose: () => void;
  onCheckIn: () => void;
  onCancel?: () => void;
  onReschedule?: () => void;
}) {
  const { options: priorityOptions } = useMasterValues('appointment.priority');
  const { options: typeOptions } = useMasterValues('appointment.type');

  if (!isOpen) return null;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'scheduled': 'bg-blue-100 text-blue-700 border-blue-200',
      'confirmed': 'bg-green-100 text-green-700 border-green-200',
      'in-progress': 'bg-orange-100 text-orange-700 border-orange-200',
      'completed': 'bg-gray-100 text-gray-700 border-gray-200',
      'cancelled': 'bg-red-100 text-red-700 border-red-200',
      'no-show': 'bg-purple-100 text-purple-700 border-purple-200',
      'checkedin': 'bg-teal-100 text-teal-700 border-teal-200',
    };
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'low': 'bg-gray-100 text-gray-600',
      'normal': 'bg-blue-100 text-blue-600',
      'high': 'bg-orange-100 text-orange-600',
      'urgent': 'bg-red-100 text-red-600',
    };
    return colors[priority?.toLowerCase()] || 'bg-gray-100 text-gray-600';
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  const canCheckIn = appointment.status && ['scheduled', 'confirmed'].includes(appointment.status.toLowerCase());
  const canModify = appointment.status && !['completed', 'cancelled', 'no-show'].includes(appointment.status.toLowerCase());

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Appointment Details</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Patient Info */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-semibold text-gray-900">{appointment.patientName || 'Unknown Patient'}</h3>
              <p className="text-sm text-gray-500">
                {appointment.patientMrn ? `MRN: ${appointment.patientMrn}` : `ID: ${appointment.patientId?.substring(0, 8)}...`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(appointment.status)}`}>
                {appointment.status || 'Unknown'}
              </span>
              {appointment.priority && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(appointment.priority)}`}>
                  {masterLabelForValue(priorityOptions, appointment.priority)} priority
                </span>
              )}
            </div>
          </div>

          {/* Date & Time */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <CalendarIcon className="w-5 h-5 text-gray-600" />
              <span className="font-medium text-gray-900">
                {appointment.appointmentDate ? formatDate(appointment.appointmentDate) : 'Date not set'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-600" />
              <span className="text-gray-700">
                {appointment.startTime || 'Time not set'}
                {appointment.endTime && ` - ${appointment.endTime}`}
                {(appointment.durationMinutes || appointment.duration) && ` (${appointment.durationMinutes || appointment.duration} min)`}
              </span>
            </div>
          </div>

          {/* Doctor & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
              <Stethoscope className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-xs text-gray-500">Doctor</p>
                <p className="font-medium text-gray-900">{appointment.doctorName || 'Not assigned'}</p>
              </div>
            </div>
            {appointment.departmentName && (
              <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                <MapPin className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-xs text-gray-500">Department</p>
                  <p className="font-medium text-gray-900">{appointment.departmentName}</p>
                </div>
              </div>
            )}
          </div>

          {/* Appointment Type & Reason */}
          {(appointment.appointmentType || appointment.reasonForVisit) && (
            <div className="space-y-3">
              {appointment.appointmentType && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">Type:</span>
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm font-medium capitalize">
                    {masterLabelForValue(typeOptions, appointment.appointmentType)}
                  </span>
                </div>
              )}
              {appointment.reasonForVisit && (
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Reason for Visit</p>
                    <p className="text-gray-700">{appointment.reasonForVisit}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {appointment.notes && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-600 font-medium mb-1">Notes</p>
              <p className="text-sm text-yellow-800">{appointment.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-3">
          {/* Primary Actions */}
          <div className="flex items-center gap-2">
            {canCheckIn && (
              <button
                onClick={onCheckIn}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <LogIn className="w-4 h-4" />
                Check-In
              </button>
            )}
            {canModify && onReschedule && (
              <button
                onClick={onReschedule}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <CalendarIcon className="w-4 h-4" />
                Reschedule
              </button>
            )}
          </div>
          
          {/* Secondary Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-white transition-colors font-medium text-gray-700"
            >
              Close
            </button>
            {canModify && onCancel && (
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium"
              >
                Cancel Appointment
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
