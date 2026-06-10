// Patient Type Configurations API - Module 3
import { getApi } from '../api';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Patient Type Configuration from backend
 */
export interface PatientTypeConfig {
  id: string;
  patientType: string; // Cash, Insurance, CoPay, ESH, CGHS, Arograshree, SGHS, Camp
  displayName: string;
  description: string;
  configuration: PatientTypeConfigData;
  isActive: boolean;
  displayOrder: number;
}

/**
 * Configuration data structure (parsed from JSON)
 */
export interface PatientTypeConfigData {
  requiresAdvancePayment: boolean;
  advancePercentage: number;
  requiredDocuments: string[];
  zeroAdvancePayment?: boolean;
  requiresPreApproval?: boolean;
  allowedIolTypes?: string[];
  paymentNotes?: string;
  icon?: string; // Icon name for UI display
  color?: string; // Color scheme for UI display
  category?: 'direct' | 'government' | 'special' | string;
}

// ============================================================================
// API Functions
// ============================================================================

export const patientTypeConfigsApi = {
  /**
   * Get all active patient type configurations
   */
  getAll: async (): Promise<PatientTypeConfig[]> => {
    console.log('🔵 Fetching Patient Type Configurations');
    
    const response = await getApi().get<PatientTypeConfig[]>('/patient-type-configurations');
    
    console.log('✅ Patient Type Configs Response:', {
      status: response.status,
      count: response.data.length,
      types: response.data.map(c => c.patientType),
      configs: response.data
    });
    
    return response.data;
  },

  /**
   * Get configuration for a specific patient type
   */
  getByType: async (patientType: string): Promise<PatientTypeConfig> => {
    console.log('🔵 Fetching Patient Type Config:', patientType);
    
    const response = await getApi().get<PatientTypeConfig>(
      `/patient-type-configurations/${patientType}`
    );
    
    console.log('✅ Patient Type Config Response:', {
      status: response.status,
      patientType: response.data.patientType,
      displayName: response.data.displayName,
      config: response.data
    });
    
    return response.data;
  },

  /**
   * Validate a patient type name
   */
  validate: async (patientType: string): Promise<{ isValid: boolean; message?: string }> => {
    console.log('🔵 Validating Patient Type:', patientType);
    
    const response = await getApi().get<{ isValid: boolean; message?: string }>(
      `/patient-type-configurations/validate/${patientType}`
    );
    
    console.log('✅ Patient Type Validation Response:', {
      status: response.status,
      isValid: response.data.isValid,
      message: response.data.message
    });
    
    return response.data;
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get icon name for patient type (for UI display)
 */
export const getPatientTypeIcon = (patientType: string): string => {
  const iconMap: Record<string, string> = {
    'Cash': 'Wallet',
    'Insurance': 'Shield',
    'CoPay': 'Split',
    'ESH': 'Building',
    'CGHS': 'Flag',
    'Arograshree': 'Leaf',
    'SGHS': 'Award',
    'Camp': 'Users'
  };
  return iconMap[patientType] || 'HelpCircle';
};

/**
 * Get color scheme for patient type (for UI display)
 */
export const getPatientTypeColor = (patientType: string): string => {
  const colorMap: Record<string, string> = {
    'Cash': 'green',
    'Insurance': 'blue',
    'CoPay': 'purple',
    'ESH': 'orange',
    'CGHS': 'red',
    'Arograshree': 'teal',
    'SGHS': 'yellow',
    'Camp': 'pink'
  };
  return colorMap[patientType] || 'gray';
};
