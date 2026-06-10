'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  AlertCircle,
  Clock,
  Activity,
  Eye,
  PlayCircle,
  SkipForward,
  CheckCircle2,
  Send,
  UserCheck,
  Timer,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { useHasPermission } from '@/hooks/use-permissions';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { optometryQueueApi, type OptometryQueueItem } from '@/lib/api/optometry.api';
import {
  useOptometryQueueQuery,
  useOptometryStatsQuery,
  useOptometryServiceRoomsQuery,
  useOptometryQueueRealtime,
  useInvalidateOptometryQueue,
} from '@/hooks/use-optometry-queue';
import { useOptometryPatientSearch } from '@/hooks/use-optometry-patient-search';
import type { DirectoryPatientRow } from '@/lib/optometry/optometry-patient-search';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type QueueLoadState = 'loading' | 'live' | 'error' | 'no-branch';

function OptometristDashboardContent() {
  const router = useRouter();
  const { user } = useAuthStore();
  const canView = useHasPermission('CLINICAL:EXAMINATION:VIEW');
  const canEdit = useHasPermission('CLINICAL:EXAMINATION:EDIT');
  const invalidate = useInvalidateOptometryQueue();

  const branchId = user?.branchId ?? (typeof window !== 'undefined' ? localStorage.getItem('branchId') ?? undefined : undefined);

  const { isConnected, pollInterval } = useOptometryQueueRealtime(branchId, true);
  const queueQuery = useOptometryQueueQuery(branchId, true, { refetchInterval: pollInterval });
  const statsQuery = useOptometryStatsQuery(branchId, { refetchInterval: pollInterval });
  const roomsQuery = useOptometryServiceRoomsQuery(branchId);

  const patients = queueQuery.data ?? [];
  const stats = statsQuery.data ?? null;
  const rooms = roomsQuery.data ?? [];
  const loading = (queueQuery.isLoading || statsQuery.isLoading) && patients.length === 0;
  const loadState: QueueLoadState = !branchId
    ? 'no-branch'
    : queueQuery.isError
      ? 'error'
      : queueQuery.isSuccess
        ? 'live'
        : 'loading';
  const loadError = queueQuery.error instanceof Error ? queueQuery.error.message : null;
  const lastUpdated = queueQuery.dataUpdatedAt ? new Date(queueQuery.dataUpdatedAt) : null;

  const [selectedRoom, setSelectedRoom] = useState('OPT-1');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [startingVisitId, setStartingVisitId] = useState<string | null>(null);
  const [openingPatientId, setOpeningPatientId] = useState<string | null>(null);
  const [complaintDialogOpen, setComplaintDialogOpen] = useState(false);
  const [complaintDraft, setComplaintDraft] = useState('');
  const [pendingDirectoryPatient, setPendingDirectoryPatient] = useState<DirectoryPatientRow | null>(null);

  const { directoryResults, isSearching, searchError, isActive: isSearchActive, minChars } =
    useOptometryPatientSearch(branchId, searchTerm);

  useEffect(() => {
    if (!branchId || rooms.length === 0) return;
    const stored = localStorage.getItem(`optometry-room-${branchId}`);
    if (stored && rooms.some((room) => room.roomCode === stored)) {
      setSelectedRoom(stored);
    } else if (rooms[0]) {
      setSelectedRoom(rooms[0].roomCode);
    }
  }, [branchId, rooms]);

  const refreshQueue = () => {
    if (branchId) invalidate(branchId);
  };

  const handleCallNext = async () => {
    if (!branchId) {
      toast.error('Branch not configured for your user');
      return;
    }
    try {
      const nextPatient = await optometryQueueApi.callNext({
        branchId,
        roomCode: selectedRoom,
        optometristName: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
      });
      toast.success(`Calling: ${nextPatient.patientName} (Token: ${nextPatient.tokenNumber}) → Room ${selectedRoom}`);
      openExam(nextPatient);
      refreshQueue();
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'No patients waiting in queue');
    }
  };

  const openExam = (patient: OptometryQueueItem) => {
    const visitId = patient.visitId ?? patient.id;
    const params = new URLSearchParams({
      patientId: patient.patientId,
      visitId,
      tab: 'medical-history',
    });
    if (patient.chiefComplaint) params.set('complaint', patient.chiefComplaint);
    router.push(`/dashboard/optometrist/exam?${params.toString()}`);
  };

  const handleStartExam = (patient: OptometryQueueItem) => {
    const visitId = patient.visitId ?? patient.id;
    openExam(patient);

    if (patient.status === 'Waiting' && canEdit) {
      setStartingVisitId(visitId);
      void optometryQueueApi
        .startExam(visitId, selectedRoom)
        .then(() => {
          if (branchId) invalidate(branchId);
        })
        .catch(() => {
          // Exam already open; queue will refresh on next poll
        })
        .finally(() => {
          setStartingVisitId((current) => (current === visitId ? null : current));
        });
    }
  };

  const handleSkip = async (patient: OptometryQueueItem) => {
    try {
      await optometryQueueApi.skipPatient(patient.visitId ?? patient.id, 'Patient not available');
      toast.success(`Skipped: ${patient.patientName}`);
      refreshQueue();
    } catch {
      toast.error('Failed to skip patient');
    }
  };

  const handleReferToDoctor = (patient: OptometryQueueItem) => {
    const visitId = patient.visitId ?? patient.id;
    router.push(`/dashboard/optometrist/refer-doctor?patientId=${patient.patientId}&visitId=${visitId}`);
  };

  const handleViewEducation = (patient: OptometryQueueItem) => {
    const visitId = patient.visitId ?? patient.id;
    router.push(`/dashboard/optometrist/patient-education?patientId=${patient.patientId}&visitId=${visitId}`);
  };

  const handleRoomChange = (code: string) => {
    setSelectedRoom(code);
    if (branchId) localStorage.setItem(`optometry-room-${branchId}`, code);
  };

  const handleOpenDirectoryExamClick = (patient: DirectoryPatientRow) => {
    if (!branchId) {
      toast.error('Branch not configured for your user');
      return;
    }
    if (!canEdit) {
      toast.error('You do not have permission to start examinations');
      return;
    }
    setPendingDirectoryPatient(patient);
    setComplaintDraft('');
    setComplaintDialogOpen(true);
  };

  const handleConfirmOpenDirectoryExam = async () => {
    if (!pendingDirectoryPatient || !branchId) return;

    const patient = pendingDirectoryPatient;
    setComplaintDialogOpen(false);
    setOpeningPatientId(patient.id);
    try {
      const queueItem = await optometryQueueApi.openExam({
        branchId,
        patientId: patient.id,
        roomCode: selectedRoom,
        optometristName: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
        chiefComplaint: complaintDraft.trim() || undefined,
      });
      toast.success(`Opening examination for ${queueItem.patientName}`);
      openExam(queueItem);
      refreshQueue();
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Failed to open examination');
    } finally {
      setOpeningPatientId((current) => (current === patient.id ? null : current));
      setPendingDirectoryPatient(null);
      setComplaintDraft('');
    }
  };

  const matchesStatusFilters = (patient: OptometryQueueItem) => {
    const matchesStatus = statusFilter === 'All' || patient.status === statusFilter;
    const matchesUrgency = urgencyFilter === 'All' || patient.urgency === urgencyFilter;
    const matchesSource = sourceFilter === 'All' || patient.source === sourceFilter;
    return matchesStatus && matchesUrgency && matchesSource;
  };

  const matchesSearchTerm = (patient: OptometryQueueItem) => {
    if (!isSearchActive) return true;
    const q = searchTerm.trim().toLowerCase();
    return (
      patient.patientName.toLowerCase().includes(q) ||
      patient.mrn.toLowerCase().includes(q) ||
      patient.tokenNumber.toLowerCase().includes(q)
    );
  };

  const filteredPatients = patients.filter(
    (patient) => matchesSearchTerm(patient) && matchesStatusFilters(patient),
  );

  const sortedPatients = [...filteredPatients].sort((a, b) => {
    const statusOrder: Record<string, number> = { 'In Progress': 0, Waiting: 1, Completed: 2, Referred: 3, Skipped: 4 };
    const urgencyOrder: Record<string, number> = { Emergency: 0, Urgent: 1, Routine: 2 };
    if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    return 0;
  });

  const allQueuePatientIds = new Set(patients.map((p) => p.patientId));
  const directoryOnlyPatients = isSearchActive
    ? directoryResults.filter((p) => !allQueuePatientIds.has(p.id))
    : [];
  const handleStatClick = (type: string) => {
    if (type === 'Emergency') {
      setStatusFilter('All');
      setUrgencyFilter(urgencyFilter === 'Emergency' ? 'All' : 'Emergency');
    } else {
      setUrgencyFilter('All');
      setStatusFilter(statusFilter === type ? 'All' : type);
    }
  };

  const isStatActive = (type: string) => {
    if (type === 'Emergency') return urgencyFilter === 'Emergency';
    return statusFilter === type;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Waiting': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'Referred': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Skipped': return 'bg-gray-100 text-gray-500 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'Emergency': return 'bg-red-100 text-red-800 border-red-300';
      case 'Urgent': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Routine': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'OPD': return 'bg-blue-50 text-blue-700';
      case 'Walk-in': return 'bg-teal-50 text-teal-700';
      case 'Post-Op': return 'bg-purple-50 text-purple-700';
      case 'Follow-up': return 'bg-indigo-50 text-indigo-700';
      default: return 'bg-gray-50 text-gray-700';
    }
  };

  if (loading && patients.length === 0 && loadState === 'loading') {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (loadState === 'no-branch') {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] px-6">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-gray-800 font-semibold">Branch not configured</p>
          <p className="text-gray-500 text-sm mt-1">Your user profile needs a branch assignment to load the live optometry queue.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Data source indicator */}
      <div className={`px-6 py-2 text-xs flex items-center justify-between border-b ${
        loadState === 'live' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
        loadState === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
        'bg-gray-50 border-gray-200 text-gray-600'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${
            loadState === 'live' ? 'bg-emerald-500 animate-pulse' : loadState === 'error' ? 'bg-red-500' : 'bg-gray-400'
          }`} />
          {loadState === 'live' && (
            <span>
              <strong>Live queue</strong>
              {isConnected ? ' · Real-time' : pollInterval ? ' · Polling' : ''}
              {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString()}`}
              {` · ${patients.length} patient${patients.length !== 1 ? 's' : ''}`}
            </span>
          )}
          {loadState === 'error' && (
            <span><strong>Queue unavailable</strong>{loadError ? ` — ${loadError}` : ''}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {rooms.length > 0 && (
            <label className="flex items-center gap-1.5">
              <span className="font-medium">Room:</span>
              <select
                value={selectedRoom}
                onChange={(e) => handleRoomChange(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
              >
                {rooms.map((r) => (
                  <option key={r.roomCode} value={r.roomCode}>{r.label}</option>
                ))}
              </select>
            </label>
          )}
          {loadState === 'error' && (
            <button type="button" onClick={refreshQueue} className="underline font-medium">Retry</button>
          )}
        </div>
      </div>
      {/* Top Stats Bar — flush to top, no gaps */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Stat Cards */}
          <div className="flex items-center gap-4 flex-1">
            <div
              onClick={() => handleStatClick('Waiting')}
              title="Click to filter by Waiting patients"
              className={`flex-1 flex items-center gap-3 rounded-lg px-5 py-3 cursor-pointer transition-all ${
                isStatActive('Waiting')
                  ? 'bg-amber-100 border-2 border-amber-400 ring-2 ring-amber-200 shadow-sm'
                  : 'bg-amber-50 border border-amber-200 hover:border-amber-300 hover:shadow-sm'
              }`}
            >
              <Clock className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide">Waiting</p>
                <p className="text-2xl font-bold text-amber-900">{stats?.totalWaiting ?? 0}</p>
              </div>
            </div>
            <div
              onClick={() => handleStatClick('In Progress')}
              title="Click to filter by In Progress patients"
              className={`flex-1 flex items-center gap-3 rounded-lg px-5 py-3 cursor-pointer transition-all ${
                isStatActive('In Progress')
                  ? 'bg-blue-100 border-2 border-blue-400 ring-2 ring-blue-200 shadow-sm'
                  : 'bg-blue-50 border border-blue-200 hover:border-blue-300 hover:shadow-sm'
              }`}
            >
              <Activity className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">In Progress</p>
                <p className="text-2xl font-bold text-blue-900">{stats?.inProgress ?? 0}</p>
              </div>
            </div>
            <div
              onClick={() => handleStatClick('Completed')}
              title="Click to filter by Completed patients"
              className={`flex-1 flex items-center gap-3 rounded-lg px-5 py-3 cursor-pointer transition-all ${
                isStatActive('Completed')
                  ? 'bg-emerald-100 border-2 border-emerald-400 ring-2 ring-emerald-200 shadow-sm'
                  : 'bg-emerald-50 border border-emerald-200 hover:border-emerald-300 hover:shadow-sm'
              }`}
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">Completed Today</p>
                <p className="text-2xl font-bold text-emerald-900">{stats?.completed ?? 0}</p>
              </div>
            </div>
            <div
              onClick={() => handleStatClick('Referred')}
              title="Click to filter by Referred patients"
              className={`flex-1 flex items-center gap-3 rounded-lg px-5 py-3 cursor-pointer transition-all ${
                isStatActive('Referred')
                  ? 'bg-violet-100 border-2 border-violet-400 ring-2 ring-violet-200 shadow-sm'
                  : 'bg-violet-50 border border-violet-200 hover:border-violet-300 hover:shadow-sm'
              }`}
            >
              <Send className="w-5 h-5 text-violet-500" />
              <div>
                <p className="text-[11px] font-semibold text-violet-600 uppercase tracking-wide">Referred</p>
                <p className="text-2xl font-bold text-violet-900">{stats?.referred ?? 0}</p>
              </div>
            </div>
            <div
              onClick={() => handleStatClick('Emergency')}
              title="Click to filter by Emergency patients"
              className={`flex-1 flex items-center gap-3 rounded-lg px-5 py-3 cursor-pointer transition-all ${
                isStatActive('Emergency')
                  ? 'bg-red-100 border-2 border-red-400 ring-2 ring-red-200 shadow-sm'
                  : 'bg-red-50 border border-red-200 hover:border-red-300 hover:shadow-sm'
              }`}
            >
              <AlertCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wide">Emergency</p>
                <p className="text-2xl font-bold text-red-900">{stats?.emergencyCount ?? 0}</p>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-5 py-3">
              <Timer className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Avg Wait</p>
                <p className="text-2xl font-bold text-slate-900">{stats?.averageWaitTime ?? 0}<span className="text-sm font-medium ml-0.5">m</span></p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="shrink-0 ml-4">
            <button
              onClick={handleCallNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 text-sm font-bold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <PlayCircle className="w-5 h-5" />
              Call Next Patient
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, MRN, token, or phone (min 3 chars)..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Results Counter */}
          <div className="bg-white border border-gray-300 rounded-md px-4 py-2">
            <p className="text-sm font-semibold text-gray-700 whitespace-nowrap">
              {isSearchActive ? (
                <>
                  <span className="text-blue-600">{sortedPatients.length}</span>
                  <span className="text-gray-500 mx-1">in queue</span>
                  <span className="text-gray-400 mx-1">·</span>
                  <span className="text-violet-600">{directoryOnlyPatients.length}</span>
                  <span className="text-gray-500 ml-1 font-normal">other</span>
                </>
              ) : (
                <>
                  <span className="text-blue-600">{sortedPatients.length}</span>
                  <span className="text-gray-500 mx-1">/</span>
                  <span className="text-gray-600">{patients.length}</span>
                  <span className="text-gray-500 ml-1 font-normal">patients</span>
                </>
              )}
            </p>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Status</option>
            <option value="Waiting">Waiting</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Referred">Referred</option>
          </select>
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Urgency</option>
            <option value="Emergency">Emergency</option>
            <option value="Urgent">Urgent</option>
            <option value="Routine">Routine</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Sources</option>
            <option value="OPD">OPD</option>
            <option value="Walk-in">Walk-in</option>
            <option value="Post-Op">Post-Op</option>
            <option value="Follow-up">Follow-up</option>
          </select>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {isSearching
              ? 'Searching…'
              : searchTerm.trim().length > 0 && searchTerm.trim().length < minChars
                ? `Type ${minChars}+ characters`
                : `${sortedPatients.length + directoryOnlyPatients.length} result${sortedPatients.length + directoryOnlyPatients.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        {searchError && (
          <p className="text-xs text-red-600 mt-1.5">{searchError}</p>
        )}
      </div>

      {/* Patient Queue List — scrollable area */}
      <div className="flex-1 overflow-auto px-5 py-3 space-y-2.5 bg-gray-50">
        {sortedPatients.length === 0 && directoryOnlyPatients.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center mt-6">
            <Users className="w-14 h-14 text-gray-300 mx-auto mb-3" />
            {isSearchActive ? (
              <>
                <p className="text-gray-500 text-base font-medium">No patients found</p>
                <p className="text-gray-400 text-sm mt-1">
                  No queue or directory matches for &ldquo;{searchTerm.trim()}&rdquo;
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-500 text-base font-medium">No patients in queue</p>
                <p className="text-gray-400 text-sm mt-1">
                  {loadState === 'live'
                    ? 'Patients appear here after front desk sends them to optometry'
                    : 'POST /api/seed/optometry-queue?reset=true to load demo queue data'}
                </p>
              </>
            )}
          </div>
        )}

        {isSearchActive && sortedPatients.length > 0 && (
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 pt-1">
            In queue ({sortedPatients.length})
          </p>
        )}

        {sortedPatients.map((patient) => (
            <div
              key={patient.id}
              className={`bg-white border rounded-lg p-4 transition-all ${
                patient.status === 'In Progress'
                  ? 'border-blue-300 shadow-sm ring-1 ring-blue-100'
                  : patient.status === 'Completed'
                  ? 'border-gray-200 opacity-70'
                  : patient.hasRedFlags
                  ? 'border-red-200'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              {/* Patient Header */}
              <div className="flex items-start justify-between mb-2.5">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-blue-50 border border-blue-200 rounded-full flex items-center justify-center">
                      <span className="text-blue-700 font-semibold text-sm">
                        {patient.patientName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                    {patient.status === 'In Progress' && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{patient.patientName}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{patient.mrn}</span>
                      <span>{patient.age}y / {patient.gender}</span>
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-0.5" />
                        {patient.appointmentTime}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getSourceBadge(patient.source)}`}>
                        {patient.source}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-mono font-semibold">
                    #{patient.tokenNumber}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getStatusColor(patient.status)}`}>
                    {patient.status}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getUrgencyColor(patient.urgency)}`}>
                    {patient.urgency}
                  </span>
                </div>
              </div>

              {/* Chief Complaint */}
              <div className="bg-gray-50 rounded px-3 py-2 mb-2">
                <p className="text-xs text-gray-700">
                  <span className="font-semibold text-gray-800">Complaint:</span> {patient.chiefComplaint}
                </p>
                {patient.isReturnVisit && (
                  <p className="text-[10px] mt-1 text-teal-700 font-semibold">
                    Return visit · Pass {patient.passNumber ?? 2}
                    {patient.reasonLabel ? ` · ${patient.reasonLabel}` : ''}
                  </p>
                )}
              </div>

              {/* Red Flags */}
              {patient.hasRedFlags && patient.redFlags && patient.redFlags.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded px-3 py-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <span className="text-[10px] font-bold text-red-700 uppercase">Red Flags:</span>
                    <div className="flex flex-wrap gap-1">
                      {patient.redFlags.map((flag, i) => (
                        <span key={i} className="bg-red-100 text-red-700 text-[11px] px-1.5 py-0.5 rounded">
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Completed exams + Optometry Summary (for completed/in-progress) */}
              {patient.completedExams.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase">Exams:</span>
                    {patient.completedExams.map((exam, i) => (
                      <span key={i} className="bg-emerald-50 text-emerald-700 text-[11px] px-1.5 py-0.5 rounded border border-emerald-200">
                        ✓ {exam}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Optometry Quick Summary */}
              {(patient.visualAcuityOD || patient.iopOD) && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="bg-blue-50 rounded px-2.5 py-2">
                    <p className="text-[10px] text-blue-600 font-semibold uppercase mb-0.5">Visual Acuity</p>
                    <p className="text-xs font-mono text-blue-900">OD: {patient.visualAcuityOD || 'N/A'}</p>
                    <p className="text-xs font-mono text-blue-900">OS: {patient.visualAcuityOS || 'N/A'}</p>
                  </div>
                  <div className={`rounded px-2.5 py-2 ${
                    (patient.iopOD && patient.iopOD > 21) || (patient.iopOS && patient.iopOS > 21) ? 'bg-red-50' : 'bg-emerald-50'
                  }`}>
                    <p className={`text-[10px] font-semibold uppercase mb-0.5 ${
                      (patient.iopOD && patient.iopOD > 21) || (patient.iopOS && patient.iopOS > 21) ? 'text-red-600' : 'text-emerald-600'
                    }`}>IOP (mmHg)</p>
                    <p className={`text-xs font-mono ${patient.iopOD && patient.iopOD > 21 ? 'text-red-900 font-bold' : 'text-emerald-900'}`}>
                      OD: {patient.iopOD ?? 'N/A'} {patient.iopOD && patient.iopOD > 21 && '⚠️'}
                    </p>
                    <p className={`text-xs font-mono ${patient.iopOS && patient.iopOS > 21 ? 'text-red-900 font-bold' : 'text-emerald-900'}`}>
                      OS: {patient.iopOS ?? 'N/A'} {patient.iopOS && patient.iopOS > 21 && '⚠️'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded px-2.5 py-2">
                    <p className="text-[10px] text-gray-500 font-semibold uppercase mb-0.5">Refraction</p>
                    <p className="text-xs text-gray-800">
                      {patient.refractionCompleted ? '✅ Completed' : '⏳ Pending'}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                {patient.status === 'Waiting' && (
                  <>
                    <button
                      onClick={() => handleStartExam(patient)}
                      disabled={startingVisitId === (patient.visitId ?? patient.id)}
                      className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-wait"
                    >
                      <PlayCircle className="w-3.5 h-3.5 mr-1" />
                      {startingVisitId === (patient.visitId ?? patient.id) ? 'Opening…' : 'Start Examination'}
                    </button>
                    <button
                      onClick={() => handleSkip(patient)}
                      className="flex items-center px-2.5 py-1.5 text-gray-500 text-xs rounded hover:bg-gray-100 transition-colors"
                    >
                      <SkipForward className="w-3.5 h-3.5 mr-1" />
                      Skip
                    </button>
                  </>
                )}
                {patient.status === 'In Progress' && (
                  <>
                    <button
                      onClick={() => handleStartExam(patient)}
                      disabled={startingVisitId === (patient.visitId ?? patient.id)}
                      className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-wait"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      {startingVisitId === (patient.visitId ?? patient.id) ? 'Opening…' : 'Continue Exam'}
                    </button>
                    <button
                      onClick={() => handleViewEducation(patient)}
                      className="flex items-center px-2.5 py-1.5 bg-teal-50 text-teal-700 text-xs rounded hover:bg-teal-100 transition-colors border border-teal-200"
                    >
                      <UserCheck className="w-3.5 h-3.5 mr-1" />
                      Educate
                    </button>
                    <button
                      onClick={() => handleReferToDoctor(patient)}
                      className="flex items-center px-2.5 py-1.5 bg-violet-50 text-violet-700 text-xs rounded hover:bg-violet-100 transition-colors border border-violet-200"
                    >
                      <Send className="w-3.5 h-3.5 mr-1" />
                      Refer to Doctor
                    </button>
                  </>
                )}
                {patient.status === 'Completed' && (
                  <div className="flex items-center text-emerald-600 text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Complete
                    <button
                      onClick={() => handleReferToDoctor(patient)}
                      className="ml-2 flex items-center px-2.5 py-1.5 bg-violet-50 text-violet-700 text-xs rounded hover:bg-violet-100 transition-colors border border-violet-200"
                    >
                      <Send className="w-3.5 h-3.5 mr-1" />
                      Refer
                    </button>
                  </div>
                )}
                {patient.status === 'Referred' && (
                  <div className="flex items-center text-violet-600 text-xs font-medium">
                    <Send className="w-3.5 h-3.5 mr-1" />
                    Referred to Doctor
                  </div>
                )}
              </div>
            </div>
          ))}

        {isSearchActive && directoryOnlyPatients.length > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 pt-4">
              Other patients ({directoryOnlyPatients.length})
            </p>
            {directoryOnlyPatients.map((patient) => (
              <div
                key={patient.id}
                className="bg-white border border-violet-200 rounded-lg p-4 hover:border-violet-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-violet-50 border border-violet-200 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-violet-700 font-semibold text-sm">
                        {patient.patientName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{patient.patientName}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{patient.mrn || '—'}</span>
                        {patient.gender && <span>{patient.gender}</span>}
                        {patient.phone && <span>{patient.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-semibold border bg-slate-50 text-slate-600 border-slate-200">
                    Not in queue
                  </span>
                </div>
                <div className="flex items-center justify-end pt-3 mt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => handleOpenDirectoryExamClick(patient)}
                    disabled={openingPatientId === patient.id}
                    className="flex items-center px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded hover:bg-violet-700 transition-colors disabled:opacity-60 disabled:cursor-wait"
                  >
                    <PlayCircle className="w-3.5 h-3.5 mr-1" />
                    {openingPatientId === patient.id ? 'Opening…' : 'Open Examination'}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <Dialog open={complaintDialogOpen} onOpenChange={setComplaintDialogOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Open examination</DialogTitle>
            <DialogDescription>
              {pendingDirectoryPatient
                ? `Start optometry examination for ${pendingDirectoryPatient.patientName}. A visit will be created if needed.`
                : 'Enter the chief complaint for this examination.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label htmlFor="optometry-chief-complaint" className="block text-sm font-medium text-gray-700 mb-1.5">
              Chief complaint
            </label>
            <textarea
              id="optometry-chief-complaint"
              value={complaintDraft}
              onChange={(e) => setComplaintDraft(e.target.value)}
              placeholder="e.g. Blurred vision, routine eye check-up"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setComplaintDialogOpen(false);
                setPendingDirectoryPatient(null);
                setComplaintDraft('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmOpenDirectoryExam()}
              disabled={!!openingPatientId}
            >
              {openingPatientId ? 'Opening…' : 'Open Examination'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function OptometristDashboardPage() {
  return (
    <ProtectedRoute requiredPermission="CLINICAL:EXAMINATION:VIEW">
      <OptometristDashboardContent />
    </ProtectedRoute>
  );
}
