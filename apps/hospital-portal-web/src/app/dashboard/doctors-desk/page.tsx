'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Search, 
  Filter, 
  AlertCircle, 
  Clock, 
  Activity,
  Eye,
  TrendingUp,
  Calendar,
  ChevronRight,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';
import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';
import { useAuthStore } from '@/lib/auth-store';
import { useHasPermission } from '@/hooks/use-permissions';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { toast } from 'react-hot-toast';
import { doctorQueueApi, DoctorQueueItem, DoctorQueueStats } from '@/lib/api/doctorQueue.api';

interface Patient {
  id: string;
  name: string;
  mrn: string;
  age: number;
  gender: string;
  chiefComplaint: string;
  appointmentTime: string;
  examinationStatus: 'Complete' | 'Pending' | 'Partial';
  urgency: 'Emergency' | 'Urgent' | 'Routine';
  // Optometry examination summary
  visualAcuityOD?: string;
  visualAcuityOS?: string;
  iopOD?: number;
  iopOS?: number;
  hasRedFlags?: boolean;
  redFlags?: string[];
}

function PatientQueuePageContent() {
  const router = useRouter();
  const { user } = useAuthStore();
  const canEdit = useHasPermission('CLINICAL:EXAMINATION:EDIT');

  const [patients, setPatients] = useState<DoctorQueueItem[]>([]);
  const [stats, setStats] = useState<DoctorQueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('All');
  const [refreshing, setRefreshing] = useState(false);
  
  // SignalR connection state
  const [isConnected, setIsConnected] = useState(false);
  const hubConnectionRef = useRef<HubConnection | null>(null);

  // Load patient queue and stats from API
  const loadQueue = async () => {
    // Debug logging
    console.log('🔍 loadQueue called, user:', { id: user?.id, name: user?.name, username: user?.username });
    
    // Define mock data upfront (for demo/fallback)
    const mockPatients: DoctorQueueItem[] = [
        {
          id: '11111111-1111-1111-1111-111111111111',
          queueNumber: 1,
          patientId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          patientName: 'Ramesh Kumar',
          mrn: 'MRN001234',
          age: 65,
          gender: 'Male',
          chiefComplaint: 'Blurred vision, difficulty reading',
          appointmentTime: '09:00 AM',
          source: 'Appointment',
          status: 'Waiting',
          urgency: 'Routine',
          examinationStatus: 'Pending',
          visualAcuityOD: '6/36',
          visualAcuityOS: '6/24',
          iopOD: 16,
          iopOS: 15,
          hasRedFlags: false,
          redFlags: [],
          waitTime: 15,
          checkedInAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          optometryCompletedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          priority: 2,
          hasOptometryData: true,
          priorityScore: 2
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          queueNumber: 2,
          patientId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          patientName: 'Lakshmi Devi',
          mrn: 'MRN005678',
          age: 58,
          gender: 'Female',
          chiefComplaint: 'Sudden vision loss, floaters',
          appointmentTime: '09:15 AM',
          source: 'Optometry',
          status: 'Waiting',
          urgency: 'Emergency',
          examinationStatus: 'Pending',
          visualAcuityOD: '6/60',
          visualAcuityOS: 'HM',
          iopOD: 14,
          iopOS: 13,
          hasRedFlags: true,
          redFlags: ['Sudden vision loss', 'Floaters', 'Poor visual acuity OS'],
          waitTime: 5,
          checkedInAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          optometryCompletedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
          priority: 1,
          hasOptometryData: true,
          priorityScore: 1
        },
        {
          id: '33333333-3333-3333-3333-333333333333',
          queueNumber: 3,
          patientId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          patientName: 'Suresh Babu',
          mrn: 'MRN009012',
          age: 72,
          gender: 'Male',
          chiefComplaint: 'Eye pain, headache, halos around lights',
          appointmentTime: '09:30 AM',
          source: 'Optometry',
          status: 'Waiting',
          urgency: 'Urgent',
          examinationStatus: 'Pending',
          visualAcuityOD: '6/12',
          visualAcuityOS: '6/9',
          iopOD: 42,
          iopOS: 38,
          hasRedFlags: true,
          redFlags: ['High IOP OD: 42 mmHg', 'High IOP OS: 38 mmHg', 'Acute angle closure suspect'],
          waitTime: 8,
          checkedInAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
          optometryCompletedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
          priority: 1,
          hasOptometryData: true,
          priorityScore: 1
        },
      ];
      
    const mockStats: DoctorQueueStats = {
      totalWaiting: 3,
      inProgress: 1,
      completedToday: 5,
      referred: 0,
      emergencyCount: 1,
      urgentCount: 1,
      averageConsultationTime: 15,
      averageWaitTime: 9,
      appointmentPatients: 1,
      walkInPatients: 0,
      fromOptometry: 2
    };
    
    // If no user ID, just show mock data
    if (!user?.id) {
      console.log('⚠️ No user.id, loading mock data only');
      setPatients(mockPatients);
      setStats(mockStats);
      toast.info('Demo mode: showing sample patients (no user logged in)');
      return;
    }
    
    // Try to fetch real data from API
    try {
      setLoading(true);
      console.log('🌐 Attempting API call with user.id:', user.id);
      
      const [queueData, statsData] = await Promise.all([
        doctorQueueApi.getQueue({ date: new Date().toISOString().split('T')[0] }),
        doctorQueueApi.getStats(user.id)
      ]);
      
      console.log('✅ API success - queue items:', queueData.length);
      
      // If API returns empty, still show mock data for demo
      if (queueData.length === 0) {
        console.log('📋 API returned empty, using mock data');
        setPatients(mockPatients);
        setStats(mockStats);
        toast.info('No real patients in queue, showing demo data');
      } else {
        setPatients(queueData);
        setStats(statsData);
      }
    } catch (error: any) {
      console.error('❌ API failed:', error);
      setPatients(mockPatients);
      setStats(mockStats);
      toast.error('Failed to load queue from API, showing demo data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
    
    // Setup SignalR connection for real-time queue updates
    const setupSignalR = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5073/api';
        const hubUrl = apiUrl.replace('/api', '/hubs/queue');
        
        // Get auth token from localStorage
        const token = localStorage.getItem('authToken');
        
        const connection = new HubConnectionBuilder()
          .withUrl(hubUrl, {
            accessTokenFactory: () => token || '',
          })
          .withAutomaticReconnect()
          .configureLogging(LogLevel.Information)
          .build();

        // Event: Connection established
        connection.onreconnecting(() => {
          setIsConnected(false);
          console.log('🔄 SignalR reconnecting...');
        });

        connection.onreconnected(() => {
          setIsConnected(true);
          console.log('✅ SignalR reconnected');
          toast.success('Queue connection restored', { duration: 2000 });
        });

        connection.onclose(() => {
          setIsConnected(false);
          console.log('❌ SignalR connection closed');
        });

        // Event: Queue update (new patient, status change, etc.)
        connection.on('QueueUpdate', (data: any) => {
          console.log('📢 QueueUpdate received:', data);
          toast.info('Queue updated', { duration: 2000 });
          loadQueue(); // Refresh queue data
        });

        // Event: Token called (patient called to room)
        connection.on('TokenCalled', (data: any) => {
          console.log('🔔 TokenCalled received:', data);
          toast.success(`Token ${data.tokenNumber} called to ${data.roomNumber}`, { duration: 3000 });
          loadQueue(); // Refresh queue data
        });

        // Event: Subscription confirmed
        connection.on('SubscriptionConfirmed', (data: any) => {
          console.log('✅ Subscription confirmed:', data);
        });

        // Start connection
        await connection.start();
        console.log('✅ SignalR connected to', hubUrl);
        setIsConnected(true);
        
        // Subscribe to doctor's queue updates (using branch-wide subscription)
        // In production, you'd get branchId from user profile or localStorage
        const branchId = localStorage.getItem('branchId') || '00000000-0000-0000-0000-000000000001';
        await connection.invoke('SubscribeToBranch', branchId);
        
        hubConnectionRef.current = connection;
        
        toast.success('Real-time queue notifications enabled', { duration: 3000 });
      } catch (error) {
        console.error('❌ SignalR connection failed:', error);
        setIsConnected(false);
        // Don't show toast error - polling will still work
      }
    };

    setupSignalR();
    
    // Fallback polling (now every 60 seconds since we have real-time updates)
    const refreshInterval = setInterval(() => {
      if (!isConnected) {
        // Only poll if SignalR is disconnected
        loadQueue();
      }
    }, 60000);
    
    return () => {
      clearInterval(refreshInterval);
      // Cleanup SignalR connection
      if (hubConnectionRef.current) {
        hubConnectionRef.current.stop();
      }
    };
  }, [user]);

  // Filter patients
  const filteredPatients = patients.filter((patient) => {
    const matchesSearch =
      patient.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.mrn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.chiefComplaint?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesUrgency = urgencyFilter === 'All' || patient.urgency === urgencyFilter;
    const matchesStatus = statusFilter === 'All' || patient.status === statusFilter;

    return matchesSearch && matchesUrgency && matchesStatus;
  });

  // Sort patients by priority (already prioritized by backend)
  const sortedPatients = [...filteredPatients].sort((a, b) => a.priority - b.priority);

  const handleStartConsultation = async (patient: DoctorQueueItem) => {
    if (!user?.id) {
      toast.error('User not authenticated');
      return;
    }
    
    try {
      console.log('🚀 Starting consultation for queue item:', patient.id);
      
      // Try to mark consultation as started in backend
      try {
        await doctorQueueApi.startConsultation(patient.id, user.id);
        console.log('✅ Backend API call successful');
      } catch (apiError: any) {
        // If queue item doesn't exist in backend (404), continue anyway for demo
        console.warn('⚠️ Backend API failed (expected for mock data):', apiError.response?.status);
        if (apiError.response?.status !== 404) {
          throw apiError; // Re-throw if it's not a 404
        }
      }
      
      // Navigate to examination page (works with or without backend)
      console.log('🔀 Navigating to examination page for patient:', patient.patientId);
      router.push(`/dashboard/doctors-desk/${patient.patientId}`);
      toast.success('Starting examination for ' + patient.patientName);
    } catch (error: any) {
      console.error('❌ Failed to start consultation:', error);
      toast.error('Failed to start consultation: ' + (error.message || 'Unknown error'));
    }
  };
  
  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadQueue();
    setRefreshing(false);
    toast.success('Queue refreshed');
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'Emergency':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'Urgent':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Routine':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-blue-100 text-blue-800';
      case 'In Consultation':
        return 'bg-purple-100 text-purple-800';
      case 'Waiting':
        return 'bg-yellow-100 text-yellow-800';
      case 'Checked In':
        return 'bg-green-100 text-green-800';
      case 'Skipped':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="staff-page">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-page staff-page-stack">
      {/* Header */}
      <div className="flex items-center justify-between gap-[var(--toolbar-gap)]">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center max-[1599px]:[font-size:var(--page-title-size)] max-[1599px]:[line-height:var(--page-title-leading)]">
            <Users className="w-7 h-7 mr-3 text-blue-600 max-[1599px]:w-5 max-[1599px]:h-5 max-[1599px]:mr-2" />
            Doctor's Desk - Patient Queue
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Review patients who have completed optometry examinations
          </p>
        </div>
        <div className="flex items-center gap-[var(--toolbar-gap)]">
          {/* SignalR Connection Status Indicator */}
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-700 border border-green-300' 
              : 'bg-gray-100 text-gray-500 border border-gray-300'
          }`}>
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>Live Updates</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Polling Mode</span>
              </>
            )}
          </div>
          
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Queue'}</span>
          </button>
          <div className="text-right">
            <p className="text-sm text-gray-500">Logged in as</p>
            <p className="font-semibold text-gray-900">{user?.name || user?.username || 'Doctor'}</p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-4 staff-kpi-grid">
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg staff-kpi-pad">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-semibold">Total Waiting</p>
              <p className="text-3xl font-bold text-blue-900 max-[1599px]:[font-size:var(--kpi-value-size)]">{stats?.totalWaiting ?? patients.length}</p>
            </div>
            <Users className="w-10 h-10 text-blue-400 max-[1599px]:w-8 max-[1599px]:h-8" />
          </div>
        </div>

        <div className="bg-red-50 border-2 border-red-200 rounded-lg staff-kpi-pad">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-semibold">Emergency</p>
              <p className="text-3xl font-bold text-red-900 max-[1599px]:[font-size:var(--kpi-value-size)]">
                {stats?.emergencyCount ?? patients.filter((p) => p.urgency === 'Emergency').length}
              </p>
            </div>
            <AlertCircle className="w-10 h-10 text-red-400 max-[1599px]:w-8 max-[1599px]:h-8" />
          </div>
        </div>

        <div className="bg-orange-50 border-2 border-orange-200 rounded-lg staff-kpi-pad">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600 font-semibold">Urgent</p>
              <p className="text-3xl font-bold text-orange-900 max-[1599px]:[font-size:var(--kpi-value-size)]">
                {stats?.urgentCount ?? patients.filter((p) => p.urgency === 'Urgent').length}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-orange-400 max-[1599px]:w-8 max-[1599px]:h-8" />
          </div>
        </div>

        <div className="bg-green-50 border-2 border-green-200 rounded-lg staff-kpi-pad">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-semibold">Completed Today</p>
              <p className="text-3xl font-bold text-green-900 max-[1599px]:[font-size:var(--kpi-value-size)]">
                {stats?.completedToday ?? patients.filter((p) => p.examinationStatus === 'Complete').length}
              </p>
            </div>
            <Activity className="w-10 h-10 text-green-400 max-[1599px]:w-8 max-[1599px]:h-8" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border-2 border-gray-200 rounded-lg staff-kpi-pad">
        <div className="grid grid-cols-4 staff-toolbar-gap">
          {/* Search */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="w-4 h-4 inline mr-2" />
              Search Patients
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, MRN, or complaint..."
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl font-bold"
                  title="Clear search"
                  type="button"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Urgency Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-2" />
              Urgency
            </label>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All</option>
              <option value="Emergency">Emergency</option>
              <option value="Urgent">Urgent</option>
              <option value="Routine">Routine</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Activity className="w-4 h-4 inline mr-2" />
              Exam Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All</option>
              <option value="Complete">Complete</option>
              <option value="Partial">Partial</option>
              <option value="Pending">Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Patient List */}
      <div className="flex flex-col gap-[var(--toolbar-gap)]">
        {sortedPatients.length === 0 ? (
          <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-8 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            {searchTerm || urgencyFilter !== 'All' || statusFilter !== 'All' ? (
              <>
                <p className="text-gray-500 text-lg font-medium">No patients match your filters</p>
                <p className="text-gray-400 text-sm mb-4">Try adjusting your search or filters</p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setUrgencyFilter('All');
                    setStatusFilter('All');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Clear All Filters
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-500 text-lg">No patients in queue</p>
                <p className="text-gray-400 text-sm mt-2">Patients will appear here after optometry examination</p>
              </>
            )}
          </div>
        ) : (
          sortedPatients.map((patient) => (
            <div
              key={patient.id}
              onClick={() => handleStartConsultation(patient)}
              className="bg-white border-2 border-gray-200 rounded-lg staff-kpi-pad hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer"
            >
              {/* Patient Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-700 font-bold text-lg">
                      {patient.patientName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-bold text-gray-900">{patient.patientName}</h3>
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold">
                        Q#{patient.queueNumber}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                      <span className="font-mono">{patient.mrn}</span>
                      <span>•</span>
                      <span>{patient.age} years</span>
                      <span>•</span>
                      <span>{patient.gender}</span>
                      {patient.appointmentTime && (
                        <>
                          <span>•</span>
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {patient.appointmentTime}
                          </span>
                        </>
                      )}
                      {patient.waitTime && (
                        <>
                          <span>•</span>
                          <span className="text-orange-600 font-semibold">
                            Wait: {patient.waitTime} min
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                      patient.status
                    )}`}
                  >
                    {patient.status}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${getUrgencyColor(
                      patient.urgency
                    )}`}
                  >
                    {patient.urgency}
                  </span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>

              {/* Chief Complaint */}
              <div className="bg-purple-50 border border-purple-200 rounded-md p-3 mb-3">
                <p className="text-sm font-semibold text-purple-900 mb-1">Chief Complaint:</p>
                <p className="text-sm text-purple-800">{patient.chiefComplaint}</p>
              </div>

              {/* Red Flags Alert */}
              {patient.hasRedFlags && patient.redFlags && (
                <div className="bg-red-50 border-2 border-red-300 rounded-md p-3 mb-3">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-900 mb-1">⚠️ Red Flags Detected:</p>
                      <ul className="text-sm text-red-800 space-y-1">
                        {patient.redFlags.map((flag, index) => (
                          <li key={index}>• {flag}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Optometry Summary */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-md p-3">
                  <p className="text-xs text-blue-600 font-semibold mb-1">Visual Acuity</p>
                  <div className="space-y-1">
                    <p className="text-sm font-mono text-blue-900">
                      OD: {patient.visualAcuityOD || 'N/A'}
                    </p>
                    <p className="text-sm font-mono text-blue-900">
                      OS: {patient.visualAcuityOS || 'N/A'}
                    </p>
                  </div>
                </div>

                <div
                  className={`rounded-md p-3 ${
                    (patient.iopOD && patient.iopOD > 21) || (patient.iopOS && patient.iopOS > 21)
                      ? 'bg-red-50'
                      : 'bg-green-50'
                  }`}
                >
                  <p
                    className={`text-xs font-semibold mb-1 ${
                      (patient.iopOD && patient.iopOD > 21) || (patient.iopOS && patient.iopOS > 21)
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}
                  >
                    IOP (mmHg)
                  </p>
                  <div className="space-y-1">
                    <p
                      className={`text-sm font-mono ${
                        patient.iopOD && patient.iopOD > 21 ? 'text-red-900 font-bold' : 'text-green-900'
                      }`}
                    >
                      OD: {patient.iopOD || 'N/A'}
                      {patient.iopOD && patient.iopOD > 21 && ' ⚠️'}
                    </p>
                    <p
                      className={`text-sm font-mono ${
                        patient.iopOS && patient.iopOS > 21 ? 'text-red-900 font-bold' : 'text-green-900'
                      }`}
                    >
                      OS: {patient.iopOS || 'N/A'}
                      {patient.iopOS && patient.iopOS > 21 && ' ⚠️'}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-md p-3 col-span-2">
                  <p className="text-xs text-gray-600 font-semibold mb-2">Quick Actions:</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartConsultation(patient);
                    }}
                    className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Start Examination
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function PatientQueuePage() {
  return (
    <ProtectedRoute requiredPermission="CLINICAL:EXAMINATION:VIEW">
      <PatientQueuePageContent />
    </ProtectedRoute>
  );
}
