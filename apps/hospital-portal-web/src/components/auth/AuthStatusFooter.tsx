export function AuthStatusFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="auth-status-footer animate-fade-up">
      <div className="auth-status-footer-inner">
        <div className="auth-status-footer-statuses">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
            DB Synced
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
            PACS Online
          </span>
        </div>
        <div className="auth-status-footer-links">
          <span className="hover:text-oc-primary transition-colors cursor-pointer">Privacy</span>
          <span className="hover:text-oc-primary transition-colors cursor-pointer">Terms</span>
          <span className="opacity-40 auth-footer-copy">© {year} OphthalmoCare</span>
        </div>
      </div>
    </footer>
  );
}
