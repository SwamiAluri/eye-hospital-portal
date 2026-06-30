'use client';

import React, { useState, useEffect } from 'react';
import { Users, ChevronDown, ChevronUp, UserCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchCareTeam, type CareTeamMember } from '@/lib/patients/build-care-team';

interface CareTeamPanelProps {
  patientId: string;
}

export const CareTeamPanel: React.FC<CareTeamPanelProps> = ({ patientId }) => {
  const [providers, setProviders] = useState<CareTeamMember[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchCareTeam(patientId)
      .then((rows) => {
        if (!cancelled) setProviders(rows);
      })
      .catch(() => {
        if (!cancelled) setProviders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.map((p) => p[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil(
      Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays <= 1) return 'Today';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <Card className="p-4">
        <div className="h-24 bg-gray-50 rounded-lg animate-pulse" />
      </Card>
    );
  }

  const visibleProviders = expanded ? providers : providers.slice(0, 4);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-gray-900">Care Team</h3>
          <Badge variant="secondary">{providers.length}</Badge>
        </div>
        {providers.length > 4 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-indigo-600"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" /> Show all
              </>
            )}
          </Button>
        )}
      </div>

      {providers.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">
          No care team members found from visits, exams, or prescriptions.
        </p>
      ) : (
        <div className="space-y-3">
          {visibleProviders.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm">
                {getInitials(provider.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 truncate">{provider.name}</p>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {provider.role}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 truncate">{provider.specialty}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Last seen {formatDate(provider.lastInteraction)} ·{' '}
                  {provider.interactionCount} interaction
                  {provider.interactionCount === 1 ? '' : 's'}
                </p>
              </div>
              <UserCircle className="w-5 h-5 text-gray-400 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
