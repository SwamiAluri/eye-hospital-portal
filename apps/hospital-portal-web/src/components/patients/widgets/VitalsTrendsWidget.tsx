'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import { getVitalsHistory, type VitalsReading } from '@/lib/api/widgets.api';

interface VitalsTrendsWidgetProps {
  patientId: string;
  onViewVitals?: () => void;
}

function readingsInLastMonths(readings: VitalsReading[], months: number): VitalsReading[] {
  const cutoff = subMonths(new Date(), months);
  return readings.filter((r) => new Date(r.measuredAt) >= cutoff);
}

export const VitalsTrendsWidget: React.FC<VitalsTrendsWidgetProps> = ({
  patientId,
  onViewVitals,
}) => {
  const [readings, setReadings] = useState<VitalsReading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getVitalsHistory(patientId, 50)
      .then((rows) => {
        if (!cancelled) setReadings(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const recent = useMemo(() => readingsInLastMonths(readings, 3), [readings]);

  const bpChart = useMemo(
    () =>
      [...recent]
        .reverse()
        .filter(
          (r) =>
            r.bloodPressure?.systolic != null && r.bloodPressure?.diastolic != null,
        )
        .map((r) => ({
          date: format(new Date(r.measuredAt), 'MMM d'),
          systolic: r.bloodPressure.systolic,
          diastolic: r.bloodPressure.diastolic,
        })),
    [recent],
  );

  const latest = recent[0];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-5 h-5 text-red-600" />
            Vitals Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-gray-50 rounded-lg animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!latest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-red-600" />
              Vitals Trends
            </span>
            <Badge variant="secondary">Last 3 months</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No vitals recorded in the last 3 months.</p>
          {onViewVitals && (
            <Button variant="outline" size="sm" className="w-full mt-4" onClick={onViewVitals}>
              Record vitals
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const latestBp =
    latest.bloodPressure?.systolic != null && latest.bloodPressure?.diastolic != null
      ? `${latest.bloodPressure.systolic}/${latest.bloodPressure.diastolic}`
      : '—';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-600" />
            Vitals Trends
          </span>
          <Badge variant="secondary">Last 3 months</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Blood Pressure</p>
            <p className="text-xl font-bold text-gray-900">{latestBp}</p>
            <p className="text-xs text-gray-500">mmHg</p>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Pulse</p>
            <p className="text-xl font-bold text-gray-900">
              {latest.pulseRate ?? '—'}
            </p>
            <p className="text-xs text-gray-500">bpm</p>
          </div>
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Temperature</p>
            <p className="text-xl font-bold text-gray-900">
              {latest.temperature ?? '—'}
            </p>
            <p className="text-xs text-gray-500">°F</p>
          </div>
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">SpO2</p>
            <p className="text-xl font-bold text-gray-900">
              {latest.oxygenSaturation ?? '—'}
            </p>
            <p className="text-xs text-gray-500">%</p>
          </div>
        </div>

        {bpChart.length > 1 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              BP Trend (Systolic)
            </h4>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={bpChart}>
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="systolic"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ fill: '#ef4444', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {onViewVitals && (
          <Button variant="outline" size="sm" className="w-full" onClick={onViewVitals}>
            View Full Vitals History
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
