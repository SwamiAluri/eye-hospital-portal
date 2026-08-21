/**
 * Widget System Type Definitions
 * Central type system for the counselor workspace widget architecture
 */

import { LucideIcon } from 'lucide-react';

/**
 * Widget size options
 */
export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

/**
 * Widget position in grid (for future drag-drop)
 */
export interface WidgetPosition {
  x: number;
  y: number;
  w: number; // width in grid columns
  h: number; // height in grid rows
}

/**
 * Session stage determines which widgets are relevant
 */
export type SessionStage =
  | 'queue' // Patient in queue, not started
  | 'initial' // Initial consultation
  | 'clinical-review' // Reviewing clinical data
  | 'package-selection' // Discussing packages
  | 'iol-selection' // IOL recommendation
  | 'financial' // Financial counseling
  | 'consent' // Consent signing
  | 'pre-surgery' // Pre-op planning
  | 'scheduling' // Surgery scheduling
  | 'admission' // Admission planning
  | 'followup' // Follow-up session
  | 'post-operative-care' // Post-surgery monitoring
  | 'follow-up-scheduling' // Follow-up appointment scheduling
  | 'outcome-tracking' // Long-term outcome tracking
  | 'completed'; // Session completed

/**
 * Widget category for organization
 */
export type WidgetCategory =
  | 'patient-context' // Patient info widgets
  | 'clinical' // Clinical workflow widgets
  | 'financial' // Payment/insurance widgets
  | 'documentation' // Consent/document widgets
  | 'scheduling' // Calendar/admission widgets
  | 'communication' // Notes/messages widgets
  | 'queue' // Queue management widgets
  | 'post-operative' // Post-surgery care widgets
  | 'education' // Patient education widgets
  | 'monitoring' // Vitals and health monitoring
  | 'imaging' // Medical imaging widgets
  | 'admin' // Administrative widgets
  | 'telemedicine' // Remote consultation widgets
  | 'analytics'; // Analytics and AI-powered widgets

/**
 * Base widget metadata
 */
export interface WidgetMetadata {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: WidgetCategory;
  defaultSize: WidgetSize;
  allowedSizes: WidgetSize[];
  requiredStages?: SessionStage[]; // Widget only appears in these stages
  requiredPermissions?: string[]; // RBAC permissions needed
  isPinnable: boolean; // Can be pinned to always show
  isCloseable: boolean; // Can be closed by user
  isResizable: boolean; // Can be resized
  minWidth?: number; // Minimum width in pixels
  minHeight?: number; // Minimum height in pixels
  /**
   * Phase 2+: mock/legacy coverage widgets kept for gallery demos only.
   * Excluded from production counselor templates and stage pickers.
   */
  galleryOnly?: boolean;
  deprecated?: boolean;
}

/**
 * Widget configuration (combines metadata with runtime state)
 */
export interface WidgetConfig extends WidgetMetadata {
  isVisible: boolean;
  isMinimized: boolean;
  isPinned: boolean;
  currentSize: WidgetSize;
  position?: WidgetPosition;
  order: number; // Display order in grid
}

/**
 * Widget data - generic key-value store for widget-specific data
 */
export interface WidgetData {
  [key: string]: unknown;
}

/**
 * Widget instance - combines config with data and context
 */
export interface WidgetInstance {
  widgetId: string;
  config: WidgetConfig;
  data: WidgetData;
  lastUpdated: Date;
}

/**
 * Widget action - user actions within widgets
 */
export interface WidgetAction {
  type: string;
  payload?: unknown;
  timestamp: Date;
}

/**
 * Widget layout state (persisted to localStorage)
 */
export interface WidgetLayoutState {
  activePatientId?: string;
  activeSessionId?: string;
  currentStage: SessionStage;
  visibleWidgets: string[]; // Array of widget IDs
  widgetConfigs: Record<string, Partial<WidgetConfig>>; // Per-widget overrides
  pinnedWidgets: string[]; // Always visible
  lastUpdated: Date;
}

/**
 * Widget template - pre-configured layouts for different session types
 */
export interface WidgetTemplate {
  id: string;
  name: string;
  description: string;
  stage: SessionStage;
  icon: LucideIcon;
  widgets: Array<{
    widgetId: string;
    size: WidgetSize;
    isPinned: boolean;
    order: number;
  }>;
}

/**
 * Props for widget components
 */
export interface WidgetProps {
  widgetId: string;
  patientId?: string;
  sessionId?: string;
  sessionStage: SessionStage;
  size: WidgetSize;
  isMinimized: boolean;
  data: WidgetData;
  onDataChange: (data: WidgetData) => void;
  onAction: (action: WidgetAction) => void;
  onClose?: () => void;
  onMinimize?: () => void;
  onResize?: (size: WidgetSize) => void;
}

/**
 * Widget component type
 */
export type WidgetComponent = React.ComponentType<WidgetProps>;

/**
 * Widget registry entry
 */
export interface WidgetRegistryEntry {
  metadata: WidgetMetadata;
  component: WidgetComponent;
}

/**
 * Context value for widget system
 */
export interface WidgetContextValue {
  // State
  layoutState: WidgetLayoutState;
  widgets: WidgetInstance[];
  
  // Patient/Session context
  activePatientId?: string;
  activeSessionId?: string;
  currentStage: SessionStage;
  
  // Actions
  addWidget: (widgetId: string, config?: Partial<WidgetConfig>) => void;
  removeWidget: (widgetId: string) => void;
  updateWidget: (widgetId: string, config: Partial<WidgetConfig>) => void;
  updateWidgetData: (widgetId: string, data: Partial<WidgetData>) => void;
  minimizeWidget: (widgetId: string) => void;
  maximizeWidget: (widgetId: string) => void;
  pinWidget: (widgetId: string) => void;
  unpinWidget: (widgetId: string) => void;
  resizeWidget: (widgetId: string, size: WidgetSize) => void;
  
  // Context changes
  setActivePatient: (patientId: string | undefined) => void;
  setActiveSession: (sessionId: string | undefined) => void;
  setCurrentStage: (stage: SessionStage) => void;
  
  // Templates
  applyTemplate: (templateId: string) => void;
  resetLayout: () => void;
  
  // Persistence
  saveLayout: () => void;
  loadLayout: () => void;
}

/**
 * Size configurations for responsive grid
 */
export const WIDGET_SIZE_CONFIG: Record<WidgetSize, { cols: number; rows: number }> = {
  small: { cols: 1, rows: 1 },
  medium: { cols: 2, rows: 1 },
  large: { cols: 2, rows: 2 },
  full: { cols: 4, rows: 2 },
};

/**
 * Breakpoints for responsive grid
 */
export const GRID_BREAKPOINTS = {
  mobile: 640, // 1 column
  tablet: 768, // 2 columns
  desktop: 1024, // 3 columns
  wide: 1920, // 4 columns
} as const;
