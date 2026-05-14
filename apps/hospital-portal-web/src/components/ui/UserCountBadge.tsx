import React from 'react';

interface UserCountBadgeProps {
  count: number;
  onClick?: () => void;
}

export const UserCountBadge: React.FC<UserCountBadgeProps> = ({ count, onClick }) => {
  if (count === 0) {
    return <span className="text-gray-400 text-sm">0 users</span>;
  }

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer border border-emerald-200"
    >
      {count} user{count !== 1 ? 's' : ''}
      {onClick && <span className="ml-1">▸</span>}
    </button>
  );
};
