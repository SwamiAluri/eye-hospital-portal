'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/lib/auth-store';
import { chargeMappingApi, type ChargeExceptionList, type ChargeVariantSearch, type PackageComponentStatus } from '@/lib/api/charge-mapping.api';
import { counsellingPackageTemplatesApi } from '@/lib/api/counselling-package-templates.api';
import {
  canManageChargeMapping,
  CHARGE_MAPPING_TEST_IDS as tid,
  formatInr,
  formatParkedItemSubtitle,
  formatReplayToast,
  rankUnmappedItems,
  unmappedPackageCallout,
} from '@/lib/billing/charge-mapping';

export default function ChargeMappingPage() {
  const permissions = useAuthStore((s) => s.permissions);
  const allowed = canManageChargeMapping(permissions);

  const [data, setData] = useState<ChargeExceptionList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, ChargeVariantSearch>>({});
  const [suggestions, setSuggestions] = useState<Record<string, ChargeVariantSearch[]>>({});
  const [packages, setPackages] = useState<{ id: string; name: string }[]>([]);
  const [packageId, setPackageId] = useState('');
  const [components, setComponents] = useState<PackageComponentStatus[]>([]);
  const [postedNote, setPostedNote] = useState(false);
  const packageSectionRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await chargeMappingApi.getExceptions(90);
      setData(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load charge exceptions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void load();
    counsellingPackageTemplatesApi.getAll({ isActive: true })
      .then((rows) => setPackages(rows.map((r) => ({ id: r.id, name: r.name }))))
      .catch(() => setPackages([]));
  }, [allowed, load]);

  useEffect(() => {
    if (!packageId) {
      setComponents([]);
      return;
    }
    chargeMappingApi.getPackage(packageId)
      .then(setComponents)
      .catch(() => setComponents([]));
  }, [packageId]);

  const items = useMemo(() => rankUnmappedItems(data?.items ?? []), [data?.items]);
  const firstUnmappedPackage = data?.unmappedPackageComponents[0];

  if (!allowed) {
    return (
      <div className="p-6 max-w-xl" data-testid={tid.noPermission}>
        <h1 className="text-xl font-semibold">Charge mapping</h1>
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
          You need <b>bill.admin</b> to map inventory items to billed catalog variants. Unmapped usage stays parked.
        </div>
      </div>
    );
  }

  const search = async (itemId: string, q: string) => {
    setDrafts((d) => ({ ...d, [itemId]: q }));
    if (q.trim().length < 2) {
      setSuggestions((s) => ({ ...s, [itemId]: [] }));
      return;
    }
    const rows = await chargeMappingApi.searchVariants(q.trim());
    setSuggestions((s) => ({ ...s, [itemId]: rows }));
  };

  const mapItem = async (itemId: string, variantId: string, chargeable = true, reason?: string) => {
    try {
      await chargeMappingApi.createMapping({
        itemId,
        serviceVariantId: variantId,
        isChargeable: chargeable,
        nonChargeableReason: reason,
      });
      toast.success(chargeable
        ? 'Mapped. Replay parked charges to post them onto OpdBill.'
        : 'This item won’t be charged to patients.');
      setPicked((p) => {
        const next = { ...p };
        delete next[itemId];
        return next;
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Mapping failed');
    }
  };

  const saveComponentVariant = async (componentId: string, variantId: string) => {
    if (!packageId) return;
    try {
      const next = components.map((c) => ({
        componentKey: c.componentKey,
        componentName: c.componentName,
        serviceVariantId: c.id === componentId ? variantId : c.serviceVariantId,
        allocation: c.allocation,
        coversConsumable: c.coversConsumable,
        sortOrder: 0,
      }));
      const saved = await chargeMappingApi.savePackage(packageId, next);
      setComponents(saved);
      toast.success('Package component mapped.');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Package mapping failed');
    }
  };

  const replay = async () => {
    try {
      const result = await chargeMappingApi.replay();
      const outcome = formatReplayToast(result);
      if (outcome.postedCallout) setPostedNote(true);
      if (outcome.tone === 'warning') toast.error(outcome.message);
      else toast.success(outcome.message);
      await load();
    } catch {
      toast.error('Replay failed');
    }
  };

  const openPackageMapping = () => {
    if (firstUnmappedPackage?.packageTemplateId) {
      setPackageId(firstUnmappedPackage.packageTemplateId);
    }
    packageSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const kpis = data?.kpis;

  return (
    <div className="ip-target" data-testid={tid.page}>
      <div className="frame">
      <div className="app-header">
        <h1>Charge mapping</h1>
        <span className="scope">last 90 days · parked, never posted at purchase rate</span>
        <span className="spacer" />
        <button type="button" className="btn sm" data-testid={tid.refresh} onClick={() => void load()} disabled={loading}>Refresh</button>
        <button type="button" className="btn sm primary" data-testid={tid.replay} onClick={() => void replay()}>Replay all resolved</button>
      </div>

      {error && <div className="callout danger" style={{ margin: 12 }}>{error}</div>}
      {postedNote && (
        <div className="callout ok" style={{ margin: 12 }} data-testid={tid.postedCallout}>
          <b>Charge posted.</b> Mapped items are on the OpdBill. Census Patient dues now includes those lines. Do not type a charge on the journey.
        </div>
      )}

      <div className="kpis">
        <div className={`kpi ${(kpis?.unmappedItemCount ?? 0) > 0 ? 'is-alert' : ''}`}>
          <div className="label">Unmapped items in use</div>
          <div className="value num">{kpis?.unmappedItemCount ?? 0}</div>
        </div>
        <div className={`kpi ${(kpis?.blockedChargeValue ?? 0) > 0 ? 'is-alert' : ''}`}>
          <div className="label">Blocked charge value</div>
          <div className="value num">{formatInr(kpis?.blockedChargeValue ?? 0)}</div>
        </div>
        <div className="kpi">
          <div className="label">Bills affected</div>
          <div className="value num">{kpis?.billsAffected ?? 0}</div>
        </div>
        <div className="kpi is-inhouse">
          <div className="label">Mapped this week</div>
          <div className="value num">{kpis?.mappedThisWeek ?? 0}</div>
        </div>
      </div>

      <table className="grid">
        <thead>
          <tr>
            <th>Item</th>
            <th>Type</th>
            <th>Uses</th>
            <th>Last used</th>
            <th>Est. value</th>
            <th>Map to billable variant</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {loading && items.length === 0 && (
            <tr>
              <td colSpan={7}><div className="empty">Loading parked charges…</div></td>
            </tr>
          )}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={7}>
                <div className="empty" data-testid={tid.empty}>All items are mapped. No leakage from missing mappings.</div>
              </td>
            </tr>
          )}
          {items.map((item) => {
            const id = item.itemId ?? item.itemCode;
            const chosen = picked[id];
            return (
              <tr key={id}>
                <td>
                  <div className="cell-primary">{item.itemName || 'Unknown item'}</div>
                  <div className="cell-sub mono">{formatParkedItemSubtitle(item)}</div>
                </td>
                <td>{item.itemType}</td>
                <td className="num">{item.useCount}</td>
                <td>{item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleDateString('en-IN') : '—'}</td>
                <td className="num">{formatInr(item.estimatedValue)}</td>
                <td style={{ minWidth: 240 }}>
                  <input
                    className="input"
                    placeholder="Search service variant…"
                    value={drafts[id] ?? ''}
                    onChange={(e) => void search(id, e.target.value)}
                  />
                  {(suggestions[id] ?? []).length > 0 && (
                    <ul className="mt-1 max-h-40 overflow-auto rounded border bg-white text-xs">
                      {(suggestions[id] ?? []).map((v) => (
                        <li key={v.id}>
                          <button
                            type="button"
                            className="w-full px-2 py-1 text-left hover:bg-muted"
                            onClick={() => {
                              setDrafts((d) => ({ ...d, [id]: `${v.name} (${v.code})` }));
                              setPicked((p) => ({ ...p, [id]: v }));
                              setSuggestions((s) => ({ ...s, [id]: [] }));
                            }}
                          >
                            {v.name} · {v.code} · {formatInr(v.price)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="whitespace-nowrap">
                  {item.itemId && (
                    <>
                      <button
                        type="button"
                        className="btn sm primary"
                        data-testid={tid.map}
                        onClick={() => {
                          if (!chosen) {
                            toast.error('Search a variant first');
                            return;
                          }
                          void mapItem(item.itemId!, chosen.id);
                        }}
                      >
                        Map
                      </button>
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => {
                          if (!chosen) {
                            toast.error('Search a variant first');
                            return;
                          }
                          void mapItem(item.itemId!, chosen.id, false, 'Always included in the package');
                        }}
                      >
                        Non-chargeable
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--ip-line)', background: 'var(--ip-surface-alt)' }}>
        <div className="row between">
          <div className="small">
            <b>{kpis?.unmappedItemCount ?? 0} blocked charge · {formatInr(kpis?.blockedChargeValue ?? 0)}.</b>
            {' '}Mapping replays parked implant / package lines onto OpdBill.
          </div>
          <button type="button" className="btn sm primary" onClick={() => void replay()}>Replay all resolved</button>
        </div>
      </div>
      </div>

      <div className="frame" style={{ marginTop: 14 }} ref={packageSectionRef}>
        <div className="app-header">
          <h1 style={{ fontSize: 14 }}>Package component mapping</h1>
          <span className="spacer" />
          <select
            className="input"
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
          >
            <option value="">Select a counselling package…</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        {(data?.unmappedPackageComponents.length ?? 0) > 0 && (
          <div className="callout warn" style={{ margin: 12 }} data-testid={tid.packageUnmapped}>
            <p>{unmappedPackageCallout(firstUnmappedPackage?.packageName)}</p>
            <button
              type="button"
              className="btn sm"
              style={{ marginTop: 8 }}
              data-testid={tid.openPackage}
              onClick={openPackageMapping}
            >
              Open package component mapping
            </button>
          </div>
        )}
        {components.length > 0 && (
          <table className="grid">
            <thead>
              <tr>
                <th>Component</th>
                <th>Billable variant</th>
                <th>Allocation</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {components.map((c) => (
                <tr key={c.id}>
                  <td>{c.componentName}</td>
                  <td className="mono">
                    {c.variantCode || (
                      <input
                        className="input"
                        placeholder="Search variant…"
                        onBlur={(e) => {
                          const q = e.target.value.trim();
                          if (q.length < 2) return;
                          void chargeMappingApi.searchVariants(q).then((rows) => {
                            if (rows[0]) void saveComponentVariant(c.id, rows[0].id);
                          });
                        }}
                      />
                    )}
                  </td>
                  <td>{c.allocation}</td>
                  <td className="num">{c.catalogPrice != null ? formatInr(c.catalogPrice) : '—'}</td>
                  <td>
                    <span className={`badge ${c.status === 'Mapped' ? 'ok' : 'danger'}`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
