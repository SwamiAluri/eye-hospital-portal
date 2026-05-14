import React from 'react';

interface SearchFilterProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  filters?: {
    label: string;
    value: string;
    options: { label: string; value: string }[];
    onChange: (value: string) => void;
  }[];
  onClearFilters?: () => void;
  className?: string;
}

export function SearchFilter({
  searchTerm,
  onSearchChange,
  placeholder = 'Search...',
  filters = [],
  onClearFilters,
  className = '',
}: SearchFilterProps) {
  const hasActiveFilters = searchTerm || filters.some((f) => f.value);

  return (
    <div className={`flex flex-col gap-4 md:flex-row md:items-center ${className}`}>
      {/* Search Input */}
      <div className="flex-1">
        <div className="relative">
          <input
            type="text"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-2 pl-10 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <svg
            className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Filter Dropdowns */}
      {filters.map((filter, index) => (
        <div key={index} className="min-w-[180px]">
          <select
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          >
            <option value="">{filter.label}</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {/* Clear Filters Button */}
      {hasActiveFilters && onClearFilters && (
        <button
          onClick={onClearFilters}
          className="whitespace-nowrap rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}
