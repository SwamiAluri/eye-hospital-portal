'use client';

import React, { useEffect, useState } from 'react';
import { Image, Eye, FileImage, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { imagingApi, type ImagingOrderResponse } from '@/lib/api/imaging.api';

interface ImagingTabProps {
  patientId: string;
}

export const ImagingTab: React.FC<ImagingTabProps> = ({ patientId }) => {
  const [orders, setOrders] = useState<ImagingOrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void imagingApi
      .getPatientOrders(patientId)
      .then((rows) => {
        if (!cancelled) {
          setOrders(
            [...rows].sort(
              (a, b) =>
                new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime(),
            ),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load imaging orders.');
          setOrders([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading imaging…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Imaging & Scans</h3>
          <p className="text-sm text-gray-500">{orders.length} order(s) on file</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {orders.length === 0 && !error ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
          <Image className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">No imaging orders for this patient yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardContent className="p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <FileImage className="w-8 h-8 text-cyan-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{order.imagingType}</p>
                    <p className="text-sm text-gray-500">
                      Ordered {new Date(order.orderedAt).toLocaleString()}
                      {order.orderingDoctorName
                        ? ` · ${order.orderingDoctorName}`
                        : ''}
                    </p>
                    {order.clinicalIndication && (
                      <p className="text-sm text-gray-600 mt-1">{order.clinicalIndication}</p>
                    )}
                    {order.resultSummary && (
                      <p className="text-sm text-gray-700 mt-2">{order.resultSummary}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{order.status}</Badge>
                  {order.laterality && (
                    <Badge variant="outline">
                      <Eye className="w-3 h-3 mr-1" />
                      {order.laterality}
                    </Badge>
                  )}
                  {order.urgency && order.urgency !== 'Routine' && (
                    <Badge className="bg-orange-100 text-orange-800">{order.urgency}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Button variant="outline" type="button" disabled>
        Open in Imaging Module (coming soon)
      </Button>
    </div>
  );
};
