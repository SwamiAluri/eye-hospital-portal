'use client';

import { useEffect, useState } from 'react';
import { DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
import { opdBillsApi } from '@/lib/api';
import { format } from 'date-fns';

type BillRow = {
  id: string;
  billNumber?: string;
  billDate?: string;
  createdAt?: string;
  netAmount?: number;
  totalAmount?: number;
  amountPaid?: number;
  paidAmount?: number;
  balanceDue?: number;
  balanceAmount?: number;
  status?: string;
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd MMM yyyy');
  } catch {
    return '—';
  }
}

function billBalance(bill: BillRow) {
  if (bill.balanceDue != null) return Number(bill.balanceDue);
  if (bill.balanceAmount != null) return Number(bill.balanceAmount);
  const total = Number(bill.netAmount ?? bill.totalAmount ?? 0);
  const paid = Number(bill.amountPaid ?? bill.paidAmount ?? 0);
  return Math.max(0, total - paid);
}

function billTotal(bill: BillRow) {
  return Number(bill.netAmount ?? bill.totalAmount ?? 0);
}

function billPaid(bill: BillRow) {
  return Number(bill.amountPaid ?? bill.paidAmount ?? 0);
}

export function BillingTab({ patientId }: { patientId: string }) {
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await opdBillsApi.getByPatient(patientId, 1, 50);
        const payload = response.data;
        const rows = Array.isArray(payload)
          ? payload
          : payload?.bills ?? [];
        if (!cancelled) setBills(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) {
          setBills([]);
          setError('Billing data is temporarily unavailable.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-sm text-gray-500">Loading billing…</div>
    );
  }

  const outstanding = bills.reduce((sum, bill) => sum + billBalance(bill), 0);

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Billing history</h3>
        <span className="text-sm text-gray-600">{bills.length} bill(s)</span>
      </div>

      <div
        className={`border rounded-lg p-6 ${
          outstanding > 0
            ? 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-200'
            : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
        }`}
      >
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-1">Outstanding balance</h4>
            <p className={`text-3xl font-bold ${outstanding > 0 ? 'text-red-700' : 'text-green-700'}`}>
              ₹{outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          {outstanding > 0 ? (
            <AlertCircle className="w-12 h-12 text-red-600" />
          ) : (
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          )}
        </div>
      </div>

      {bills.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">No billing records found</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Bill #</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Total</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Paid</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Balance</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {bills.map((bill) => {
                const balance = billBalance(bill);
                const paid = billPaid(bill);
                const total = billTotal(bill);
                const status =
                  bill.status ||
                  (balance === 0 ? 'paid' : paid > 0 ? 'partial' : 'pending');
                return (
                  <tr key={bill.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{formatDate(bill.billDate || bill.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-indigo-600">
                      {bill.billNumber || `BILL-${String(bill.id).substring(0, 8)}`}
                    </td>
                    <td className="px-4 py-3 text-right">₹{total.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-green-600">₹{paid.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">₹{balance.toFixed(2)}</td>
                    <td className="px-4 py-3 capitalize">{status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
