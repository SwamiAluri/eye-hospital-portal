/**
 * Dev-only escape hatch for an empty JWT permission claim.
 *
 * Permission helpers fail closed: an empty claim grants nothing. That is correct
 * in production but blocks local work against a token minted before the IP and
 * billing codes were seeded (migration 156). Setting
 * `NEXT_PUBLIC_PERMISSIONS_FAIL_OPEN=true` restores the old permissive
 * behaviour, and is ignored outside development so it cannot ship enabled.
 *
 * The flag only ever affects the *empty claim* case. A user who holds a
 * non-empty claim is always evaluated against it, flag or not.
 */

let warned = false;

export function permissionsFailOpen(): boolean {
  // Referenced literally so Next.js can inline it at build time.
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.NEXT_PUBLIC_PERMISSIONS_FAIL_OPEN !== 'true') return false;

  if (!warned) {
    warned = true;
    console.warn(
      '[SECURITY] NEXT_PUBLIC_PERMISSIONS_FAIL_OPEN is enabled. Users with an empty '
      + 'permission claim are being granted operational access. This flag is ignored in '
      + 'production builds and must never be set in a deployed environment.',
    );
  }
  return true;
}

/** Test seam: allows asserting the warning fires exactly once. */
export function __resetFailOpenWarningForTests(): void {
  warned = false;
}
