'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHasPermission } from '@/lib/permission-cache';
import { logoutEverywhere } from '@/lib/logout-everywhere';
import { SIDEBAR_MENU_SECTIONS } from '@/lib/navigation/sidebar-menu-sections';
import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  memo,
  type ComponentType,
} from 'react';

/** Expanded sidebar SoT at this CSS viewport and above; collapse by default below. */
const SIDEBAR_EXPANDED_MIN_WIDTH_MQ = '(min-width: 1600px)';
import {
  ChevronDown,
  ChevronRight,
  Settings,
  Building2,
  LogOut,
  Menu,
} from 'lucide-react';


interface SidebarProps {
  isMobileOpen?: boolean;
  onClose?: () => void;
  drawerOnly?: boolean;
}

function SidebarIcon({
  icon: Icon,
  className,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  className: string;
}) {
  return <Icon className={className} strokeWidth={2.5} />;
}

function Sidebar({ isMobileOpen = false, onClose, drawerOnly = false }: SidebarProps) {
  const hasPermission = useHasPermission();
  const pathname = usePathname();
  const [openSection, setOpenSection] = useState<string | null>('Dashboard');
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [expandedSubsections, setExpandedSubsections] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia(SIDEBAR_EXPANDED_MIN_WIDTH_MQ).matches;
  });
  /** When true, ignore responsive defaults until the 1600px density boundary is crossed. */
  const manualOverrideRef = useRef(false);
  const [collapsedPopover, setCollapsedPopover] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(SIDEBAR_EXPANDED_MIN_WIDTH_MQ);
    const applyResponsiveDefault = () => {
      manualOverrideRef.current = false;
      setIsCollapsed(!mq.matches);
    };
    // Sync after mount (hydration / first paint).
    if (!manualOverrideRef.current) {
      setIsCollapsed(!mq.matches);
    }
    const onViewportBandChange = () => applyResponsiveDefault();
    mq.addEventListener('change', onViewportBandChange);
    return () => mq.removeEventListener('change', onViewportBandChange);
  }, []);

  const toggleCollapsed = useCallback(() => {
    manualOverrideRef.current = true;
    setIsCollapsed((prev) => !prev);
  }, []);

  const handleLogout = () => {
    void logoutEverywhere('user');
  };

  const toggleSection = (sectionTitle: string) => {
    setOpenSection(prev => prev === sectionTitle ? null : sectionTitle);
  };

  const toggleSubmenu = (label: string) => {
    setExpandedItems(prev => 
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const toggleSubsection = (label: string) => {
    setExpandedSubsections(prev => 
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const menuSections = SIDEBAR_MENU_SECTIONS;

  const filteredSections = useMemo(
    () =>
      menuSections
        .map(section => ({
          ...section,
          items: section.items.filter(
            item => !item.requiredPermission || hasPermission(item.requiredPermission),
          ),
        }))
        .filter(section => section.items.length > 0),
    [hasPermission],
  );

  const isActive = (href: string, exact?: boolean) => {
    if (href === '/dashboard' || exact) {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  // Auto-open the correct section and expand submenu whenever the pathname changes.
  // This prevents the sidebar from collapsing when navigating between sub-pages.
  useEffect(() => {
    for (const section of menuSections) {
      for (const item of section.items) {
        // Skip non-navigable section dividers
        if (item.href === '#') continue;

        if (item.isExpandable && item.subItems) {
          const hasActiveChild = item.subItems.some((sub) =>
            isActive(sub.href, sub.exact)
          );
          if (hasActiveChild) {
            setOpenSection(prev => (prev === section.title ? prev : section.title));
            setExpandedItems(prev =>
              prev.includes(item.label) ? prev : [...prev, item.label]
            );
            return;
          }
        }

        if (isActive(item.href, item.exact)) {
          setOpenSection(prev => (prev === section.title ? prev : section.title));
          return;
        }
      }
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    {/* Desktop sidebar � hidden below lg (1024px) */}
    {!drawerOnly && (
    <nav
      data-testid="app-sidebar"
      className="hidden lg:flex flex-col h-full font-sans transition-all duration-300 overflow-hidden bg-navy-900"
      style={{
        width: isCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-expanded-width)',
      }}
      aria-label="Main navigation"
    >
      {/* Header */}
      <div className={`${isCollapsed ? 'p-3' : 'px-4 py-4'} border-b flex-shrink-0`} style={{borderColor:'rgba(255,255,255,0.1)'}}>
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-lg flex items-center justify-center flex-shrink-0 bg-primary-500 h-[var(--sidebar-logo-size)] w-[var(--sidebar-logo-size)]">
              <Building2 className="h-[var(--sidebar-section-icon-size)] w-[var(--sidebar-section-icon-size)] text-white" />
            </div>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="p-1.5 rounded-md transition-colors"
              style={{color:'rgba(255,255,255,0.5)'}}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor='rgba(255,255,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor='transparent')}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              data-testid="sidebar-expand"
            >
              <Menu className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-lg flex items-center justify-center flex-shrink-0 bg-primary-500 h-[var(--sidebar-logo-size)] w-[var(--sidebar-logo-size)]">
                <Building2 className="h-[var(--sidebar-section-icon-size)] w-[var(--sidebar-section-icon-size)] text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="font-semibold text-sm text-white truncate">Hospital Portal</h1>
                <p className="text-xs truncate" style={{color:'rgba(255,255,255,0.45)'}}>Healthcare Excellence</p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="p-1.5 rounded-md transition-colors flex-shrink-0"
              style={{color:'rgba(255,255,255,0.5)'}}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor='rgba(255,255,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor='transparent')}
              aria-label="Collapse sidebar"
              data-testid="sidebar-collapse"
              title="Collapse sidebar"
            >
              <Menu className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-3 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {filteredSections.map((section) => {
          const visibleItems = section.items;
          const isOpen = openSection === section.title;
          const showSectionPopover = isCollapsed && collapsedPopover === section.title;

          return (
            <div key={section.title} className="mb-1 relative">
              {/* Section Header */}
              <button
                onClick={() => {
                  if (isCollapsed) {
                    setCollapsedPopover(showSectionPopover ? null : section.title);
                  } else {
                    toggleSection(section.title);
                  }
                }}
                className="w-full flex items-center justify-between px-3 py-[var(--sidebar-item-pad-y)] transition-colors group"
                style={{color: isOpen ? 'white' : 'rgba(255,255,255,0.65)'}}
                onMouseEnter={e => { if(!isOpen) e.currentTarget.style.backgroundColor='rgba(255,255,255,0.07)'; }}
                onMouseLeave={e => { if(!isOpen) e.currentTarget.style.backgroundColor='transparent'; }}
                title={isCollapsed ? section.title : ''}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'gap-2.5'}`}>
                  <span className="flex-shrink-0">
                    <SidebarIcon icon={section.icon} className="h-[var(--sidebar-section-icon-size)] w-[var(--sidebar-section-icon-size)]" />
                  </span>
                  {!isCollapsed && <span className="text-xs font-semibold uppercase tracking-wider">{section.title}</span>}
                </div>
                {!isCollapsed && (
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 flex-shrink-0 ${
                    isOpen ? 'rotate-180' : ''
                  }`} style={{color:'rgba(255,255,255,0.4)'}} />
                )}
              </button>

              {/* Collapsed Section Popover */}
              {showSectionPopover && (
                <div className="absolute left-full top-0 ml-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[240px] max-h-[600px] overflow-y-auto z-50">
                  <div className="px-4 py-2 text-sm font-semibold text-gray-800 border-b border-gray-100 sticky top-0 bg-white">
                    {section.title}
                  </div>
                  {(() => {
                    let currentSubsection: string | null = null;
                    return visibleItems.map((item, index) => {
                      // Handle subsection headers
                      if (item.isSection) {
                        currentSubsection = item.label;
                        return (
                          <div key={`section-${item.label}`} className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-3 first:mt-2">
                            {item.label}
                          </div>
                        );
                      }
                      
                      const active = isActive(item.href);
                      
                      // Handle expandable items with sub-items (e.g., HR Management)
                      if (item.isExpandable && item.subItems) {
                        return (
                          <div key={item.label}>
                            <div className="px-4 py-2 text-xs font-semibold text-gray-600 mt-2 flex items-center gap-2">
                              <SidebarIcon icon={item.icon} className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" />
                              <span>{item.label}</span>
                            </div>
                            {item.subItems.map((subItem) => {
                              const subActive = isActive(subItem.href, subItem.exact);
                              return (
                                <Link
                                  key={subItem.href}
                                  href={subItem.href}
                                  prefetch={false}
                                  onClick={() => setCollapsedPopover(null)}
                                  className={`
                                    flex items-center gap-3 px-6 py-2 transition-all duration-150
                                    ${subActive
                                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500'
                                      : 'text-gray-700 hover:bg-primary-50/60 hover:text-primary-700'
                                    }
                                  `}
                                >
                                  <span className={`text-xs ${subActive ? 'text-teal-600' : 'text-gray-600'}`}>
                                    <SidebarIcon icon={subItem.icon} className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" />
                                  </span>
                                  <span className="text-sm">{subItem.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        );
                      }
                      
                      // Regular item
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          prefetch={false}
                          onClick={() => setCollapsedPopover(null)}
                          className={`
                            flex items-center gap-3 px-4 py-2 transition-all duration-150
                            ${active
                              ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500'
                              : 'text-gray-700 hover:bg-primary-50/60 hover:text-primary-700'
                            }
                          `}
                        >
                          <span className={`${active ? 'text-teal-600' : 'text-gray-600'}`}>
                            <SidebarIcon icon={item.icon} className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" />
                          </span>
                          <span className="text-sm">{item.label}</span>
                        </Link>
                      );
                    });
                  })()}
                </div>
              )}

              {/* Section Items */}
              {isOpen && !isCollapsed && (
                <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  // Render subsection header
                  if (item.isSection) {
                    const isSubsectionExpanded = expandedSubsections.includes(item.label);
                    if (isCollapsed) return null; // Don't show subsection headers when collapsed
                    return (
                      <div key={item.label} className="ml-4 mr-2">
                        <button
                          onClick={() => toggleSubsection(item.label)}
                          className="w-full flex items-center justify-between px-3 py-2 mt-2 mb-0.5 transition-colors group"
                          style={{color:'rgba(255,255,255,0.4)'}}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider">{item.label}</span>
                          </div>
                          <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${
                            isSubsectionExpanded ? 'rotate-90' : ''
                          }`} />
                        </button>
                      </div>
                    );
                  }

                  // Check if item is under a subsection
                  const itemIndex = visibleItems.indexOf(item);
                  const previousItems = visibleItems.slice(0, itemIndex);
                  const lastSubsection = previousItems.reverse().find(i => i.isSection);
                  
                  // If there's a subsection before this item and it's not expanded, don't show the item
                  if (lastSubsection && !expandedSubsections.includes(lastSubsection.label)) {
                    return null;
                  }

                  const active = isActive(item.href);
                  
                  // Determine if this is a subsection item (comes after a section header)
                  const isSubsectionItem = !!lastSubsection;
                  
                  const baseClass = item.isChild 
                    ? "pl-12 pr-4 py-[var(--sidebar-item-pad-y)]" 
                    : isSubsectionItem
                    ? "pl-6 pr-4 py-[var(--sidebar-item-pad-y)]"
                    : "pl-4 pr-4 py-[var(--sidebar-item-pad-y)]";
                  
                  // Render expandable menu item with submenu
                  if (item.isExpandable && item.subItems) {
                    const isExpanded = expandedItems.includes(item.label);
                    if (isCollapsed) {
                      // Show only icon with popover for sub-items when collapsed
                      const showPopover = collapsedPopover === item.label;
                      return (
                        <div key={item.label} className="mx-2 relative">
                          <button
                            onClick={() => setCollapsedPopover(showPopover ? null : item.label)}
                            className={`
                              w-full flex items-center justify-center py-[var(--sidebar-item-pad-y)] rounded-md transition-all duration-150
                              ${active
                                ? 'text-primary-400'
                                : 'hover:text-white'
                              }
                            `}
                          style={{color: active ? '#34d399' : 'rgba(255,255,255,0.55)', backgroundColor: active ? 'rgba(16,185,129,0.15)' : undefined}}
                            title={item.label}
                          >
                            <span className={`font-bold ${active ? 'text-teal-600' : 'text-gray-600'}`}>
                              <SidebarIcon icon={item.icon} className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" />
                            </span>
                          </button>
                          {showPopover && item.subItems && (
                            <div className="absolute left-full top-0 ml-2 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[200px] z-50">
                              <div className="px-4 py-2 text-sm font-bold text-gray-700 border-b border-gray-100">
                                {item.label}
                              </div>
                              {item.subItems.map((subItem) => {
                                const subActive = isActive(subItem.href, subItem.exact);
                                return (
                                  <Link
                                    key={subItem.href}
                                    href={subItem.href}
                                    prefetch={false}
                                    onClick={() => setCollapsedPopover(null)}
                                    className={`
                                      flex items-center gap-3 px-4 py-2.5 transition-all duration-150
                                      ${subActive
                                        ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500'
                                        : 'text-gray-700 hover:bg-primary-50/60 hover:text-primary-700'
                                      }
                                    `}
                                  >
                                    <span className={`font-bold ${subActive ? 'text-teal-600' : 'text-gray-600'}`}>
                                      <SidebarIcon icon={subItem.icon} className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" />
                                    </span>
                                    <span className="font-bold text-sm">{subItem.label}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div key={item.label} className="mx-2">
                        <button
                          onClick={() => toggleSubmenu(item.label)}
                          className={`
                            w-full flex items-center justify-between ${baseClass} rounded-md transition-all duration-150
                            ${active
                              ? 'text-white'
                              : ''
                            }
                          `}
                      style={{color: active ? 'white' : 'rgba(255,255,255,0.7)', backgroundColor: active ? 'rgba(16,185,129,0.15)' : undefined}}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`font-bold ${active ? 'text-teal-600' : 'text-gray-600'}`}>
                              <SidebarIcon icon={item.icon} className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" />
                            </span>
                            <span className="font-bold text-sm">{item.label}</span>
                          </div>
                          <ChevronRight className={`h-3.5 w-3.5 text-gray-500 transition-transform duration-200 ${
                            isExpanded ? 'rotate-90' : ''
                          }`} />
                        </button>
                        {isExpanded && item.subItems.map((subItem) => {
                          const subActive = isActive(subItem.href, subItem.exact);
                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              prefetch={false}
                              className={`
                                flex items-center gap-3 pl-12 pr-4 py-[var(--sidebar-item-pad-y)] rounded-md transition-all duration-150
                                ${subActive
                                  ? 'text-white'
                                  : ''
                                }
                              `}
                              style={{color: subActive ? 'white' : 'rgba(255,255,255,0.6)', backgroundColor: subActive ? 'rgba(16,185,129,0.15)' : undefined}}
                            >
                              <span className={`font-bold ${subActive ? 'text-teal-600' : 'text-gray-600'}`}>
                                <SidebarIcon icon={subItem.icon} className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" />
                              </span>
                              <span className="font-bold text-sm">{subItem.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    );
                  }

                  // Render menu item
                  if (isCollapsed) {
                    // Show only icon with tooltip when collapsed
                    return (
                      <div key={item.href} className="mx-2" title={item.label}>
                        <Link
                          href={item.href}
                          prefetch={false}
                          className={`
                            flex items-center justify-center py-[var(--sidebar-item-pad-y)] rounded-md transition-all duration-150
                          `}
                          style={{color: active ? '#34d399' : 'rgba(255,255,255,0.55)', backgroundColor: active ? 'rgba(16,185,129,0.15)' : undefined}}
                        >
                          <SidebarIcon icon={item.icon} className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" />
                        </Link>
                      </div>
                    );
                  }
                  return (
                    <div key={item.href} className="mx-2">
                      <Link
                        href={item.href}
                        prefetch={false}
                        className={`
                          flex items-center gap-3 ${baseClass} rounded-md transition-all duration-150
                          ${active ? 'border-l-2 border-primary-400' : ''}
                        `}
                        style={{color: active ? 'white' : 'rgba(255,255,255,0.7)', backgroundColor: active ? 'rgba(16,185,129,0.15)' : undefined}}
                        onMouseEnter={e => { if(!active) e.currentTarget.style.backgroundColor='rgba(255,255,255,0.07)'; }}
                        onMouseLeave={e => { if(!active) e.currentTarget.style.backgroundColor='transparent'; }}
                      >
                        <span className="flex-shrink-0">
                          <SidebarIcon icon={item.icon} className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" />
                        </span>
                        <span className="text-sm flex-1 truncate">{item.label}</span>
                        {item.badge}
                      </Link>
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 flex-shrink-0" style={{borderTop:'1px solid rgba(255,255,255,0.1)'}}>
        <Link
          href="/dashboard/settings"
          prefetch={false}
          className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-md transition-colors mb-1`}
          style={{color:'rgba(255,255,255,0.55)'}}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor='rgba(255,255,255,0.08)'; e.currentTarget.style.color='white'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor='transparent'; e.currentTarget.style.color='rgba(255,255,255,0.55)'; }}
          title={isCollapsed ? "Settings" : ""}
        >
          <Settings className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)] flex-shrink-0" />
          {!isCollapsed && <span className="text-sm">Settings</span>}
        </Link>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-md transition-colors`}
          style={{color:'rgba(239,68,68,0.75)'}}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor='rgba(239,68,68,0.12)'; e.currentTarget.style.color='#ef4444'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor='transparent'; e.currentTarget.style.color='rgba(239,68,68,0.75)'; }}
          title={isCollapsed ? "Logout" : ""}
        >
          <LogOut className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)] flex-shrink-0" />
          {!isCollapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </nav>
    )}

    {/* Mobile / tablet slide-in drawer � visible only when isMobileOpen=true, on screens < lg */}
    {isMobileOpen && (
      <>
        {/* Backdrop overlay */}
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
        {/* Drawer panel */}
        <nav
          className="fixed inset-y-0 left-0 z-50 w-64 shadow-2xl flex flex-col h-full font-sans overflow-y-auto lg:hidden bg-navy-900"
          aria-label="Mobile navigation"
        >
          {/* Drawer header */}
          <div className="px-4 py-4 flex items-center justify-between flex-shrink-0" style={{borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
            <div className="flex items-center gap-3">
              <div className="rounded-lg flex items-center justify-center flex-shrink-0 bg-primary-500 h-[var(--sidebar-logo-size)] w-[var(--sidebar-logo-size)]">
                <Building2 className="h-[var(--sidebar-section-icon-size)] w-[var(--sidebar-section-icon-size)] text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-sm text-white">Hospital Portal</h1>
                <p className="text-xs" style={{color:'rgba(255,255,255,0.45)'}}>Healthcare Excellence</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md transition-colors"
              style={{color:'rgba(255,255,255,0.5)'}}
              aria-label="Close menu"
            >
              <Menu className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" />
            </button>
          </div>

          {/* Drawer nav items � same structure as desktop, never collapsed */}
          <div className="flex-1 overflow-y-auto py-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {filteredSections.map((section) => {
              const visibleItems = section.items;
              const isOpen = openSection === section.title;
              return (
                <div key={section.title} className="mb-0.5">
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="w-full flex items-center justify-between px-3 py-[var(--sidebar-item-pad-y)] transition-colors"
                    style={{color: isOpen ? 'white' : 'rgba(255,255,255,0.65)'}}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex-shrink-0"><SidebarIcon icon={section.icon} className="h-[var(--sidebar-section-icon-size)] w-[var(--sidebar-section-icon-size)]" /></span>
                      <span className="text-xs font-semibold uppercase tracking-wider">{section.title}</span>
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{color:'rgba(255,255,255,0.4)'}} />
                  </button>
                  {isOpen && (
                    <div className="space-y-0.5">
                      {visibleItems.map((item) => {
                        if (item.isSection) {
                          return (
                            <div key={item.label} className="mx-3 mt-3 mb-1">
                              <span className="text-xs font-semibold uppercase tracking-wider" style={{color:'rgba(255,255,255,0.35)'}}>{item.label}</span>
                            </div>
                          );
                        }
                        const active = isActive(item.href);
                        if (item.isExpandable && item.subItems) {
                          const isExpanded = expandedItems.includes(item.label);
                          return (
                            <div key={item.label} className="mx-2">
                              <button
                                onClick={() => toggleSubmenu(item.label)}
                                className={`w-full flex items-center justify-between pl-4 pr-4 py-[var(--sidebar-item-pad-y)] rounded-md transition-all duration-150`}
                                style={{color: active ? 'white' : 'rgba(255,255,255,0.7)', backgroundColor: active ? 'rgba(16,185,129,0.15)' : undefined}}
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`font-bold ${active ? 'text-teal-600' : 'text-gray-600'}`}><SidebarIcon icon={item.icon} className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" /></span>
                                  <span className="font-bold text-sm">{item.label}</span>
                                </div>
                                <ChevronRight className={`h-3.5 w-3.5 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                              {isExpanded && item.subItems.map((subItem) => {
                                const subActive = isActive(subItem.href, subItem.exact);
                                return (
                                  <Link
                                    key={subItem.href}
                                    href={subItem.href}
                                    prefetch={false}
                                    onClick={onClose}
                                    className={`flex items-center gap-3 pl-12 pr-4 py-[var(--sidebar-item-pad-y)] rounded-md transition-all duration-150 ${
                                      subActive ? 'border-l-2 border-primary-400' : ''
                                    }`}
                                    style={{color: subActive ? 'white' : 'rgba(255,255,255,0.65)', backgroundColor: subActive ? 'rgba(16,185,129,0.15)' : undefined}}
                                  >
                                    <span><SidebarIcon icon={subItem.icon} className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" /></span>
                                    <span className="text-sm">{subItem.label}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          );
                        }
                        return (
                          <div key={item.href} className="mx-2">
                            <Link
                              href={item.href}
                              prefetch={false}
                              onClick={onClose}
                              className={`flex items-center gap-3 pl-4 pr-4 py-[var(--sidebar-item-pad-y)] rounded-md transition-all duration-150 ${
                                active ? 'border-l-2 border-primary-400' : ''
                              }`}
                              style={{color: active ? 'white' : 'rgba(255,255,255,0.7)', backgroundColor: active ? 'rgba(16,185,129,0.15)' : undefined}}
                            >
                              <span className="flex-shrink-0"><SidebarIcon icon={item.icon} className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" /></span>
                              <span className="text-sm flex-1 truncate">{item.label}</span>
                              {item.badge}
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Drawer footer */}
          <div className="p-3 flex-shrink-0" style={{borderTop:'1px solid rgba(255,255,255,0.1)'}}>
            <Link
              href="/dashboard/settings"
              prefetch={false}
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors mb-1"
              style={{color:'rgba(255,255,255,0.55)'}}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor='rgba(255,255,255,0.08)'; e.currentTarget.style.color='white'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor='transparent'; e.currentTarget.style.color='rgba(255,255,255,0.55)'; }}
            >
              <Settings className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)] flex-shrink-0" />
              <span className="text-sm">Settings</span>
            </Link>
            <button
              onClick={() => { handleLogout(); onClose?.(); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors"
              style={{color:'rgba(239,68,68,0.75)'}}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor='rgba(239,68,68,0.12)'; e.currentTarget.style.color='#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor='transparent'; e.currentTarget.style.color='rgba(239,68,68,0.75)'; }}
            >
              <LogOut className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)] flex-shrink-0" />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </nav>
      </>
    )}
    </>
  );
}

export default memo(Sidebar);
