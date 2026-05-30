/** Idle period before the warning modal appears (default 15 min). */
export const IDLE_TIMEOUT_MS =
  (Number(process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES) || 15) * 60 * 1000;

/** Countdown shown in the warning modal before auto sign-out (default 60 sec). */
export const WARNING_MS =
  (Number(process.env.NEXT_PUBLIC_SESSION_WARNING_SECONDS) || 60) * 1000;

export const ACTIVITY_THROTTLE_MS = 1000;

export const LOGOUT_BROADCAST_KEY = 'auth:logout-broadcast';
export const LOGOUT_CHANNEL_NAME = 'hospital-portal-auth';
