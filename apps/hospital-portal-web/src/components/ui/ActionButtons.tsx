import React from 'react';

interface ActionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const EditButton: React.FC<ActionButtonProps> = ({ onClick, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="text-emerald-600 hover:text-emerald-800 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    {children || 'Edit'}
  </button>
);

export const ViewButton: React.FC<ActionButtonProps> = ({ onClick, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="text-gray-600 hover:text-gray-800 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    {children || 'View'}
  </button>
);

export const PermissionsButton: React.FC<ActionButtonProps> = ({ onClick, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="text-indigo-600 hover:text-indigo-800 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    {children || 'Permissions'}
  </button>
);

export const CloneButton: React.FC<ActionButtonProps> = ({ onClick, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="text-purple-600 hover:text-purple-800 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    {children || 'Clone'}
  </button>
);

export const DeleteButton: React.FC<ActionButtonProps> = ({ onClick, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="text-red-600 hover:text-red-800 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    {children || 'Delete'}
  </button>
);

export const ActivateButton: React.FC<ActionButtonProps> = ({ onClick, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="text-green-600 hover:text-green-800 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    {children || 'Activate'}
  </button>
);

export const DeactivateButton: React.FC<ActionButtonProps> = ({ onClick, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="text-orange-600 hover:text-orange-800 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    {children || 'Deactivate'}
  </button>
);

interface PrimaryButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  type?: 'button' | 'submit';
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({ 
  onClick, 
  disabled, 
  loading, 
  children,
  type = 'button'
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled || loading}
    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
  >
    {loading ? 'Loading...' : children}
  </button>
);

export const SecondaryButton: React.FC<PrimaryButtonProps> = ({ 
  onClick, 
  disabled, 
  children,
  type = 'button'
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
  >
    {children}
  </button>
);

export const DangerButton: React.FC<PrimaryButtonProps> = ({ 
  onClick, 
  disabled, 
  loading,
  children,
  type = 'button'
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled || loading}
    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
  >
    {loading ? 'Loading...' : children}
  </button>
);
