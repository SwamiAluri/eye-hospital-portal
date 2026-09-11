'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package, AlertTriangle, ShoppingCart, FileText, ClipboardList,
  Truck, Tag, Building2, DollarSign, TrendingUp, Clock, RefreshCw,
  Layers, ArrowRightLeft, Pill, Activity, RotateCcw, Bell, Shield,
  BarChart3, AlertCircle, CheckCircle, ChevronRight, Users,
} from 'lucide-react';
import {
  inventoryDashboardApi,
  inventoryStockApi,
  inventoryCategoryApi,
  inventoryVendorApi,
  purchaseOrderApi,
  type InventoryDashboardSummary,
  type ExpiringBatchDto,
  type CategoryDto,
  type VendorDto,
} from '@/lib/api/inventory-service.api';

// ─── Module Navigation Grid ───────────────────────────────────────────────────

const MODULE_LINKS = [
  { label: 'Vendors',            href: '/admin/inventory/vendors',               icon: Truck,          color: 'text-blue-600',    bg: 'bg-blue-50'    },
  { label: 'Invoices',           href: '/admin/inventory/invoices',              icon: FileText,       color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
  { label: 'GRN',                href: '/admin/inventory/grn',                   icon: Package,        color: 'text-teal-600',    bg: 'bg-teal-50'    },
  { label: 'Purchase Query',     href: '/admin/inventory/purchase-query',        icon: ClipboardList,  color: 'text-cyan-600',    bg: 'bg-cyan-50'    },
  { label: 'Vendor Payments',    href: '/admin/inventory/vendor-payments',       icon: DollarSign,     color: 'text-green-600',   bg: 'bg-green-50'   },
  { label: 'Stock',              href: '/admin/inventory/stock',                 icon: Layers,         color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Transfers',          href: '/admin/inventory/transfers',             icon: ArrowRightLeft, color: 'text-violet-600',  bg: 'bg-violet-50'  },
  { label: 'Items',              href: '/admin/inventory/items',                 icon: Tag,            color: 'text-amber-600',   bg: 'bg-amber-50'   },
  { label: 'Stores',             href: '/admin/inventory/stores',                icon: Building2,      color: 'text-orange-600',  bg: 'bg-orange-50'  },
  { label: 'Pharmacy Bills',     href: '/admin/inventory/pharmacy',              icon: Pill,           color: 'text-pink-600',    bg: 'bg-pink-50'    },
  { label: 'Surgery OT',         href: '/admin/inventory/surgery',               icon: Activity,       color: 'text-red-600',     bg: 'bg-red-50'     },
  { label: 'Requisitions',       href: '/admin/inventory/requisitions',          icon: ClipboardList,  color: 'text-sky-600',     bg: 'bg-sky-50'     },
  { label: 'Purchase Returns',   href: '/admin/inventory/returns',               icon: RotateCcw,      color: 'text-rose-600',    bg: 'bg-rose-50'    },
  { label: 'RFQ',                href: '/admin/inventory/rfq',                   icon: FileText,       color: 'text-purple-600',  bg: 'bg-purple-50'  },
  { label: 'Purchase Orders',    href: '/admin/inventory/po',                    icon: ShoppingCart,   color: 'text-blue-700',    bg: 'bg-blue-50'    },
  { label: 'Procurement Policy', href: '/admin/inventory/procurement/policies',  icon: Shield,         color: 'text-slate-600',   bg: 'bg-slate-50'   },
  { label: 'Auto-Reorder',       href: '/admin/inventory/reorder',               icon: Bell,           color: 'text-yellow-600',  bg: 'bg-yellow-50'  },
  { label: 'Expiry Alerts',      href: '/admin/inventory/expiry',                icon: AlertTriangle,  color: 'text-rose-600',    bg: 'bg-rose-50'    },
  { label: 'Vendor Performance', href: '/admin/inventory/vendor-performance',    icon: TrendingUp,     color: 'text-green-700',   bg: 'bg-green-50'   },
  { label: 'GST Reports',        href: '/admin/inventory/reports',               icon: BarChart3,      color: 'text-indigo-700',  bg: 'bg-indigo-50'  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function expiryUrgency(expiryDate: string) {
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86_400_000);
  if (days <= 7)  return { label: `${days}d`, cls: 'text-red-700 bg-red-100' };
  if (days <= 30) return { label: `${days}d`, cls: 'text-orange-700 bg-orange-100' };
  return { label: `${days}d`, cls: 'text-amber-700 bg-amber-100' };
}

function poStatusBadge(status: string) {
  const map: Record<string, string> = {
    Draft:             'bg-gray-100 text-gray-600',
    Submitted:         'bg-yellow-100 text-yellow-700',
    L1Approved:        'bg-blue-100 text-blue-700',
    L2Approved:        'bg-indigo-100 text-indigo-700',
    SentToVendor:      'bg-purple-100 text-purple-700',
    PartiallyReceived: 'bg-orange-100 text-orange-700',
    Received:          'bg-green-100 text-green-700',
    Cancelled:         'bg-red-100 text-red-700',
    Closed:            'bg-slate-100 text-slate-600',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InventoryDashboard() {
  const [summary,    setSummary]    = useState<InventoryDashboardSummary | null>(null);
  const [expiring,   setExpiring]   = useState<ExpiringBatchDto[]>([]);
  const [recentPOs,  setRecentPOs]  = useState<{ id: string; poNumber: string; poStatus: string; vendorName?: string; netAmount: number; createdAt: string }[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [topVendors, setTopVendors] = useState<VendorDto[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setRefreshing(true);
    Promise.allSettled([
      inventoryDashboardApi.getSummary().then(setSummary).catch(() => {}),
      inventoryStockApi.getExpiring(30).then(data => setExpiring(data.slice(0, 5))).catch(() => {}),
      purchaseOrderApi.list({ pageSize: 6 }).then(r => setRecentPOs(r.items ?? [])).catch(() => {}),
      inventoryCategoryApi.list().then(cats => setCategories(cats.slice(0, 20))).catch(() => {}),
      inventoryVendorApi.list(1, 6, undefined, true).then(r => setTopVendors(r.items ?? [])).catch(() => {}),
    ]).finally(() => { setLoading(false); setRefreshing(false); });
  }, [refreshKey]);

  return (
    <div className="min-h-screen bg-gray-50/60 staff-page staff-page-stack">

      {/* Header */}
      <div className="flex items-center justify-between gap-[var(--toolbar-gap)]">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 max-[1599px]:[font-size:var(--page-title-size)] max-[1599px]:[line-height:var(--page-title-leading)]">Inventory Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time overview across all inventory modules</p>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Procurement Summary Cards */}
      {loading && !summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 staff-kpi-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm staff-kpi-pad animate-pulse h-24" />
          ))}
        </div>
      )}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 staff-kpi-grid">
          {[
            { label: 'Pending Requisitions', value: summary.pendingRequisitions, icon: ClipboardList, color: 'text-amber-600',  bg: 'bg-amber-50',  href: '/admin/inventory/requisitions' },
            { label: 'Open RFQs',            value: summary.openRfqs,            icon: FileText,      color: 'text-blue-600',   bg: 'bg-blue-50',   href: '/admin/inventory/rfq' },
            { label: 'Pending POs',          value: summary.pendingPoCount,       icon: ShoppingCart,  color: 'text-purple-600', bg: 'bg-purple-50', href: '/admin/inventory/po' },
            { label: 'Low Stock Items',      value: summary.lowStockCount,        icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-50',    href: '/admin/inventory/stock' },
            { label: 'Month PO Spend',       value: `\u20b9${(summary.thisMonthPoSpend / 1000).toFixed(0)}k`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50', href: '/admin/inventory/po' },
            { label: 'On-Time Delivery',     value: `${summary.onTimeDeliveryRate}%`, icon: TrendingUp, color: summary.onTimeDeliveryRate >= 80 ? 'text-green-600' : 'text-red-600', bg: summary.onTimeDeliveryRate >= 80 ? 'bg-green-50' : 'bg-red-50', href: '/admin/inventory/vendor-performance' },
          ].map(card => (
            <Link key={card.label} href={card.href}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm staff-kpi-pad hover:shadow-md hover:border-blue-100 transition-all"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.bg} mb-2.5 max-[1599px]:mb-2`}>
                <card.icon size={16} className={card.color} />
              </div>
              <p className={`staff-kpi-value font-bold ${card.color}`}>{card.value}</p>
              <p className="text-[11px] text-gray-500 mt-1 leading-tight">{card.label}</p>
            </Link>
          ))}
        </div>
      )}

      {/* Expiry Alerts + Recent POs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Expiry Alerts */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle size={16} className="text-orange-500" />
              Expiring in 30 Days
            </h2>
            <Link href="/admin/inventory/expiry" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          {expiring.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <CheckCircle size={28} className="mb-2 text-green-400" />
              <p className="text-sm">No batches expiring in 30 days</p>
            </div>
          )}
          <div className="space-y-2.5">
            {expiring.slice(0, 6).map(batch => {
              const urg = expiryUrgency(batch.expiryDate);
              return (
                <div key={batch.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{batch.itemName ?? 'Unknown item'}</p>
                    <p className="text-xs text-gray-500">{batch.storeName} &middot; Qty {batch.quantityAvailable}</p>
                  </div>
                  <span className={`ml-3 flex-shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${urg.cls}`}>
                    {urg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Purchase Orders */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingCart size={16} className="text-blue-500" />
              Recent Purchase Orders
            </h2>
            <Link href="/admin/inventory/po" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          {recentPOs.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <ShoppingCart size={28} className="mb-2" />
              <p className="text-sm">No purchase orders yet</p>
            </div>
          )}
          <div className="space-y-2.5">
            {recentPOs.map(po => (
              <Link key={po.id} href="/admin/inventory/po"
                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{po.poNumber}</p>
                  <p className="text-xs text-gray-500 truncate">{po.vendorName ?? '\u2014'}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <span className="text-xs font-medium text-gray-700">
                    \u20b9{(po.netAmount ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${poStatusBadge(po.poStatus)}`}>
                    {po.poStatus}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Categories + Top Vendors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Categories */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Tag size={16} className="text-purple-500" />
              Purchase Categories
            </h2>
            <Link href="/admin/inventory/items" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              Manage items <ChevronRight size={12} />
            </Link>
          </div>
          {categories.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Tag size={28} className="mb-2" />
              <p className="text-sm">No categories configured</p>
            </div>
          )}
          <div className="space-y-2">
            {categories.slice(0, 6).map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Tag size={13} className="text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-800">{cat.categoryName}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${cat.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {cat.categoryType}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Preferred Vendors */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Truck size={16} className="text-green-500" />
              Preferred Vendors
            </h2>
            <Link href="/admin/inventory/vendors" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              All vendors <ChevronRight size={12} />
            </Link>
          </div>
          {topVendors.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Users size={28} className="mb-2" />
              <p className="text-sm">No preferred vendors yet</p>
            </div>
          )}
          <div className="space-y-2">
            {topVendors.map(v => (
              <div key={v.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{v.name}</p>
                  <p className="text-xs text-gray-500">{v.vendorCategory}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  {v.outstandingBalance > 0 && (
                    <span className="text-xs text-rose-600 font-medium">
                      \u20b9{(v.outstandingBalance / 1000).toFixed(1)}k due
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${v.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {v.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* All Modules Grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Package size={16} className="text-blue-500" />
          All Modules
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {MODULE_LINKS.map(mod => (
            <Link key={mod.href} href={mod.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${mod.bg} group-hover:scale-110 transition-transform`}>
                <mod.icon size={18} className={mod.color} />
              </div>
              <span className="text-xs font-medium text-gray-700 text-center leading-tight">{mod.label}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
