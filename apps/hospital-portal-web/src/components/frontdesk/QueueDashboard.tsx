'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
import { Phone, Clock, UserX, ArrowRight, Users, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/lib/auth-store';
import { useQueueConnection } from '@/hooks/useQueueConnection';
import { useConfirmation } from '@/components/common/ConfirmationDialog';
import { visitsApi } from '@/lib/api/visits.api';
import { optometryQueueApi } from '@/lib/api/optometry.api';
import { queueTypeToStation } from '@/lib/frontdesk/station-ids';
import {
  loadStationQueues,
  emptyStationQueues,
  type StationQueueItem,
  type StationQueueStats,
  type StationQueueType,
  type StationQueuesState,
  type StationStatsState,
} from '@/lib/frontdesk/load-station-queues';

interface QueueSectionProps {
  title: string;
  queueType: StationQueueType;
  icon: React.ReactNode;
  color: string;
}

export default function QueueDashboard() {
  const { user } = useAuthStore();
  const branchId = user?.branchId;

  const empty = emptyStationQueues();
  const [queues, setQueues] = useState<StationQueuesState>(empty.queues);
  const [stats, setStats] = useState<StationStatsState>(empty.stats);
  const [selectedQueue, setSelectedQueue] = useState<StationQueueItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferToQueue, setTransferToQueue] = useState<StationQueueType>('Doctor');

  const { showConfirmation, ConfirmationComponent } = useConfirmation();

  const fetchQueueData = useCallback(async () => {
    if (!branchId) {
      const e = emptyStationQueues();
      setQueues(e.queues);
      setStats(e.stats);
      setLoading(false);
      return;
    }

    try {
      const { queues: nextQueues, stats: nextStats } = await loadStationQueues(branchId);
      setQueues(nextQueues);
      setStats(nextStats);
    } catch (error) {
      console.error('Failed to fetch queue data:', error);
      toast.error('Failed to load queue data');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  const { isConnected } = useQueueConnection({
    branchId,
    autoConnect: !!branchId,
    onQueueUpdate: () => {
      void fetchQueueData();
    },
  });

  useEffect(() => {
    void fetchQueueData();
    if (!branchId) return undefined;
    const interval = setInterval(() => {
      void fetchQueueData();
    }, isConnected ? 120_000 : 30_000);
    return () => clearInterval(interval);
  }, [branchId, fetchQueueData, isConnected]);

  const handleCallPatient = async (item: StationQueueItem) => {
    try {
      if (item.queueType === 'Optometry') {
        await optometryQueueApi.startExam(item.visitId, item.roomNumber ?? 'OPT-1');
        toast.success(`Started exam for ${item.patientName}`);
      } else {
        await visitsApi.sendTo({
          visitId: item.visitId,
          station: queueTypeToStation(item.queueType),
        });
        toast.success(`Called ${item.patientName}`);
      }
      await fetchQueueData();
    } catch (error) {
      console.error('Failed to call patient:', error);
      toast.error('Failed to call patient');
    }
  };

  const handleMarkAbsent = async (item: StationQueueItem) => {
    showConfirmation({
      title: 'Mark Absent',
      message: `Mark ${item.patientName} (${item.tokenNumber}) as absent?`,
      variant: 'warning',
      confirmText: 'Mark Absent',
      onConfirm: async () => {
        try {
          if (item.queueType === 'Optometry') {
            await optometryQueueApi.skipPatient(item.visitId, 'Marked absent from queue management');
          } else {
            await visitsApi.markNoShow(item.visitId);
          }
          toast.success('Patient marked absent');
          await fetchQueueData();
        } catch {
          toast.error('Failed to mark absent');
        }
      },
    });
  };

  const handleTransferQueue = async () => {
    if (!selectedQueue) return;

    try {
      await visitsApi.sendTo({
        visitId: selectedQueue.visitId,
        station: queueTypeToStation(transferToQueue),
        reasonCode:
          transferToQueue === 'Optometry' ? 'INITIAL_REFRACTION' : undefined,
      });
      toast.success(`Transferred to ${transferToQueue}`);
      setTransferDialogOpen(false);
      setSelectedQueue(null);
      await fetchQueueData();
    } catch (error) {
      console.error('Failed to transfer queue:', error);
      toast.error('Failed to transfer patient');
    }
  };

  const calculateWaitTime = (checkedInAt: string): number => {
    const checkedIn = new Date(checkedInAt);
    const now = new Date();
    return Math.floor((now.getTime() - checkedIn.getTime()) / (1000 * 60));
  };

  // Queue section component
  const QueueSection = ({ title, queueType, icon, color }: QueueSectionProps) => {
    const queueItems = queues[queueType] || [];
    const queueStats = stats[queueType];
    const waitingItems = queueItems.filter((item) => item.status === 'waiting');

    return (
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className={`${color} text-white px-4 py-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <h2 className="text-base font-semibold">{title}</h2>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="bg-white/20 px-2 py-1 rounded">
                {queueStats?.totalWaiting || 0} waiting
              </span>
              <span className="bg-white/20 px-2 py-1 rounded">
                {queueStats?.averageWaitTime || 0} min
              </span>
            </div>
          </div>
        </div>

        {/* Queue Items */}
        <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
          {waitingItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No patients waiting</p>
            </div>
          ) : (
            waitingItems.map((item) => (
              <div
                key={item.id}
                className={`p-3 hover:bg-slate-50 transition-colors ${
                  item.priority === 'emergency' ? 'bg-red-50 border-l-4 border-red-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xl font-bold text-emerald-600">{item.tokenNumber}</span>
                      {item.priority === 'emergency' && (
                        <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-medium">
                          EMERGENCY
                        </span>
                      )}
                      {item.priority === 'follow-up' && (
                        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded font-medium">
                          FOLLOW-UP
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-slate-900 text-sm mb-1">{item.patientName}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" />
                        {item.mobileNumber}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {calculateWaitTime(item.checkedInAt)} min
                      </span>
                    </div>
                    {item.doctorName && (
                      <p className="text-xs text-slate-600 mt-1">
                        {item.doctorName} • Room {item.roomNumber}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => handleCallPatient(item)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      Call Patient
                    </button>
                    <button
                      onClick={() => handleMarkAbsent(item)}
                      className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1 justify-center"
                    >
                      <UserX className="w-3 h-3" />
                      Absent
                    </button>
                    <button
                      onClick={() => {
                        setSelectedQueue(item);
                        setTransferDialogOpen(true);
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1 justify-center"
                    >
                      <ArrowRight className="w-3 h-3" />
                      Transfer
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-600">Loading queue data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <ConfirmationComponent />
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">Queue Management</h1>
          <p className="text-sm text-slate-600">
            Live visit queues by station (optometry, doctor, billing, pharmacy)
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span
            className={`inline-block h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}
          />
          {isConnected ? 'Live' : 'Polling'}
          {!branchId && <span className="text-amber-600 ml-2">Branch not set on profile</span>}
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600">Total Waiting</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">
                  {Object.values(stats).reduce((sum, s) => sum + s.totalWaiting, 0)}
                </p>
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-slate-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600">Avg Wait Time</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">
                  {Math.round(
                    Object.values(stats).reduce((sum, s) => sum + s.averageWaitTime, 0) /
                      Object.values(stats).length
                  )}{' '}
                  <span className="text-sm text-slate-600">min</span>
                </p>
              </div>
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600">Completed Today</p>
                <p className="text-2xl font-semibold text-emerald-600 mt-1">
                  {Object.values(stats).reduce((sum, s) => sum + s.totalCompleted, 0)}
                </p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600">Absent</p>
                <p className="text-2xl font-semibold text-red-600 mt-1">
                  {Object.values(stats).reduce((sum, s) => sum + s.totalAbsent, 0)}
                </p>
              </div>
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <UserX className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Queue Sections */}
        <div className="grid grid-cols-2 gap-4">
          <QueueSection
            title="Optometry Queue"
            queueType="Optometry"
            icon={<Activity className="w-5 h-5" />}
            color="bg-purple-600"
          />
          <QueueSection
            title="Doctor Queue"
            queueType="Doctor"
            icon={<Users className="w-5 h-5" />}
            color="bg-emerald-600"
          />
          <QueueSection
            title="Billing Queue"
            queueType="Billing"
            icon={<Activity className="w-5 h-5" />}
            color="bg-slate-600"
          />
          <QueueSection
            title="Pharmacy Queue"
            queueType="Pharmacy"
            icon={<Activity className="w-5 h-5" />}
            color="bg-amber-600"
          />
        </div>

      {/* Transfer Dialog */}
      {transferDialogOpen && selectedQueue && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">Transfer Patient to Another Queue</h3>
            <p className="text-sm text-slate-600 mb-4">
              Transfer <span className="font-medium text-slate-900">{selectedQueue.patientName}</span> (
              {selectedQueue.tokenNumber}) from <span className="font-medium text-slate-900">{selectedQueue.queueType}</span> to:
            </p>
            <select
              value={transferToQueue}
              onChange={(e) => setTransferToQueue(e.target.value as any)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="Optometry">Optometry</option>
              <option value="Doctor">Doctor</option>
              <option value="Billing">Billing</option>
              <option value="Pharmacy">Pharmacy</option>
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setTransferDialogOpen(false);
                  setSelectedQueue(null);
                }}
                className="flex-1 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferQueue}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
