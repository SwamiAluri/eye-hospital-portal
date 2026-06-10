'use client';

import { useEffect } from 'react';

/** Prevents page-level scroll on auth routes so the shell fits exactly one viewport. */
export function AuthBodyLock() {
  useEffect(() => {
    document.documentElement.classList.add('auth-oc-root');
    document.body.classList.add('auth-oc-root');
    return () => {
      document.documentElement.classList.remove('auth-oc-root');
      document.body.classList.remove('auth-oc-root');
    };
  }, []);
  return null;
}
