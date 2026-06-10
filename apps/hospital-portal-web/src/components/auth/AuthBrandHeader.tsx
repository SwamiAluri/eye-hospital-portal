'use client';

import Image from 'next/image';
import { OPHTHALMOCARE_LOGO_PATH } from './auth-constants';
import { useAuthTenantOptional } from './AuthTenantContext';

export function AuthBrandHeader() {
  const tenantCtx = useAuthTenantOptional();
  const tenantName = tenantCtx?.tenantName;

  return (
    <div className="auth-brand-header animate-fade-up shrink-0">
      <Image
        alt=""
        src={OPHTHALMOCARE_LOGO_PATH}
        width={48}
        height={48}
        priority
        className="auth-brand-logo object-contain shrink-0"
      />
      <div className="auth-brand-copy min-w-0">
        <h1 className="auth-brand-title">OphthalmoCare</h1>
        {tenantName && <p className="auth-brand-tenant truncate">{tenantName}</p>}
      </div>
    </div>
  );
}
