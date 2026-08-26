import type { ReactNode } from 'react';

/** Shell A/B/C frame from the IP target mockups. */
export function IpTargetFrame({
  children,
  className = '',
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div className={`ip-target ${className}`.trim()} data-testid={testId}>
      <div className="frame">{children}</div>
    </div>
  );
}
