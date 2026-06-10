'use client';

import { createContext, useContext, type ReactNode } from 'react';
import {
  useCounsellingSessionController,
  type CounsellingSessionController,
  type UseCounsellingSessionControllerParams,
} from '@/hooks/use-counselling-session-controller';

const CounsellingSessionContext = createContext<CounsellingSessionController | null>(null);

export function CounsellingSessionProvider({
  children,
  ...params
}: UseCounsellingSessionControllerParams & { children: ReactNode }) {
  const value = useCounsellingSessionController(params);
  return (
    <CounsellingSessionContext.Provider value={value}>{children}</CounsellingSessionContext.Provider>
  );
}

export function useCounsellingSession(): CounsellingSessionController {
  const ctx = useContext(CounsellingSessionContext);
  if (!ctx) {
    throw new Error('useCounsellingSession must be used within CounsellingSessionProvider');
  }
  return ctx;
}
