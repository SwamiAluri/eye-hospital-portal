'use client';

interface AuthDevPanelProps {
  onCreateAdmin: () => void;
  isLoading?: boolean;
  demoCredentials?: string;
}

export function AuthDevPanel({ onCreateAdmin, isLoading, demoCredentials }: AuthDevPanelProps) {
  if (process.env.NODE_ENV === 'production') return null;

  return (
    <details className="auth-dev-panel">
      <summary>Developer tools</summary>
      <div className="auth-dev-panel-body">
        <button
          type="button"
          onClick={onCreateAdmin}
          disabled={isLoading}
          className="auth-dev-btn disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Creating…' : 'Create Admin User (Dev Only)'}
        </button>
        {demoCredentials && (
          <div className="auth-dev-demo">
            <strong>Demo:</strong> {demoCredentials}
          </div>
        )}
      </div>
    </details>
  );
}
