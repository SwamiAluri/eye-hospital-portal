'use client';



import { useMemo, useState, useEffect } from 'react';

import {

  CounsellingButton,

  CounsellingEmptyState,

  CounsellingSearchInput,

  CounsellingSelectableRow,

  CounsellingSegmented,

  CounsellingSeparator,

  CounsellingSkeleton,

} from '@/components/counsellors-desk/session/primitives';

import { QuoteWorkspaceSection } from '@/components/counsellors-desk/session/QuoteWorkspaceSection';

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

      {isDoctorSuggested ? (

        <span className="shrink-0 text-[10px] text-blue-700">Dr suggested</span>

      ) : null}

      <span className="shrink-0 w-24 text-right text-xs font-semibold tabular-nums text-counselling-muted-foreground">

        {formatInr(item.price ?? 0)}

        {perEye ? <span className="font-normal text-counselling-muted-foreground/80"> /eye</span> : null}

      </span>

    </CounsellingSelectableRow>

  );

}



interface CategorySectionProps {

  title: string;

  items: MasterCatalogItem[];

  selectedInvestigations: Map<string, InvestigationItem>;

  isReadOnly: boolean;

  onToggle: (item: MasterCatalogItem) => void;

}



function CategorySection({

  title,

  items,

  selectedInvestigations,

  isReadOnly,

  onToggle,

}: CategorySectionProps) {

  if (items.length === 0) return null;



  return (

    <div>

      <p className="mb-0.5 px-1 text-xs font-semibold text-counselling-muted-foreground">

        {title}

        <span className="ml-1 font-normal text-counselling-muted-foreground/70">({items.length})</span>

      </p>

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

  /** When set, lock to imaging or lab and hide the internal segmented tab nav (Wave 2G). */
  forceCategory?: 'imaging' | 'lab';

  /** Flatten chrome when hosted under QuoteModeNav tabs. */
  hideSectionChrome?: boolean;

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

  forceCategory,

  hideSectionChrome = false,

}: CounsellingInvestigationsWorkspaceProps) {

  const [invTab, setInvTab] = useState<InvTab>(
    forceCategory === 'lab' ? 'required_investigations' : 'imaging_orders',
  );

  const [imagingSearch, setImagingSearch] = useState('');

  const [labSearch, setLabSearch] = useState('');

  useEffect(() => {
    if (forceCategory === 'lab') setInvTab('required_investigations');
    else if (forceCategory === 'imaging') setInvTab('imaging_orders');
  }, [forceCategory]);



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

  const selectedCount = selectedInvestigations.size;



  const sectionMeta =

    selectedCount > 0 ? (

      <span data-testid="counselling-investigation-selection-summary">

        {selectedCount} selected · <span className="font-semibold text-counselling-foreground">{formatInr(selectionTotal)}</span>

        {!isReadOnly ? (

          <CounsellingButton

            type="button"

            variant="ghost"

            size="sm"

            className="ml-2 h-6 px-2 text-xs"

            onClick={onClearAll}

          >

            Clear all

          </CounsellingButton>

        ) : null}

      </span>

    ) : null;



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

        />

      ) : !masterCatalogLoading && !masterCatalogError ? (

        <div className={counsellingSessionTokens.catalogCategoryGap}>

          {packageItems.length > 0 && (

            <div>

              <p className="mb-0.5 px-1 text-xs font-semibold text-indigo-800">Included in package</p>

              <CounsellingSeparator className="mb-1 bg-counselling-border" />

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



  const filtersAndList = (
    <>
      <div
        className={`${counsellingSessionTokens.investigationFilterBar} ${counsellingSessionTokens.catalogStickyFilters} -mx-0 px-0`}
      >
        {!forceCategory ? (
          <nav aria-label="Filter investigations by category">
            <CounsellingSegmented
              options={[...INV_SEG_OPTIONS]}
              selected={TAB_TO_SEG[invTab]}
              onChange={(v) => setInvTab(SEG_TO_TAB[v as InvSegOption])}
              labels={{ imaging: counsellingCopy.imagingAndScans, lab: counsellingCopy.labAndPreOp }}
              optionTestIds={{
                imaging: counsellingTestIds.tabImaging,
                lab: counsellingTestIds.tabLab,
              }}
              size="sm"
              className="w-full sm:w-auto"
              data-testid="counselling-investigation-filter"
              variant="filter"
            />
          </nav>
        ) : null}

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

  const content = hideSectionChrome ? (
    <div data-testid="counselling-investigations-section" className="space-y-2">
      {sectionMeta ? (
        <p className="text-xs text-counselling-muted-foreground">{sectionMeta}</p>
      ) : null}
      {filtersAndList}
    </div>
  ) : (
    <QuoteWorkspaceSection
      title={counsellingCopy.investigations}
      sectionNumber={2}
      meta={sectionMeta}
      data-testid="counselling-investigations-section"
    >
      {filtersAndList}
    </QuoteWorkspaceSection>
  );



  if (embedded) return content;



  return (

    <section id="counselling-step-2" className="scroll-mt-24 p-4">

      {content}

    </section>

  );

}

