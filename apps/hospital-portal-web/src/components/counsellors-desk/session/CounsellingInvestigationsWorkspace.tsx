'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  FlaskConical,
  FolderOpen,
  HeartPulse,
  Microscope,
  Package,
  ScanLine,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import {
  CounsellingBadge,
  CounsellingButton,
  CounsellingEmptyState,
  CounsellingSearchInput,
  CounsellingSelectableRow,
  CounsellingSegmented,
  CounsellingSeparator,
  CounsellingSkeleton,
} from '@/components/counsellors-desk/session/primitives';
import { counsellingCopy } from '@/lib/counsellors-desk/counselling-copy';
import { formatInr } from '@/lib/counsellors-desk/package-preview';
import { counsellingSessionTokens, counsellingTestIds } from '@/lib/counsellors-desk/counselling-session-tokens';
import type { InvestigationItem, MasterCatalogItem } from '@/types/counsellors-desk';

type InvTab = 'imaging_orders' | 'required_investigations';

const INV_SEG_OPTIONS = ['imaging', 'lab'] as const;
type InvSegOption = (typeof INV_SEG_OPTIONS)[number];

const SEG_TO_TAB: Record<InvSegOption, InvTab> = {
  imaging: 'imaging_orders',
  lab: 'required_investigations',
};

const TAB_TO_SEG: Record<InvTab, InvSegOption> = {
  imaging_orders: 'imaging',
  required_investigations: 'lab',
};

const IMAGING_CATEGORY_ORDER = [
  'Consultation Charges',
  'Diagnostic Scans',
  'Laser Procedures',
  'Minor Procedures',
];

const LAB_CATEGORY_ORDER = [
  'General Investigations',
  'Cardiac Investigations',
  'Viral Markers',
  'Pre-Operative Panel',
];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Consultation Charges': Stethoscope,
  'Diagnostic Scans': ScanLine,
  'Laser Procedures': Activity,
  'Minor Procedures': Activity,
  'General Investigations': FlaskConical,
  'Cardiac Investigations': HeartPulse,
  'Viral Markers': Microscope,
  'Pre-Operative Panel': FlaskConical,
};

const PER_EYE_CATEGORIES = new Set([
  'Diagnostic Scans',
  'Laser Procedures',
  'Minor Procedures',
]);

function sortCategories(keys: string[], order: string[]): string[] {
  return [
    ...order.filter((c) => keys.includes(c)),
    ...keys.filter((c) => !order.includes(c)).sort(),
  ];
}

function groupByCategory(items: MasterCatalogItem[]): Record<string, MasterCatalogItem[]> {
  const grouped: Record<string, MasterCatalogItem[]> = {};
  items.forEach((item) => {
    const cat = item.category ?? 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });
  return grouped;
}

interface InvestigationRowProps {
  item: MasterCatalogItem;
  isSelected: boolean;
  isDoctorSuggested: boolean;
  isReadOnly: boolean;
  onToggle: () => void;
}

function InvestigationRow({
  item,
  isSelected,
  isDoctorSuggested,
  isReadOnly,
  onToggle,
}: InvestigationRowProps) {
  const perEye = item.testType !== 'Lab' && PER_EYE_CATEGORIES.has(item.category ?? '');

  return (
    <CounsellingSelectableRow
      selected={isSelected}
      disabled={isReadOnly}
      showCheckbox
      checkboxLabel={item.name}
      onClick={onToggle}
    >
      <span className={`min-w-0 flex-1 truncate ${isSelected ? 'font-medium' : ''}`}>{item.name}</span>
      {isDoctorSuggested && (
        <CounsellingBadge variant="outline" className="shrink-0 border-blue-200 bg-blue-50 text-[9px] text-blue-700">
          Dr suggested
        </CounsellingBadge>
      )}
      <span className="shrink-0 w-24 text-right text-xs font-semibold tabular-nums text-counselling-muted-foreground">
        {formatInr(item.price ?? 0)}
        {perEye && <span className="font-normal text-counselling-muted-foreground/80"> /eye</span>}
      </span>
    </CounsellingSelectableRow>
  );
}

interface CategorySectionProps {
  title: string;
  icon?: LucideIcon;
  items: MasterCatalogItem[];
  selectedInvestigations: Map<string, InvestigationItem>;
  isReadOnly: boolean;
  onToggle: (item: MasterCatalogItem) => void;
}

function CategorySection({
  title,
  icon: Icon,
  items,
  selectedInvestigations,
  isReadOnly,
  onToggle,
}: CategorySectionProps) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 px-1">
        {Icon ? <Icon size={13} className="text-counselling-primary" /> : <FolderOpen size={13} className="text-counselling-muted-foreground/80" />}
        <p className="text-xs font-semibold text-counselling-muted-foreground">{title}</p>
        <span className="text-[10px] text-counselling-muted-foreground/70">({items.length})</span>
      </div>
      <CounsellingSeparator className="mb-1 bg-counselling-border" />
      <div className={counsellingSessionTokens.catalogListGap}>
        {items.map((item) => {
          const inv = selectedInvestigations.get(item.id);
          return (
            <InvestigationRow
              key={item.id}
              item={item}
              isSelected={selectedInvestigations.has(item.id)}
              isDoctorSuggested={inv?.source === 'doctor'}
              isReadOnly={isReadOnly}
              onToggle={() => onToggle(item)}
            />
          );
        })}
      </div>
    </div>
  );
}

export interface CounsellingInvestigationsWorkspaceProps {
  embedded?: boolean;
  masterCatalog: {
    imaging: MasterCatalogItem[];
    scan: MasterCatalogItem[];
    lab: MasterCatalogItem[];
  };
  masterCatalogLoading?: boolean;
  masterCatalogError?: boolean;
  onRetryMasterCatalog?: () => void;
  selectedInvestigations: Map<string, InvestigationItem>;
  onToggleInvestigation: (item: MasterCatalogItem) => void;
  onClearAll: () => void;
  isReadOnly: boolean;
  isPackageMode: boolean;
  packageInvestigationIds: string[];
}

export function CounsellingInvestigationsWorkspace({
  embedded = false,
  masterCatalog,
  masterCatalogLoading = false,
  masterCatalogError = false,
  onRetryMasterCatalog,
  selectedInvestigations,
  onToggleInvestigation,
  onClearAll,
  isReadOnly,
  isPackageMode,
  packageInvestigationIds,
}: CounsellingInvestigationsWorkspaceProps) {
  const [invTab, setInvTab] = useState<InvTab>('imaging_orders');
  const [imagingSearch, setImagingSearch] = useState('');
  const [labSearch, setLabSearch] = useState('');

  const packageIdSet = useMemo(() => new Set(packageInvestigationIds), [packageInvestigationIds]);

  const selectionTotal = useMemo(
    () => Array.from(selectedInvestigations.values()).reduce((sum, inv) => sum + (inv.price ?? 0), 0),
    [selectedInvestigations],
  );

  const tabItems = useMemo(() => {
    if (invTab === 'imaging_orders') {
      return [...masterCatalog.imaging, ...masterCatalog.scan];
    }
    return masterCatalog.lab;
  }, [invTab, masterCatalog]);

  const filteredItems = useMemo(() => {
    const q = (invTab === 'imaging_orders' ? imagingSearch : labSearch).trim().toLowerCase();
    if (!q) return tabItems;
    return tabItems.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.code ?? '').toLowerCase().includes(q) ||
        (i.category ?? '').toLowerCase().includes(q),
    );
  }, [invTab, imagingSearch, labSearch, tabItems]);

  const { packageItems, catalogItems } = useMemo(() => {
    if (!isPackageMode || packageIdSet.size === 0) {
      return { packageItems: [] as MasterCatalogItem[], catalogItems: filteredItems };
    }
    const pkg: MasterCatalogItem[] = [];
    const rest: MasterCatalogItem[] = [];
    filteredItems.forEach((item) => {
      if (packageIdSet.has(item.id)) pkg.push(item);
      else rest.push(item);
    });
    return { packageItems: pkg, catalogItems: rest };
  }, [filteredItems, isPackageMode, packageIdSet]);

  const categoryOrder = invTab === 'imaging_orders' ? IMAGING_CATEGORY_ORDER : LAB_CATEGORY_ORDER;
  const groupedCatalog = groupByCategory(catalogItems);
  const sortedCategories = sortCategories(Object.keys(groupedCatalog), categoryOrder);

  const activeSearch = invTab === 'imaging_orders' ? imagingSearch : labSearch;
  const totalCatalogCount =
    masterCatalog.imaging.length + masterCatalog.scan.length + masterCatalog.lab.length;

  const listContent = (
    <>
      {masterCatalogLoading && (
        <div className={`${counsellingSessionTokens.catalogListGap} py-2`}>
          <CounsellingSkeleton className={`${counsellingSessionTokens.catalogInput} w-full`} />
          <CounsellingSkeleton className={`${counsellingSessionTokens.catalogInput} w-full`} />
          <CounsellingSkeleton className={`${counsellingSessionTokens.catalogInput} w-full`} />
        </div>
      )}

      {!masterCatalogLoading && masterCatalogError && (
        <div className="flex flex-col items-center gap-2 py-6">
          <p className="text-sm text-counselling-muted-foreground">Unable to load investigations.</p>
          {onRetryMasterCatalog && (
            <CounsellingButton type="button" variant="outline" size="sm" onClick={onRetryMasterCatalog}>
              Retry
            </CounsellingButton>
          )}
        </div>
      )}

      {!masterCatalogLoading && !masterCatalogError && filteredItems.length === 0 ? (
        <CounsellingEmptyState
          compact
          title={activeSearch ? 'No results' : 'No items available'}
          description={
            activeSearch
              ? 'Try a different search term or switch tabs.'
              : 'No billable investigations are configured in the service catalog.'
          }
        />
      ) : !masterCatalogLoading && !masterCatalogError ? (
        <div className={counsellingSessionTokens.catalogCategoryGap}>
          {packageItems.length > 0 && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-2">
              <p className="mb-1 flex items-center gap-1.5 px-1 text-xs font-semibold text-indigo-800">
                <Package size={13} />
                Included in Package
              </p>
              <div className={counsellingSessionTokens.catalogListGap}>
                  {packageItems.map((item) => {
                    const inv = selectedInvestigations.get(item.id);
                    return (
                      <InvestigationRow
                        key={item.id}
                        item={item}
                        isSelected={selectedInvestigations.has(item.id)}
                        isDoctorSuggested={inv?.source === 'doctor'}
                        isReadOnly={isReadOnly}
                        onToggle={() => {
                          if (!isReadOnly) onToggleInvestigation(item);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {sortedCategories.map((cat) => (
              <CategorySection
                key={cat}
                title={cat}
                icon={CATEGORY_ICONS[cat]}
                items={groupedCatalog[cat]}
                selectedInvestigations={selectedInvestigations}
                isReadOnly={isReadOnly}
                onToggle={(item) => {
                  if (!isReadOnly) onToggleInvestigation(item);
                }}
              />
            ))}
        </div>
      ) : null}
    </>
  );

  const content = (
    <>
      {selectedInvestigations.size > 0 && (
        <div className="mb-2 flex min-h-9 items-center justify-between gap-2 rounded-lg border border-counselling-primary/30 bg-counselling-accent/60 px-3 py-1.5">
          <p className="text-xs text-counselling-accent-foreground">
            <span className="font-semibold">{selectedInvestigations.size}</span> selected ·{' '}
            <span className="font-bold tabular-nums">{formatInr(selectionTotal)}</span>
          </p>
          {!isReadOnly && (
            <CounsellingButton type="button" variant="outline" size="sm" onClick={onClearAll}>
              Clear All
            </CounsellingButton>
          )}
        </div>
      )}

      <div className={`${counsellingSessionTokens.catalogStickyFilters} -mx-1 mb-2 space-y-2 px-1`}>
        <CounsellingSegmented
          options={[...INV_SEG_OPTIONS]}
          selected={TAB_TO_SEG[invTab]}
          onChange={(v) => setInvTab(SEG_TO_TAB[v as InvSegOption])}
          labels={{ imaging: counsellingCopy.imagingAndScans, lab: counsellingCopy.labAndPreOp }}
          size="sm"
          className="w-full"
          data-testid="counselling-tab"
        />

        {!masterCatalogLoading && totalCatalogCount > 0 && (
          <p className="text-[10px] text-counselling-muted-foreground">
            {masterCatalog.imaging.length + masterCatalog.scan.length} diagnostics · {masterCatalog.lab.length} lab tests
          </p>
        )}

        <CounsellingSearchInput
          value={invTab === 'imaging_orders' ? imagingSearch : labSearch}
          onChange={invTab === 'imaging_orders' ? setImagingSearch : setLabSearch}
          placeholder={
            invTab === 'imaging_orders' ? counsellingCopy.searchDiagnostics : counsellingCopy.searchLabTests
          }
          disabled={isReadOnly || masterCatalogLoading}
          data-testid={counsellingTestIds.investigationSearch}
        />
      </div>

      {listContent}
    </>
  );

  if (embedded) return content;

  return (
    <section
      id="counselling-step-2"
      className="scroll-mt-24 rounded-xl border border-counselling-border bg-counselling-card p-4 shadow-sm"
    >
      {content}
    </section>
  );
}
