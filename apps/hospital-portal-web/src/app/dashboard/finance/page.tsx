'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import {
  Plus,
  Search,
  DollarSign,
  FileText,
  TrendingUp,
  Building,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  Receipt,
  Wallet,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { opdBillingApi, type OpdBill, type OpdBillStatus } from '@/lib/api/opd-billing.api';
import { useBranchContext } from '@/hooks/use-branch-context';
import { CoveragePaymentTerms } from '@/lib/ip-management/coverage-payment-terminology';

function mapStatus(status: OpdBillStatus): string {
  switch (status) {
    case 'partial':
      return 'partially-paid';
    case 'insurance_pending':
      return 'insurance-pending';
    default:
      return status;
  }
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  partial: 'bg-yellow-100 text-yellow-800',
  'partially-paid': 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  credit: 'bg-blue-100 text-blue-800',
  insurance_pending: 'bg-indigo-100 text-indigo-800',
  'insurance-pending': 'bg-indigo-100 text-indigo-800',
  cancelled: 'bg-gray-100 text-gray-800',
  refunded: 'bg-red-100 text-red-800',
};

export default function FinancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { branchId, isReady } = useBranchContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [bills, setBills] = useState<OpdBill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'invoices' | 'reports'>('invoices');
  const [statusFilter, setStatusFilter] = useState<OpdBillStatus | 'ALL'>('ALL');

  // Phase 3 — mock insurance claims tab retired; deep-link to CCMS.
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'insurance' || tab === 'claims') {
      router.replace('/dashboard/ccms/claims');
    }
  }, [searchParams, router]);

  const loadBills = useCallback(async () => {
    if (!branchId) {
      setBills([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await opdBillingApi.getOpdBills({
        branchId,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page: 1,
        pageSize: 100,
      });
      setBills(Array.isArray(result?.bills) ? result.bills : []);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e instanceof Error ? e.message : 'Failed to load bills');
      setError(msg);
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, statusFilter]);

  useEffect(() => {
    if (isReady) void loadBills();
  }, [isReady, loadBills]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return bills;
    return bills.filter((b) => {
      const hay = [
        b.billNumber,
        b.patientId,
        b.notes,
        b.insuranceProvider,
        b.insurancePolicyNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [bills, searchQuery]);

  const statistics = useMemo(() => {
    const paid = bills.filter((b) => b.status === 'paid');
    const pending = bills.filter((b) => b.balanceDue > 0 && b.status !== 'cancelled');
    return {
      billCount: bills.length,
      paidCount: paid.length,
      pendingAmount: pending.reduce((s, b) => s + (b.balanceDue || 0), 0),
      collectedAmount: bills.reduce((s, b) => s + (b.amountPaid || 0), 0),
    };
  }, [bills]);

  return (
    <ProtectedRoute requiredPermission="FINANCE:VIEW">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-blue-600" />
              Financial Management
            </h1>
            <p className="text-gray-600 mt-1">
              Billing SoT from OPD bills. {CoveragePaymentTerms.coverageStatus} &amp; claims are in CCMS.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void loadBills()}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard/billing/opd')}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              OPD Billing
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Collected</p>
                <p className="text-2xl font-bold text-green-900">
                  ₹{statistics.collectedAmount.toLocaleString('en-IN')}
                </p>
              </div>
              <Wallet className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-lg border border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-medium">{CoveragePaymentTerms.patientPaymentStatus}</p>
                <p className="text-2xl font-bold text-yellow-900">
                  ₹{statistics.pendingAmount.toLocaleString('en-IN')}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
          <div
            className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push('/dashboard/ccms/claims')}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') router.push('/dashboard/ccms/claims');
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Coverage &amp; Claims</p>
                <p className="text-sm font-semibold text-purple-900 mt-1 inline-flex items-center gap-1">
                  Open CCMS <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </p>
              </div>
              <Building className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-lg border border-teal-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-teal-600 font-medium">Bills</p>
                <p className="text-2xl font-bold text-teal-900">{statistics.billCount}</p>
              </div>
              <FileText className="h-8 w-8 text-teal-600" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-lg border border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 font-medium">Paid bills</p>
                <p className="text-2xl font-bold text-emerald-900">{statistics.paidCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                type="button"
                onClick={() => setActiveTab('invoices')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'invoices'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Receipt className="h-4 w-4 inline mr-2" />
                OPD Bills
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/ccms/claims')}
                className="px-6 py-4 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-indigo-700"
              >
                <Building className="h-4 w-4 inline mr-2" />
                Coverage &amp; Claims (CCMS)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                className={`px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'reports'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <TrendingUp className="h-4 w-4 inline mr-2" />
                Shortcuts
              </button>
            </nav>
          </div>

          <div className="p-4">
            {activeTab === 'invoices' && (
              <>
                <div className="flex flex-wrap gap-4 items-center mb-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                      <input
                        type="text"
                        placeholder="Search bill #, patient, insurer…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as OpdBillStatus | 'ALL')}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                    <option value="insurance_pending">Insurance pending</option>
                    <option value="credit">Credit</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {!branchId && isReady && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Select a branch to load Billing SoT invoices.
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-3">
                    {error}
                  </div>
                )}

                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading bills…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 px-4 py-12 text-center text-sm text-gray-600">
                    No OPD bills for this branch. Create bills in{' '}
                    <button
                      type="button"
                      className="text-indigo-700 underline"
                      onClick={() => router.push('/dashboard/billing/opd')}
                    >
                      OPD Billing
                    </button>
                    .
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Due</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filtered.map((bill) => (
                          <tr key={bill.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">{bill.billNumber}</div>
                              <div className="text-xs text-gray-500">
                                {bill.billDate ? new Date(bill.billDate).toLocaleDateString() : '—'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              <div>{bill.patientId}</div>
                              {bill.isInsurance && (
                                <button
                                  type="button"
                                  onClick={() => router.push('/dashboard/ccms/claims')}
                                  className="text-xs text-indigo-700 hover:underline"
                                >
                                  Coverage → CCMS
                                </button>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right font-medium">
                              ₹{(bill.netAmount ?? 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-6 py-4 text-right text-green-700">
                              ₹{(bill.amountPaid ?? 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={(bill.balanceDue ?? 0) > 0 ? 'text-orange-600 font-medium' : 'text-gray-500'}>
                                ₹{(bill.balanceDue ?? 0).toLocaleString('en-IN')}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-xs px-2 py-1 rounded-full ${statusColors[mapStatus(bill.status)] ?? 'bg-gray-100 text-gray-800'}`}>
                                {mapStatus(bill.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                type="button"
                                onClick={() => router.push(`/dashboard/billing/opd?billId=${bill.id}`)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                title="Open in OPD Billing"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {activeTab === 'reports' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <button
                  type="button"
                  className="border border-gray-200 rounded-lg p-6 text-left hover:shadow-md transition-shadow"
                  onClick={() => router.push('/dashboard/billing/opd')}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">OPD Billing workspace</h3>
                  </div>
                  <p className="text-sm text-gray-600">Canonical charge generation and payment collection</p>
                </button>
                <button
                  type="button"
                  className="border border-gray-200 rounded-lg p-6 text-left hover:shadow-md transition-shadow"
                  onClick={() => router.push('/dashboard/ccms/claims')}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Building className="h-6 w-6 text-purple-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">Coverage &amp; Claims (CCMS)</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    {CoveragePaymentTerms.authorizationStatus}, claims, and {CoveragePaymentTerms.financialSettlement}
                  </p>
                </button>
                <button
                  type="button"
                  className="border border-gray-200 rounded-lg p-6 text-left hover:shadow-md transition-shadow"
                  onClick={() => router.push('/dashboard/ip-management/billing')}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <AlertCircle className="h-6 w-6 text-orange-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">IP billing board</h3>
                  </div>
                  <p className="text-sm text-gray-600">IP journey financial-state projection (not charge SoT)</p>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
