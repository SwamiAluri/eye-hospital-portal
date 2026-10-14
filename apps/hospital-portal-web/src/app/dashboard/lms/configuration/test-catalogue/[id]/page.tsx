'use client';

import { CatalogueDetailView } from '@/components/lms/catalogue/CatalogueDetailView';

export default function Page({ params }: { params: { id: string } }) {
  return <CatalogueDetailView itemId={params.id} />;
}
