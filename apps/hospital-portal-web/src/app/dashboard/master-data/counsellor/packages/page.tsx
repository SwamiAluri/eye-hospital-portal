'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { CounsellingPackagesAdmin } from '@/components/master-data/CounsellingPackagesAdmin';

export default function CounsellingPackagesPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <nav className="text-sm">
        <Link
          href="/dashboard/master-data"
          className="inline-flex items-center gap-1 text-gray-500 hover:text-teal-600"
        >
          <ChevronLeft size={16} />
          Master Data
        </Link>
        <span className="text-gray-400 mx-2">/</span>
        <span className="text-gray-700">Counsellor packages</span>
      </nav>

      <CounsellingPackagesAdmin />
    </div>
  );
}
