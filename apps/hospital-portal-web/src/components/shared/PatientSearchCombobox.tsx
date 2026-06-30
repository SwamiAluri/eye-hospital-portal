'use client';

import { useState, useEffect } from 'react';
import { Search, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useBranchContext } from '@/hooks/use-branch-context';
import { type Patient } from '@/lib/api/patients.api';
import {
  searchPatientsUnified,
  unifiedHitToPatient,
} from '@/lib/patients/unified-patient-search';

interface Props {
  value?: Patient | null;
  onChange: (patient: Patient | null) => void;
  placeholder?: string;
  className?: string;
}

/**
 * PatientSearchCombobox - Searchable dropdown for patient selection
 * 
 * Features:
 * - Debounced search (300ms)
 * - Shows MR Number, Name, Phone, Age
 * - Async patient lookup via API
 * - Loading states
 * - Error handling
 */
export function PatientSearchCombobox({ 
  value, 
  onChange, 
  placeholder = 'Search patients by name, MR number, or phone...',
  className = '' 
}: Props) {
  const { branchId } = useBranchContext();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced patient search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setFilteredPatients([]);
      return;
    }

    setIsSearching(true);
    
    const timer = setTimeout(async () => {
      try {
        if (!branchId) {
          setFilteredPatients([]);
          return;
        }
        const hits = await searchPatientsUnified(branchId, searchQuery, 10);
        setFilteredPatients(hits.map(unifiedHitToPatient));
      } catch (error) {
        console.error('Failed to search patients:', error);
        toast.error('Failed to search patients');
        setFilteredPatients([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, branchId]);

  const handleSelect = (patient: Patient) => {
    onChange(patient);
    setOpen(false);
    setSearchQuery('');
  };

  const handleClear = () => {
    onChange(null);
    setSearchQuery('');
  };

  const calculateAge = (dateOfBirth?: string) => {
    if (!dateOfBirth) return '';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age}y`;
  };

  // Display value in input when patient is selected
  const displayValue = value 
    ? `${value.firstName} ${value.lastName} - MRN: ${value.medicalRecordNumber || value.patientCode || 'N/A'}`
    : searchQuery;

  return (
    <div className={`${className} relative`}>
      {/* Search Input with Selected Patient Display */}
      <div className="relative">
        {!value && (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10 pointer-events-none" />
        )}
        <Input
          value={displayValue}
          onChange={(e) => {
            // If patient was selected, clear it when user types
            if (value) {
              onChange(null);
            }
            const newValue = e.target.value;
            setSearchQuery(newValue);
            if (newValue.length >= 2) {
              setOpen(true);
            } else {
              setOpen(false);
              setFilteredPatients([]);
            }
          }}
          onFocus={() => {
            if (!value && searchQuery.length >= 2 && filteredPatients.length > 0) {
              setOpen(true);
            }
          }}
          placeholder={placeholder}
          className={`${!value ? 'pl-10' : 'pl-3'} pr-10 ${value ? 'bg-blue-50 border-blue-300 font-medium text-sm' : ''}`}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          readOnly={!!value}
        />
        
        {/* Clear button when patient selected */}
        {value && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full w-6 h-6 flex items-center justify-center transition-colors z-20"
            type="button"
          >
            <span className="text-xl leading-none font-light">×</span>
          </button>
        )}
      </div>
      
      {/* Patient info badges - only show when selected */}
      {value && (
        <div className="flex items-center gap-2 mt-1.5 mb-1">
          <Badge variant="outline" className="text-xs bg-white">
            {value.gender}
          </Badge>
          {value.dateOfBirth && (
            <Badge variant="outline" className="text-xs bg-white">
              {calculateAge(value.dateOfBirth)} old
            </Badge>
          )}
          {(value.contactNumber || value.phone) && (
            <span className="text-xs text-gray-600">
              📞 {value.contactNumber || value.phone}
            </span>
          )}
        </div>
      )}

      {/* Search Results Dropdown - Only show when searching (not when selected) */}
      {open && !value && (
        <div className="absolute left-0 w-full z-[9999] mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl overflow-hidden">
          <div className="max-h-[280px] overflow-y-auto overflow-x-hidden">
            {isSearching ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-600">Searching...</span>
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">
                {searchQuery.length < 2 ? 'Type at least 2 characters' : 'No patients found'}
              </div>
            ) : (
              <>
                <div className="sticky top-0 text-xs font-semibold text-gray-700 px-3 py-2 bg-gray-100 border-b border-gray-200 z-10">
                  {filteredPatients.length} patient(s) found
                </div>
                <div className="divide-y divide-gray-100">
                  {filteredPatients.map((patient) => (
                    <div
                      key={patient.id}
                      onClick={() => handleSelect(patient)}
                      className="flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 mt-0.5">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm truncate">
                            {patient.firstName} {patient.lastName}
                          </span>
                          {patient.dateOfBirth && (
                            <Badge variant="outline" className="text-xs py-0 px-1.5 flex-shrink-0">
                              {calculateAge(patient.dateOfBirth)}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs py-0 px-1.5 flex-shrink-0">
                            {patient.gender}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          <div className="font-medium truncate">
                            MRN: {patient.medicalRecordNumber || patient.patientCode || 'N/A'}
                          </div>
                          {(patient.contactNumber || patient.phone) && (
                            <div className="truncate">📞 {patient.contactNumber || patient.phone}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
