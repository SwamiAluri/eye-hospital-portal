/**
 * Lab Test Integration Widget — Counselor lab ordering with catalog, pricing, and lab tech notification
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical, Clock, CheckCircle2, AlertCircle, Plus, X,
  ChevronDown, Filter, Loader2, Bell, IndianRupee, Activity,
} from 'lucide-react';
import { WidgetProps } from '@/lib/widgets/widget-types';
import { getApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useSpecimenTypes } from '@/hooks/use-lab-masters';

interface CatalogTest {
  id: string;
  testName: string;
  testCode: string;
  category: string;
  price: number;
  turnaroundHours: number;
  sampleType: string;
  isPreOperative: boolean;
}

interface OrderedTest {
  id: string;
  testName: string;
  testCode: string;
  price: number;
  urgency: string;
  status: string;
  orderedAt: string;
  notes?: string;
}

const URGENCY_OPTIONS = [
  { value: 'routine', label: 'Routine', color: 'text-green-700 bg-green-50 border-green-200' },
  { value: 'urgent', label: 'Urgent', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  { value: 'stat', label: 'STAT', color: 'text-red-700 bg-red-50 border-red-200' },
];

const STATUS_COLORS: Record<string, string> = {
  ordered: 'bg-blue-100 text-blue-700',
  processing: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const LabTestIntegrationWidget: React.FC<WidgetProps> = ({
  patientId,
  sessionId,
  data,
  onDataChange,
}) => {
  const [catalog, setCatalog] = useState<CatalogTest[]>([]);
  const [orderedTests, setOrderedTests] = useState<OrderedTest[]>(
    (data as any)?.orderedTests ?? []
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [orderNotes, setOrderNotes] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [specimenFilter, setSpecimenFilter] = useState<string>('All');
  const { labels: specimenTypes } = useSpecimenTypes();
  const [panelOpen, setPanelOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Sync from parent when data prop changes (session restored from DB)
  useEffect(() => {
    if ((data as any)?.orderedTests) {
      setOrderedTests((data as any).orderedTests);
    }
  }, [(data as any)?.orderedTests]);

  const loadCatalog = useCallback(async () => {
    if (catalog.length > 0) return; // already loaded
    try {
      setCatalogLoading(true);
      const api = getApi();
      const res = await api.get('/pre-op-test-management/lab-catalog');
      setCatalog(res.data ?? []);
    } catch {
      showToast('error', 'Could not load test catalog');
    } finally {
      setCatalogLoading(false);
    }
  }, [catalog.length]);

  const openPanel = () => {
    setPanelOpen(true);
    loadCatalog();
  };

  const toggleTest = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const placeOrder = async () => {
    if (!patientId || !sessionId || selectedIds.size === 0) return;
    const testsToOrder = catalog
      .filter(t => selectedIds.has(t.id))
      .map(t => ({ testCatalogId: t.id, testName: t.testName, testCode: t.testCode, price: t.price }));

    setSubmitting(true);
    try {
      const api = getApi();
      await api.post('/pre-op-test-management/lab-orders', {
        sessionId,
        patientId,
        urgency,
        notes: orderNotes,
        tests: testsToOrder,
      });

      // Add to local ordered list
      const now = new Date().toISOString();
      const newOrders: OrderedTest[] = testsToOrder.map(t => ({
        id: `local-${t.testCatalogId}-${Date.now()}`,
        testName: t.testName,
        testCode: t.testCode,
        price: t.price,
        urgency,
        status: 'ordered',
        orderedAt: now,
        notes: orderNotes || undefined,
      }));
      const updated = [...orderedTests, ...newOrders];
      setOrderedTests(updated);
      onDataChange?.({ ...(data as any), orderedTests: updated });

      setSelectedIds(new Set());
      setOrderNotes('');
      setPanelOpen(false);
      showToast('success', `${testsToOrder.length} test${testsToOrder.length > 1 ? 's' : ''} ordered — Lab technician notified`);
    } catch {
      showToast('error', 'Failed to place order. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const categories = ['All', ...Array.from(new Set(catalog.map(t => t.category))).sort()];
  const specimenFilters = ['All', ...specimenTypes];
  const filteredCatalog = catalog.filter((t) => {
    const categoryOk = categoryFilter === 'All' || t.category === categoryFilter;
    const specimenOk =
      specimenFilter === 'All' ||
      t.sampleType.toLowerCase().includes(specimenFilter.toLowerCase());
    return categoryOk && specimenOk;
  });

  const selectedTests = catalog.filter(t => selectedIds.has(t.id));
  const totalPrice = selectedTests.reduce((s, t) => s + t.price, 0);

  return (
    <div className="flex flex-col gap-3">

      {/* Toast notification */}
      {toast && (
        <div className={cn(
          'mx-4 flex items-start gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border',
          toast.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-700'
        )}>
          {toast.type === 'success'
            ? <Bell className="h-4 w-4 flex-shrink-0 mt-0.5" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-800">Lab Tests</span>
          {orderedTests.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
              {orderedTests.length}
            </span>
          )}
        </div>
        {patientId && sessionId && (
          <button
            onClick={openPanel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Order Tests
          </button>
        )}
      </div>

      {/* Order panel (inline, no modal) */}
      {panelOpen && (
        <div className="mx-4 border border-blue-200 rounded-xl bg-white shadow-sm overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-blue-50 border-b border-blue-200">
            <span className="text-sm font-semibold text-blue-900">Select Tests to Order</span>
            <button onClick={() => { setPanelOpen(false); setSelectedIds(new Set()); }}
              className="p-1 hover:bg-blue-100 rounded-lg">
              <X className="h-4 w-4 text-blue-600" />
            </button>
          </div>

          {catalogLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading catalog…</span>
            </div>
          ) : (
            <>
              {/* Category + specimen filters */}
              <div className="px-3 py-2 flex gap-1.5 flex-wrap border-b border-gray-100">
                <Filter className="h-3.5 w-3.5 text-gray-400 self-center flex-shrink-0" />
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-full border font-medium transition-colors',
                      categoryFilter === cat
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="px-3 py-2 flex gap-1.5 flex-wrap border-b border-gray-100">
                <span className="text-[10px] font-semibold text-gray-400 self-center uppercase tracking-wide">Specimen</span>
                {specimenFilters.map((spec) => (
                  <button
                    key={spec}
                    onClick={() => setSpecimenFilter(spec)}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-full border font-medium transition-colors',
                      specimenFilter === spec
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
                    )}
                  >
                    {spec}
                  </button>
                ))}
              </div>

              {/* Test list */}
              <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
                {filteredCatalog.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No tests in this category</p>
                ) : (
                  filteredCatalog.map(test => {
                    const sel = selectedIds.has(test.id);
                    return (
                      <label
                        key={test.id}
                        className={cn(
                          'flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                          sel ? 'bg-blue-50' : 'hover:bg-gray-50'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={sel}
                          onChange={() => toggleTest(test.id)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 leading-tight">{test.testName}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{test.testCode} · {test.category} · {test.sampleType}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{test.turnaroundHours}h turnaround</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-gray-900 flex items-center gap-0.5">
                            <IndianRupee className="h-3 w-3" />{test.price.toLocaleString('en-IN')}
                          </p>
                          {test.isPreOperative && (
                            <span className="text-[10px] text-amber-600 font-medium">Pre-op</span>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              {/* Urgency + notes */}
              <div className="px-3 py-2.5 border-t border-gray-100 space-y-2.5">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Priority</p>
                  <div className="flex gap-2">
                    {URGENCY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setUrgency(opt.value as any)}
                        className={cn(
                          'flex-1 text-xs font-semibold py-1.5 rounded-lg border transition-colors',
                          urgency === opt.value ? opt.color : 'text-gray-500 bg-white border-gray-200 hover:border-gray-300'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  placeholder="Clinical notes for lab (optional)…"
                  rows={2}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-gray-400"
                />
              </div>

              {/* Order footer */}
              <div className="px-3 py-2.5 border-t border-blue-100 bg-blue-50 flex items-center gap-3">
                <div className="flex-1">
                  {selectedIds.size > 0 ? (
                    <>
                      <p className="text-xs text-blue-700 font-semibold">{selectedIds.size} test{selectedIds.size > 1 ? 's' : ''} selected</p>
                      <p className="text-xs text-blue-600 flex items-center gap-0.5">
                        Total: <IndianRupee className="h-3 w-3" /><span className="font-bold">{totalPrice.toLocaleString('en-IN')}</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-blue-500">Select tests above</p>
                  )}
                </div>
                <button
                  onClick={placeOrder}
                  disabled={selectedIds.size === 0 || submitting}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors',
                    selectedIds.size > 0 && !submitting
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  )}
                >
                  {submitting ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />Ordering…</>
                  ) : (
                    <><Bell className="h-3.5 w-3.5" />Notify Lab</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Ordered tests list */}
      <div className="px-4 pb-4">
        {orderedTests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400">
            <FlaskConical className="h-10 w-10 mb-2 opacity-20" />
            <p className="text-sm">No lab tests ordered yet</p>
            <p className="text-xs text-gray-400 mt-1">Click "Order Tests" to add tests for this session</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ordered Tests</p>
            {orderedTests.map((test, i) => (
              <div key={test.id ?? i} className="flex items-start gap-3 p-2.5 border border-gray-200 rounded-xl bg-white">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  test.status === 'completed' ? 'bg-green-100' : 'bg-blue-100'
                )}>
                  {test.status === 'completed'
                    ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                    : <Activity className="h-4 w-4 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-tight">{test.testName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{test.testCode}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[test.status] ?? 'bg-gray-100 text-gray-500')}>
                      {test.status}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {test.urgency !== 'routine' && <span className={cn('font-semibold', test.urgency === 'stat' ? 'text-red-600' : 'text-orange-600')}>{test.urgency.toUpperCase()} · </span>}
                      {new Date(test.orderedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-700 flex items-center gap-0.5">
                    <IndianRupee className="h-3 w-3" />{test.price.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            ))}
            {/* Price summary */}
            <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
              <span className="font-medium">{orderedTests.length} test{orderedTests.length > 1 ? 's' : ''} ordered</span>
              <span className="font-bold text-gray-800 flex items-center gap-0.5">
                Total: <IndianRupee className="h-3 w-3" />{orderedTests.reduce((s, t) => s + (t.price ?? 0), 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LabTestIntegrationWidget;

