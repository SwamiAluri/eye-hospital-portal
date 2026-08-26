'use client';

import React, { useEffect, useState, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuthStore } from '@/lib/auth-store';
import { getApi } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Branch capacity summary DTO matching backend
interface BranchCapacitySummaryDto {
  branchId: string;
  branchName: string;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  occupancyPercentage: number;
  capacityAlertLevel: string;
  generalBeds: BedTypeCapacity;
  icuBeds: BedTypeCapacity;
  emergencyBeds: BedTypeCapacity;
  reclinerBeds?: BedTypeCapacity;
  dayCareChairBeds?: BedTypeCapacity;
  lastUpdated: string;
}

interface BedTypeCapacity {
  total: number;
  available: number;
  occupied: number;
  underMaintenance: number;
  reserved: number;
}

interface BranchCapacityHistoryDto {
  snapshotId: string;
  branchId: string;
  snapshotDateTime: string;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  occupancyPercentage: number;
  generalBedsOccupied: number;
  icuBedsOccupied: number;
  emergencyBedsOccupied: number;
}

interface Branch {
  id: string;
  branchName: string;
}

export default function CapacityDashboard() {
  const { tenantId, token } = useAuthStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [capacitySummary, setCapacitySummary] = useState<BranchCapacitySummaryDto | null>(null);
  const [historyData, setHistoryData] = useState<BranchCapacityHistoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch branches on mount
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const api = getApi();
        const response = await api.get('/Branches');
        console.log('✅ Branches fetched:', response.data.length);
        setBranches(response.data);
        
        if (response.data.length > 0) {
          setSelectedBranchId(response.data[0].id);
        }
        setLoading(false);
      } catch (err: any) {
        console.error('❌ Error fetching branches:', err);
        setError('Failed to load branches');
        setLoading(false);
      }
    };

    if (tenantId && token) {
      fetchBranches();
    }
  }, [tenantId, token]);

  // Fetch capacity summary and history when branch selected
  useEffect(() => {
    if (!selectedBranchId || !tenantId || !token) return;

    const fetchCapacityData = async () => {
      try {
        const api = getApi();
        
        // Fetch current summary
        const summaryResponse = await api.get(`/BranchCapacity/branch/${selectedBranchId}/summary`);
        console.log('✅ Capacity summary fetched:', summaryResponse.data);
        setCapacitySummary(summaryResponse.data);

        // Fetch history (last 24 hours)
        const historyResponse = await api.get(`/BranchCapacity/branch/${selectedBranchId}/history`, {
          params: {
            hoursBack: 24
          }
        });
        console.log('✅ Capacity history fetched:', historyResponse.data.length, 'records');
        setHistoryData(historyResponse.data);
      } catch (err: any) {
        console.error('❌ Error fetching capacity data:', err);
        setError('Failed to load capacity data');
      }
    };

    fetchCapacityData();
  }, [selectedBranchId, tenantId, token]);

  // Setup SignalR connection
  useEffect(() => {
    if (!token || !tenantId || !selectedBranchId) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5073/capacityHub', {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    connection.on('BedStatusChanged', (data: any) => {
      console.log('🛏️ BedStatusChanged event:', data);
      if (data.branchId === selectedBranchId) {
        // Refresh capacity summary
        refreshCapacitySummary();
      }
    });

    connection.on('CapacityUpdated', (data: { branchId: string, summary: BranchCapacitySummaryDto, timestamp: string }) => {
      console.log('📡 CapacityUpdated event:', data);
      if (data.branchId === selectedBranchId) {
        setCapacitySummary(data.summary);
      }
    });

    connection.on('CapacityAlert', (data: any) => {
      console.log('⚠️ CapacityAlert event:', data);
      if (data.branchId === selectedBranchId) {
        // Show browser notification
        if (Notification.permission === 'granted') {
          new Notification(`Capacity Alert: ${data.alertLevel}`, {
            body: `Occupancy: ${data.occupancyPercentage}%, Available: ${data.availableBeds}/${data.totalBeds} beds`,
            icon: '/hospital-icon.png'
          });
        }
      }
    });

    connection.on('TransferUpdated', (data: any) => {
      console.log('🚑 TransferUpdated event:', data);
      if (data.fromBranchId === selectedBranchId || data.toBranchId === selectedBranchId) {
        refreshCapacitySummary();
      }
    });

    connection.onreconnecting(() => {
      console.log('🔄 SignalR reconnecting...');
      setIsConnected(false);
    });

    connection.onreconnected(() => {
      console.log('✅ SignalR reconnected!');
      setIsConnected(true);
      // Rejoin branch group
      connection.invoke('JoinBranchGroup', selectedBranchId).catch(err => 
        console.error('❌ Failed to rejoin branch group:', err)
      );
    });

    connection.onclose(() => {
      console.log('❌ SignalR connection closed');
      setIsConnected(false);
    });

    const startConnection = async () => {
      try {
        await connection.start();
        console.log('✅ SignalR connected to CapacityHub');
        setIsConnected(true);
        
        // Join branch group
        await connection.invoke('JoinBranchGroup', selectedBranchId);
        console.log(`✅ Joined branch group: ${selectedBranchId}`);
        
        connectionRef.current = connection;
      } catch (err) {
        console.error('❌ SignalR connection failed:', err);
        setIsConnected(false);
      }
    };

    startConnection();

    // Cleanup on unmount or branch change
    return () => {
      if (connectionRef.current) {
        connectionRef.current.invoke('LeaveBranchGroup', selectedBranchId).then(() => {
          console.log(`🔌 Left branch group: ${selectedBranchId}`);
          connectionRef.current?.stop();
        });
      }
    };
  }, [token, tenantId, selectedBranchId]);

  const refreshCapacitySummary = async () => {
    try {
      const api = getApi();
      const response = await api.get(`/BranchCapacity/branch/${selectedBranchId}/summary`);
      setCapacitySummary(response.data);
    } catch (err) {
      console.error('❌ Failed to refresh capacity summary:', err);
    }
  };

  // Format history data for chart
  const chartData = historyData.map(item => ({
    time: new Date(item.snapshotDateTime).toLocaleTimeString(),
    occupancyPercentage: Number(item.occupancyPercentage.toFixed(1)),
    availableBeds: item.availableBeds,
    occupiedBeds: item.occupiedBeds
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-red-50 rounded-lg">
        <div className="text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-red-600 font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  const alertLevelColor = capacitySummary?.capacityAlertLevel === 'critical' ? 'red' :
                         capacitySummary?.capacityAlertLevel === 'warning' ? 'yellow' : 'green';

  return (
    <div className="space-y-6">
      {/* Header with Branch Selector */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Branch Capacity Dashboard</h2>
          <p className="text-gray-600">Real-time bed capacity monitoring</p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Live Status Indicator */}
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
          
          {/* Branch Selector */}
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>
                {branch.branchName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Capacity Metrics Cards */}
      {capacitySummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Available Beds */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Available Beds</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{capacitySummary.availableBeds}</p>
                <p className="text-sm text-gray-500 mt-1">of {capacitySummary.totalBeds} total</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* ICU Capacity */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">ICU Beds Available</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{capacitySummary.icuBeds.available}</p>
                <p className="text-sm text-gray-500 mt-1">of {capacitySummary.icuBeds.total} total</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
          </div>

          {/* Emergency Capacity */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Emergency Beds Available</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">{capacitySummary.emergencyBeds.available}</p>
                <p className="text-sm text-gray-500 mt-1">of {capacitySummary.emergencyBeds.total} total</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Occupancy Percentage */}
          <div className={`bg-white p-6 rounded-lg border-2 shadow-sm ${
            alertLevelColor === 'red' ? 'border-red-500' :
            alertLevelColor === 'yellow' ? 'border-yellow-500' : 'border-green-500'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Occupancy Rate</p>
                <p className={`text-3xl font-bold mt-2 ${
                  alertLevelColor === 'red' ? 'text-red-600' :
                  alertLevelColor === 'yellow' ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {capacitySummary.occupancyPercentage.toFixed(1)}%
                </p>
                <p className="text-sm text-gray-500 mt-1 capitalize">
                  {capacitySummary.capacityAlertLevel} level
                </p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                alertLevelColor === 'red' ? 'bg-red-100' :
                alertLevelColor === 'yellow' ? 'bg-yellow-100' : 'bg-green-100'
              }`}>
                {alertLevelColor === 'red' ? (
                  <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ) : alertLevelColor === 'yellow' ? (
                  <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Occupancy Trend Chart */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Occupancy Trend (Last 24 Hours)</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="occupancyPercentage" 
                stroke="#3B82F6" 
                strokeWidth={2}
                name="Occupancy %"
              />
              <Line 
                type="monotone" 
                dataKey="availableBeds" 
                stroke="#10B981" 
                strokeWidth={2}
                name="Available Beds"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-gray-500">
            <p>No historical data available</p>
          </div>
        )}
      </div>

      {/* Bed Type Breakdown */}
      {capacitySummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* General Beds */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">General Beds</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total:</span>
                <span className="font-semibold">{capacitySummary.generalBeds.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Available:</span>
                <span className="font-semibold text-green-600">{capacitySummary.generalBeds.available}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Occupied:</span>
                <span className="font-semibold text-red-600">{capacitySummary.generalBeds.occupied}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Maintenance:</span>
                <span className="font-semibold text-gray-500">{capacitySummary.generalBeds.underMaintenance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Reserved:</span>
                <span className="font-semibold text-blue-600">{capacitySummary.generalBeds.reserved}</span>
              </div>
            </div>
          </div>

          {/* ICU Beds */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">ICU Beds</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total:</span>
                <span className="font-semibold">{capacitySummary.icuBeds.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Available:</span>
                <span className="font-semibold text-green-600">{capacitySummary.icuBeds.available}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Occupied:</span>
                <span className="font-semibold text-red-600">{capacitySummary.icuBeds.occupied}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Maintenance:</span>
                <span className="font-semibold text-gray-500">{capacitySummary.icuBeds.underMaintenance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Reserved:</span>
                <span className="font-semibold text-blue-600">{capacitySummary.icuBeds.reserved}</span>
              </div>
            </div>
          </div>

          {/* Emergency Beds */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">Emergency Beds</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total:</span>
                <span className="font-semibold">{capacitySummary.emergencyBeds.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Available:</span>
                <span className="font-semibold text-green-600">{capacitySummary.emergencyBeds.available}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Occupied:</span>
                <span className="font-semibold text-red-600">{capacitySummary.emergencyBeds.occupied}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Maintenance:</span>
                <span className="font-semibold text-gray-500">{capacitySummary.emergencyBeds.underMaintenance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Reserved:</span>
                <span className="font-semibold text-blue-600">{capacitySummary.emergencyBeds.reserved}</span>
              </div>
            </div>
          </div>

          {/* Recliners */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">Recliners</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total:</span>
                <span className="font-semibold">{capacitySummary.reclinerBeds?.total ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Available:</span>
                <span className="font-semibold text-green-600">{capacitySummary.reclinerBeds?.available ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Occupied:</span>
                <span className="font-semibold text-red-600">{capacitySummary.reclinerBeds?.occupied ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Maintenance:</span>
                <span className="font-semibold text-gray-500">{capacitySummary.reclinerBeds?.underMaintenance ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Reserved:</span>
                <span className="font-semibold text-blue-600">{capacitySummary.reclinerBeds?.reserved ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Day-care chairs */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">Day-care chairs</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total:</span>
                <span className="font-semibold">{capacitySummary.dayCareChairBeds?.total ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Available:</span>
                <span className="font-semibold text-green-600">{capacitySummary.dayCareChairBeds?.available ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Occupied:</span>
                <span className="font-semibold text-red-600">{capacitySummary.dayCareChairBeds?.occupied ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Maintenance:</span>
                <span className="font-semibold text-gray-500">{capacitySummary.dayCareChairBeds?.underMaintenance ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Reserved:</span>
                <span className="font-semibold text-blue-600">{capacitySummary.dayCareChairBeds?.reserved ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
