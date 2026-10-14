'use client';

import React from 'react';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buildCounsellorHandoffHref } from '@/lib/patients/patient-handoff';

interface CounselingTabProps {
  patientId: string;
}

export const CounselingTab: React.FC<CounselingTabProps> = ({ patientId }) => {
  return (
    <div className="text-center py-12">
      <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Counseling Sessions</h3>
      <p className="text-gray-600 mb-4">
        Pre-surgery counseling, package discussions, and consent management
      </p>
      <Badge variant="secondary">Coming Soon - CounselingController Integration</Badge>
      <div className="mt-6">
        <Button variant="outline" asChild>
          <Link href={buildCounsellorHandoffHref(patientId)}>
            Open in Counselor Module
          </Link>
        </Button>
      </div>
    </div>
  );
};
