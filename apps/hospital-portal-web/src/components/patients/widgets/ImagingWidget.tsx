'use client';

import React, { useEffect, useState } from 'react';
import { Image, Eye, FileImage } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { imagingApi, type ImagingOrderResponse } from '@/lib/api/imaging.api';

interface ImagingWidgetProps {
  patientId: string;
  onViewImaging?: () => void;
}

export const ImagingWidget: React.FC<ImagingWidgetProps> = ({ patientId, onViewImaging }) => {
  const [orders, setOrders] = useState<ImagingOrderResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void imagingApi
      .getPatientOrders(patientId)
      .then((rows) => {
        if (!cancelled) setOrders(rows);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const recent = [...orders]
    .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())
    .slice(0, 3);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Image className="w-5 h-5 text-cyan-600" />
            Imaging & Scans
          </span>
          <Badge variant="secondary">{orders.length} Total</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="h-20 bg-gray-50 rounded-lg animate-pulse" />
        ) : (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Recent Scans</h4>
            {recent.length > 0 ? (
              <div className="space-y-2">
                {recent.map((scan) => (
                  <div
                    key={scan.id}
                    className="p-2 bg-gray-50 rounded flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <FileImage className="w-4 h-4 text-cyan-600" />
                      <div>
                        <p className="text-sm font-medium">{scan.imagingType}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(scan.orderedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {scan.laterality && (
                      <Badge variant="outline" className="text-xs">
                        <Eye className="w-3 h-3 mr-1" />
                        {scan.laterality}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No imaging orders on file</p>
            )}
          </div>
        )}

        {onViewImaging && (
          <Button variant="outline" size="sm" className="w-full" onClick={onViewImaging}>
            View All Imaging
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
