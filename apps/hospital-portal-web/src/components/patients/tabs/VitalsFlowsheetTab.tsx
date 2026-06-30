'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Activity, TrendingUp, TrendingDown, Download, Calendar, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subMonths } from 'date-fns';
import { getVitalsHistory, type VitalsReading } from '@/lib/api/widgets.api';

interface VitalsFlowsheetTabProps {
  patientId: string;
}

interface VitalSign {
  id: string;
  recordedAt: Date;
  type: 'BP' | 'Pulse' | 'Temperature' | 'SpO2' | 'Weight' | 'Height' | 'RespiratoryRate' | 'PainScore';
  systolic?: number;
  diastolic?: number;
  value?: number;
  unit?: string;
  recordedBy?: string;
  notes?: string;
}

function mapVitalsReadingToSigns(reading: VitalsReading): VitalSign[] {
  const at = new Date(reading.measuredAt);
  const signs: VitalSign[] = [];
  const by = reading.measuredBy;

  if (reading.bloodPressure?.systolic != null && reading.bloodPressure?.diastolic != null) {
    signs.push({
      id: `${reading.id}-bp`,
      recordedAt: at,
      type: 'BP',
      systolic: reading.bloodPressure.systolic,
      diastolic: reading.bloodPressure.diastolic,
      unit: 'mmHg',
      recordedBy: by,
      notes: reading.notes,
    });
  }
  if (reading.pulseRate != null) {
    signs.push({
      id: `${reading.id}-pulse`,
      recordedAt: at,
      type: 'Pulse',
      value: reading.pulseRate,
      unit: 'bpm',
      recordedBy: by,
    });
  }
  if (reading.temperature != null) {
    signs.push({
      id: `${reading.id}-temp`,
      recordedAt: at,
      type: 'Temperature',
      value: reading.temperature,
      unit: '°F',
      recordedBy: by,
    });
  }
  if (reading.oxygenSaturation != null) {
    signs.push({
      id: `${reading.id}-spo2`,
      recordedAt: at,
      type: 'SpO2',
      value: reading.oxygenSaturation,
      unit: '%',
      recordedBy: by,
    });
  }
  if (reading.weight != null) {
    signs.push({
      id: `${reading.id}-weight`,
      recordedAt: at,
      type: 'Weight',
      value: reading.weight,
      unit: 'kg',
      recordedBy: by,
    });
  }
  if (reading.heightCm != null) {
    signs.push({
      id: `${reading.id}-height`,
      recordedAt: at,
      type: 'Height',
      value: reading.heightCm,
      unit: 'cm',
      recordedBy: by,
    });
  }
  return signs;
}

export const VitalsFlowsheetTab: React.FC<VitalsFlowsheetTabProps> = ({ patientId }) => {
  const [vitals, setVitals] = useState<VitalSign[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [dateRange, setDateRange] = useState<'1m' | '3m' | '6m' | '1y'>('3m');

  useEffect(() => {
    const fetchVitals = async () => {
      if (!patientId) return;
      
      setLoading(true);
      try {
        const readings = await getVitalsHistory(patientId, 100);
        const mapped = readings.flatMap(mapVitalsReadingToSigns);
        mapped.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
        setVitals(mapped);
      } catch (error) {
        console.error('Error fetching vitals:', error);
        setVitals([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVitals();
  }, [patientId]);

  const filterVitalsByDateRange = (vitals: VitalSign[]) => {
    const now = new Date();
    const rangeMap = {
      '1m': 1,
      '3m': 3,
      '6m': 6,
      '1y': 12
    };
    const cutoffDate = subMonths(now, rangeMap[dateRange]);
    return vitals.filter(v => v.recordedAt >= cutoffDate);
  };

  const getVitalsByType = (type: VitalSign['type']) => {
    return filterVitalsByDateRange(vitals.filter(v => v.type === type));
  };

  const prepareChartData = (vitalType: VitalSign['type']) => {
    const typeVitals = getVitalsByType(vitalType);
    return typeVitals.map(v => ({
      date: format(v.recordedAt, 'MMM dd'),
      value: v.value,
      systolic: v.systolic,
      diastolic: v.diastolic,
    })).reverse(); // Oldest to newest for chart
  };

  const getLatestVital = (type: VitalSign['type']) => {
    const typeVitals = vitals.filter(v => v.type === type);
    return typeVitals.length > 0 ? typeVitals[0] : null;
  };

  const isAbnormal = (vital: VitalSign): boolean => {
    switch (vital.type) {
      case 'BP':
        return (vital.systolic && vital.systolic > 130) || (vital.diastolic && vital.diastolic > 85) || false;
      case 'Pulse':
        return (vital.value && (vital.value < 60 || vital.value > 100)) || false;
      case 'Temperature':
        return (vital.value && (vital.value < 97.0 || vital.value > 99.5)) || false;
      case 'SpO2':
        return (vital.value && vital.value < 95) || false;
      default:
        return false;
    }
  };

  const exportVitals = () => {
    const csvContent = [
      ['Date', 'Type', 'Value', 'Unit', 'Recorded By'].join(','),
      ...filterVitalsByDateRange(vitals).map(v => [
        format(v.recordedAt, 'yyyy-MM-dd HH:mm:ss'),
        v.type,
        v.type === 'BP' ? `${v.systolic}/${v.diastolic}` : v.value,
        v.unit || '',
        v.recordedBy || 'N/A'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-vitals-${patientId}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const bpData = useMemo(() => prepareChartData('BP'), [vitals, dateRange]);
  const pulseData = useMemo(() => prepareChartData('Pulse'), [vitals, dateRange]);
  const tempData = useMemo(() => prepareChartData('Temperature'), [vitals, dateRange]);
  const spo2Data = useMemo(() => prepareChartData('SpO2'), [vitals, dateRange]);
  const weightData = useMemo(() => prepareChartData('Weight'), [vitals, dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading vitals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Vitals Flowsheet</h3>
          <div className="flex gap-2">
            {(['1m', '3m', '6m', '1y'] as const).map(range => (
              <Button
                key={range}
                variant={dateRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange(range)}
              >
                {range === '1m' ? '1 Month' : range === '3m' ? '3 Months' : range === '6m' ? '6 Months' : '1 Year'}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'chart' | 'table')}>
            <TabsList>
              <TabsTrigger value="chart">Chart View</TabsTrigger>
              <TabsTrigger value="table">Table View</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={exportVitals}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Latest Vitals Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['BP', 'Pulse', 'Temperature', 'SpO2'] as const).map(type => {
          const latest = getLatestVital(type);
          const abnormal = latest ? isAbnormal(latest) : false;
          
          return (
            <Card key={type} className={abnormal ? 'border-orange-300 bg-orange-50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{type}</span>
                  {abnormal && <AlertCircle className="w-4 h-4 text-orange-600" />}
                </div>
                {latest ? (
                  <>
                    <p className="text-2xl font-bold text-gray-900">
                      {type === 'BP' 
                        ? `${latest.systolic}/${latest.diastolic}`
                        : latest.value?.toFixed(1)
                      }
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {latest.unit} • {format(latest.recordedAt, 'MMM dd, HH:mm')}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No data</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chart or Table View */}
      {viewMode === 'chart' ? (
        <div className="space-y-6">
          {/* Blood Pressure Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-red-600" />
                Blood Pressure Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={bpData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[60, 160]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="systolic" stroke="#ef4444" name="Systolic" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} />
                  <Line type="monotone" dataKey="diastolic" stroke="#3b82f6" name="Diastolic" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
                <p><strong>Normal Range:</strong> Systolic: 90-120 mmHg | Diastolic: 60-80 mmHg</p>
              </div>
            </CardContent>
          </Card>

          {/* Pulse Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Pulse Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={pulseData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[50, 110]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
                <p><strong>Normal Range:</strong> 60-100 bpm</p>
              </div>
            </CardContent>
          </Card>

          {/* Temperature & SpO2 Charts */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-orange-600" />
                  Temperature Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={tempData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[96, 100]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#f97316" fill="#fed7aa" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
                  <p><strong>Normal:</strong> 97.0-99.5°F</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-600" />
                  SpO2 Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={spo2Data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[90, 100]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#22c55e" fill="#bbf7d0" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
                  <p><strong>Normal:</strong> ≥95%</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Weight Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-600" />
                Weight Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weightData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[60, 80]} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#a855f7" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Table View */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorded By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filterVitalsByDateRange(vitals).map((vital) => (
                    <tr key={vital.id} className={isAbnormal(vital) ? 'bg-orange-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {format(vital.recordedAt, 'MMM dd, yyyy HH:mm')}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{vital.type}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {vital.type === 'BP' 
                          ? `${vital.systolic}/${vital.diastolic} ${vital.unit}`
                          : `${vital.value?.toFixed(1)} ${vital.unit}`
                        }
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{vital.recordedBy || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={isAbnormal(vital) ? 'destructive' : 'default'}>
                          {isAbnormal(vital) ? 'Abnormal' : 'Normal'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
