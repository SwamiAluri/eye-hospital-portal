'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { opdBillsApi } from '@/lib/api';

interface BillingWidgetProps {
  patientId: string;
  onViewBilling?: () => void;
}

export const BillingWidget: React.FC<BillingWidgetProps> = ({ patientId, onViewBilling }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBilling = async () => {
      if (!patientId) return;
      
      setLoading(true);
      try {
        const response = await opdBillsApi.getByPatient(patientId);
        const bills = response.data?.bills ?? response.data ?? [];
        
        const unpaidBills = bills.filter((b: any) => b.paymentStatus === 'pending' || b.paymentStatus === 'partial');
        const totalOutstanding = unpaidBills.reduce((sum: number, b: any) => sum + (b.totalAmount - (b.paidAmount || 0)), 0);
        const recentBills = bills.slice(0, 3);
        
        setData({ unpaidBills, totalOutstanding, recentBills });
      } catch (error) {
        console.error('Error fetching billing:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBilling();
  }, [patientId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Billing & Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-4">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Billing & Payments
          </span>
          {data?.totalOutstanding > 0 && (
            <Badge variant="destructive">{data.unpaidBills.length} Unpaid</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Outstanding Amount */}
        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Outstanding Balance</span>
            {data?.totalOutstanding > 0 ? (
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600" />
            )}
          </div>
          <p className="text-3xl font-bold text-gray-900">
            ₹{data?.totalOutstanding.toFixed(2) || '0.00'}
          </p>
          {data?.unpaidBills.length > 0 && (
            <p className="text-xs text-gray-600 mt-1">
              Across {data.unpaidBills.length} bill(s)
            </p>
          )}
        </div>

        {/* Recent Bills */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Recent Bills</h4>
          {data?.recentBills.length > 0 ? (
            <div className="space-y-2">
              {data.recentBills.map((bill: any) => (
                <div key={bill.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <p className="text-sm font-medium">Bill #{bill.billNumber || bill.id.substring(0, 8)}</p>
                    <p className="text-xs text-gray-500">{new Date(bill.billDate).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">₹{bill.totalAmount}</p>
                    <Badge variant={bill.paymentStatus === 'paid' ? 'default' : 'destructive'} className="text-xs">
                      {bill.paymentStatus}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No billing history</p>
          )}
        </div>

        {onViewBilling && (
          <Button variant="outline" size="sm" className="w-full" onClick={onViewBilling}>
            View Full Billing History
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
