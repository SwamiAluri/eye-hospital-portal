'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Star, ThumbsUp, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBranchContext } from '@/hooks/use-branch-context';
import { patientLookupApi } from '@/lib/api/patient-lookup.api';
import { getPatientFeedback } from '@/lib/api/widgets.api';

interface EngagementWidgetProps {
  patientId: string;
  onViewEngagement?: () => void;
}

export const EngagementWidget: React.FC<EngagementWidgetProps> = ({
  patientId,
  onViewEngagement,
}) => {
  const { branchId } = useBranchContext();
  const [feedbackScore, setFeedbackScore] = useState<number | null>(null);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [activeEngagements, setActiveEngagements] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const tasks: Promise<void>[] = [
      getPatientFeedback(patientId)
        .then((rows) => {
          if (cancelled) return;
          setFeedbackCount(rows.length);
          if (rows.length === 0) {
            setFeedbackScore(null);
            return;
          }
          const avg =
            rows.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rows.length;
          setFeedbackScore(Math.round(avg * 10) / 10);
        })
        .catch(() => {
          if (!cancelled) {
            setFeedbackCount(0);
            setFeedbackScore(null);
          }
        }),
    ];

    if (branchId) {
      tasks.push(
        patientLookupApi
          .getSummary(patientId, branchId)
          .then((summary) => {
            if (!cancelled) {
              setActiveEngagements(summary.activeEngagements?.length ?? 0);
            }
          })
          .catch(() => {
            if (!cancelled) setActiveEngagements(0);
          }),
      );
    }

    void Promise.all(tasks).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [patientId, branchId]);

  const statusLabel = useMemo(() => {
    if (activeEngagements > 0) return 'Active';
    if (feedbackCount > 0) return 'Feedback on file';
    return 'No recent activity';
  }, [activeEngagements, feedbackCount]);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-600" />
            Patient Engagement
          </span>
          <Badge variant="secondary">{statusLabel}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="h-24 bg-gray-50 rounded-lg animate-pulse" />
        ) : (
          <>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-yellow-900">
                  Satisfaction Score
                </span>
                <ThumbsUp className="w-5 h-5 text-yellow-600" />
              </div>
              {feedbackScore != null ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold text-yellow-900">{feedbackScore}</p>
                    <p className="text-sm text-yellow-700">/ 5.0</p>
                  </div>
                  <p className="text-xs text-yellow-700 mt-1">
                    Based on {feedbackCount} review{feedbackCount === 1 ? '' : 's'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-yellow-800">No feedback recorded yet</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                <Activity className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-gray-900">{activeEngagements}</p>
                <p className="text-xs text-gray-600">Active workflows</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <p className="text-lg font-bold text-gray-900">{feedbackCount}</p>
                <p className="text-xs text-gray-600">Feedback entries</p>
              </div>
            </div>
          </>
        )}

        {onViewEngagement && (
          <Button variant="outline" size="sm" className="w-full" onClick={onViewEngagement}>
            View Engagement History
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
