'use client';

import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import * as signalR from '@microsoft/signalr';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuthStore } from '@/lib/auth-store';
import { getApi } from '@/lib/api';

// Branch capacity summary DTO matching backend
interface BranchCapacitySummaryDto {
  branchId: string;
  branchName: string;
  totalBeds: number;
  availableBeds: number;
  occupiedBeds: number;
  occupancyPercentage: number;
  capacityAlertLevel: string; // "normal", "warning", "critical"
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

interface BranchLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

// Create custom marker icons
const createMarkerIcon = (alertLevel: string) => {
  const color = alertLevel === 'critical' ? '#EF4444' : 
                alertLevel === 'warning' ? '#F59E0B' : '#10B981';
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: white;
        font-size: 12px;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 18px; height: 18px;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
};

// Recenter map when branches load
function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 7);
  }, [center, map]);
  return null;
}

export default function BranchMapView() {
  const { tenantId, token } = useAuthStore();
  const [branches, setBranches] = useState<BranchCapacitySummaryDto[]>([]);
  const [branchLocations, setBranchLocations] = useState<BranchLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch branch locations and capacity data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const api = getApi();
        
        // Fetch all branches to get locations
        const branchesResponse = await api.get('/Branches');
        console.log('✅ Branches fetched:', branchesResponse.data.length);
        
        // Convert to BranchLocation array
        const locations: BranchLocation[] = branchesResponse.data.map((branch: any) => ({
          id: branch.id,
          name: branch.branchName,
          latitude: branch.latitude || 0,
          longitude: branch.longitude || 0
        }));
        setBranchLocations(locations);

        // Fetch capacity summaries for all branches
        const capacityResponse = await api.get('/BranchCapacity/summary/all');
        console.log('✅ Capacity summaries fetched:', capacityResponse.data.length);
        setBranches(capacityResponse.data);
        
        setLoading(false);
      } catch (err: any) {
        console.error('❌ Error fetching branch data:', err);
        setError(err.response?.data?.message || 'Failed to load branch data');
        setLoading(false);
      }
    };

    if (tenantId && token) {
      fetchData();
    }
  }, [tenantId, token]);

  // Setup SignalR connection
  useEffect(() => {
    if (!token || !tenantId) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5073/capacityHub', {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    connection.on('CapacityUpdated', (data: { branchId: string, summary: BranchCapacitySummaryDto, timestamp: string }) => {
      console.log('📡 CapacityUpdated event received:', data);
      
      // Update branches array with new summary
      setBranches(prev => {
        const updated = [...prev];
        const index = updated.findIndex(b => b.branchId === data.branchId);
        if (index !== -1) {
          updated[index] = data.summary;
        } else {
          updated.push(data.summary);
        }
        return updated;
      });
    });

    connection.on('BedStatusChanged', (data: any) => {
      console.log('🛏️ BedStatusChanged event:', data);
      // Trigger refresh of capacity summary for this branch
      refreshBranchCapacity(data.branchId);
    });

    connection.on('CapacityAlert', (data: any) => {
      console.log('⚠️ CapacityAlert event:', data);
      // Show browser notification if available
      if (Notification.permission === 'granted') {
        new Notification(`Branch Capacity Alert: ${data.alertLevel}`, {
          body: `Occupancy: ${data.occupancyPercentage}%, Available Beds: ${data.availableBeds}/${data.totalBeds}`,
          icon: '/hospital-icon.png'
        });
      }
    });

    connection.onreconnecting(() => {
      console.log('🔄 SignalR reconnecting...');
      setIsConnected(false);
    });

    connection.onreconnected(() => {
      console.log('✅ SignalR reconnected!');
      setIsConnected(true);
      // Rejoin all branch groups
      branchLocations.forEach(branch => {
        connection.invoke('JoinBranchGroup', branch.id).catch(err => 
          console.error('❌ Failed to rejoin branch group:', err)
        );
      });
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
        
        // Join tenant group (automatic on server)
        await connection.invoke('JoinTenantGroup');
        console.log('✅ Joined tenant group');
        
        connectionRef.current = connection;
      } catch (err) {
        console.error('❌ SignalR connection failed:', err);
        setIsConnected(false);
      }
    };

    startConnection();

    // Cleanup on unmount
    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop().then(() => {
          console.log('🔌 SignalR disconnected');
        });
      }
    };
  }, [token, tenantId, branchLocations]);

  // Request browser notifications permission
  useEffect(() => {
    if (typeof window !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('🔔 Notification permission:', permission);
      });
    }
  }, []);

  const refreshBranchCapacity = async (branchId: string) => {
    try {
      const api = getApi();
      const response = await api.get(`/BranchCapacity/branch/${branchId}/summary`);
      
      setBranches(prev => {
        const updated = [...prev];
        const index = updated.findIndex(b => b.branchId === branchId);
        if (index !== -1) {
          updated[index] = response.data;
        }
        return updated;
      });
    } catch (err) {
      console.error('❌ Failed to refresh branch capacity:', err);
    }
  };

  // Calculate center point (average of all branch coordinates)
  const mapCenter: [number, number] = branchLocations.length > 0
    ? [
        branchLocations.reduce((sum, b) => sum + b.latitude, 0) / branchLocations.length,
        branchLocations.reduce((sum, b) => sum + b.longitude, 0) / branchLocations.length
      ]
    : [20.5937, 78.9629]; // India center as fallback

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading branch map...</p>
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
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Branch Capacity Map</h2>
          <p className="text-gray-600">Real-time bed availability across {branchLocations.length} branches</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">
            {isConnected ? 'Live Updates Active' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex space-x-6 bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-full bg-green-500"></div>
          <span className="text-sm text-gray-700">Normal (&lt;75%)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
          <span className="text-sm text-gray-700">Warning (75-89%)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-full bg-red-500"></div>
          <span className="text-sm text-gray-700">Critical (≥90%)</span>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" style={{ height: '600px' }}>
        <MapContainer
          center={mapCenter}
          zoom={7}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecenterMap center={mapCenter} />
          
          {branchLocations.map(location => {
            const capacity = branches.find(b => b.branchId === location.id);
            const alertLevel = capacity?.capacityAlertLevel || 'normal';
            
            return (
              <Marker
                key={location.id}
                position={[location.latitude, location.longitude]}
                icon={createMarkerIcon(alertLevel)}
              >
                <Popup className="custom-popup">
                  <div className="p-2 min-w-[250px]">
                    <h3 className="font-bold text-lg text-gray-900 mb-2">{location.name}</h3>
                    
                    {capacity ? (
                      <>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="bg-gray-50 p-2 rounded">
                            <p className="text-xs text-gray-600">Total Beds</p>
                            <p className="text-lg font-bold text-gray-900">{capacity.totalBeds}</p>
                          </div>
                          <div className="bg-green-50 p-2 rounded">
                            <p className="text-xs text-gray-600">Available</p>
                            <p className="text-lg font-bold text-green-600">{capacity.availableBeds}</p>
                          </div>
                          <div className="bg-red-50 p-2 rounded">
                            <p className="text-xs text-gray-600">Occupied</p>
                            <p className="text-lg font-bold text-red-600">{capacity.occupiedBeds}</p>
                          </div>
                          <div className={`p-2 rounded ${
                            alertLevel === 'critical' ? 'bg-red-100' :
                            alertLevel === 'warning' ? 'bg-yellow-100' : 'bg-green-100'
                          }`}>
                            <p className="text-xs text-gray-600">Occupancy</p>
                            <p className={`text-lg font-bold ${
                              alertLevel === 'critical' ? 'text-red-600' :
                              alertLevel === 'warning' ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {capacity.occupancyPercentage.toFixed(1)}%
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1 border-t pt-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">ICU Beds:</span>
                            <span className="font-semibold">{capacity.icuBeds.available}/{capacity.icuBeds.total}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Emergency:</span>
                            <span className="font-semibold">{capacity.emergencyBeds.available}/{capacity.emergencyBeds.total}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">General:</span>
                            <span className="font-semibold">{capacity.generalBeds.available}/{capacity.generalBeds.total}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Recliners:</span>
                            <span className="font-semibold">{capacity.reclinerBeds?.available ?? 0}/{capacity.reclinerBeds?.total ?? 0}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Day-care chairs:</span>
                            <span className="font-semibold">{capacity.dayCareChairBeds?.available ?? 0}/{capacity.dayCareChairBeds?.total ?? 0}</span>
                          </div>
                        </div>

                        <p className="text-xs text-gray-500 mt-2">
                          Last updated: {new Date(capacity.lastUpdated).toLocaleTimeString()}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">Loading capacity data...</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
