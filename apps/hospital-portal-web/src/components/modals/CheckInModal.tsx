'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Search, UserCheck, Calendar, Clock } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/lib/auth-store';
import { frontdeskApi, FrontdeskBoardRow, FrontdeskPatientSearchRow } from '@/lib/api/frontdesk.api';
import { frontdeskRoutingApi } from '@/lib/api/frontdesk-routing.api';
import { visitsApi } from '@/lib/api/visits.api';
import { useFrontdeskRoutingStations } from '@/hooks/use-operations-master';
import { normalizeStationId } from '@/lib/frontdesk/station-ids';

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWalkIn?: (patient: FrontdeskPatientSearchRow) => void;
  onBoardChanged?: () => void;
}

export default function CheckInModal({ isOpen, onClose, onOpenWalkIn, onBoardChanged }: CheckInModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FrontdeskBoardRow[]>([]);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientResults, setPatientResults] = useState<FrontdeskPatientSearchRow[]>([]);
  const { stations: routingStations, loading: stationsLoading } = useFrontdeskRoutingStations();
  const [station, setStation] = useState('');
  const [actingOnId, setActingOnId] = useState<string | null>(null);

  const { user } = useAuthStore();

  useEffect(() => {
    if (!station && routingStations.length > 0) {
      setStation(routingStations[0].value);
    }
  }, [routingStations, station]);

  const today = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  useEffect(() => {
    const branchId = user?.branchId;
    if (!isOpen) return;
    if (!branchId) {
      toast.error('No branch selected for your user profile');
      return;
    }

    let cancelled = false;
    setLoading(true);
    frontdeskApi
      .getBoard(branchId, today)
      .then((payload) => {
        if (cancelled) return;
        setRows(payload.rows ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error('Failed to load today’s appointments');
        setRows([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, today, user?.branchId]);

  useEffect(() => {
    const branchId = user?.branchId;
    if (!isOpen) return;
    if (!branchId) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setPatientResults([]);
      setPatientLoading(false);
      return;
    }

    let cancelled = false;
    setPatientLoading(true);
    const t = setTimeout(() => {
      frontdeskApi
        .searchPatientsWithFallback(branchId, q, 20)
        .then((res) => {
          if (cancelled) return;
          setPatientResults(Array.isArray(res) ? res : []);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setPatientResults([]);
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 403) {
            toast.error('You do not have permission to search patients');
          } else {
            toast.error('Failed to search patients');
          }
        })
        .finally(() => {
          if (cancelled) return;
          setPatientLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isOpen, searchQuery, user?.branchId]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = (r.appointment?.patientName ?? r.visit?.patientName ?? '').toLowerCase();
      const token = (r.visit?.tokenNumber ?? '').toLowerCase();
      const mrn = (r.visit?.patientMrn ?? '').toLowerCase();
      const doctor = (r.appointment?.doctorName ?? '').toLowerCase();
      return name.includes(q) || token.includes(q) || mrn.includes(q) || doctor.includes(q);
    });
  }, [rows, searchQuery]);

  const handleOpenWalkIn = (p: FrontdeskPatientSearchRow) => {
    if (onOpenWalkIn) {
      onOpenWalkIn(p);
      onClose();
      return;
    }
    toast.info('Walk-in is not configured on this page');
  };

  const handleCheckIn = async (appointmentId: string) => {
    try {
      setActingOnId(appointmentId);
      const res = await visitsApi.checkIn({ appointmentId });
      if (res.success) {
        toast.success(res.tokenNumber ? `Checked in — Token ${res.tokenNumber}` : 'Checked in');
        onBoardChanged?.();
        if (user?.branchId) {
          const payload = await frontdeskApi.getBoard(user.branchId, today);
          setRows(payload.rows ?? []);
        }
      } else {
        toast.error(res.message ?? 'Failed to check in');
      }
    } catch {
      toast.error('Failed to check in');
    } finally {
      setActingOnId(null);
    }
  };

  const handleSendTo = async (row: FrontdeskBoardRow) => {
    try {
      setActingOnId(row.appointment.id);
      const target = normalizeStationId(station);
      if (row.visit?.id) {
        await frontdeskRoutingApi.sendToVisit({ visitId: row.visit.id, station: target });
      } else {
        await frontdeskRoutingApi.sendToAppointment(row.appointment.id, { station: target });
      }
      const label = routingStations.find((s) => s.value === station)?.label ?? station;
      toast.success(`Sent to ${label}`);
      onBoardChanged?.();
      if (user?.branchId) {
        const payload = await frontdeskApi.getBoard(user.branchId, today);
        setRows(payload.rows ?? []);
      }
    } catch {
      toast.error('Failed to route to station');
    } finally {
      setActingOnId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-emerald-50">
          <div className="flex items-center gap-3">
            <UserCheck className="h-6 w-6 text-emerald-600" />
            <h2 className="text-xl font-semibold text-slate-900">Patient Check-In</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-emerald-100 rounded-lg transition"
          >
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Search */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Search Patient
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, token, MRN, or doctor…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              {loading ? 'Loading…' : `${filteredRows.length} appointment(s)`}{patientLoading ? ' • Searching patients…' : ''}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Route to</span>
              <select
                value={station}
                onChange={(e) => setStation(e.target.value)}
                disabled={stationsLoading || routingStations.length === 0}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-50"
              >
                {routingStations.length === 0 ? (
                  <option value="">{stationsLoading ? 'Loading stations…' : 'No stations configured'}</option>
                ) : (
                  routingStations.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Patient Results (global) */}
          {searchQuery.trim().length >= 2 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Patients</h3>
              {patientResults.length === 0 ? (
                <div className="text-sm text-slate-600">No patients found.</div>
              ) : (
                <div className="space-y-3">
                  {patientResults.slice(0, 10).map((p) => (
                    <div
                      key={p.id}
                      className="border border-slate-200 rounded-lg p-4 hover:border-blue-500 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-semibold text-slate-900">{p.patientName}</h4>
                            {p.mrn ? (
                              <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                                MRN {p.mrn}
                              </span>
                            ) : null}
                            {p.phone ? (
                              <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                                {p.phone}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-sm text-slate-600">
                            {p.gender ?? '—'}{p.dateOfBirth ? ` • DOB ${new Date(p.dateOfBirth).toLocaleDateString()}` : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenWalkIn(p)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                        >
                          Walk-in
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Today's Appointments */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Today's Appointments</h3>
            <div className="space-y-3">
              {filteredRows.map((row) => (
                <div
                  key={row.appointment.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-emerald-500 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <h4 className="text-lg font-semibold text-slate-900">
                          {row.appointment.patientName ?? row.visit?.patientName ?? '—'}
                        </h4>
                        {row.visit?.tokenNumber ? (
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                            Token {row.visit.tokenNumber}
                          </span>
                        ) : null}
                        {row.visit?.patientMrn ? (
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                            MRN {row.visit.patientMrn}
                          </span>
                        ) : null}
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-800 text-xs font-medium rounded">
                          {row.state}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>{row.appointment.startTime ?? '—'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          <span>{row.appointment.doctorName ?? '—'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{row.appointment.appointmentType ?? '—'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSendTo(row)}
                        disabled={actingOnId === row.appointment.id}
                        className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium text-sm disabled:opacity-60"
                      >
                        Send
                      </button>
                      <button
                        onClick={() => handleCheckIn(row.appointment.id)}
                        disabled={actingOnId === row.appointment.id}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-60"
                      >
                        Check-In
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
