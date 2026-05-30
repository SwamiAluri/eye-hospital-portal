import { useAuthStore } from './auth-store';
import { redirectToLogin } from './token-refresh';
import { LOGOUT_BROADCAST_KEY, LOGOUT_CHANNEL_NAME } from './session-idle-config';

export type LogoutReason = 'idle-timeout' | 'user' | 'session-expired';

export interface LogoutBroadcastMessage {
  type: 'LOGOUT';
  reason: LogoutReason;
  at: number;
}

let logoutInProgress = false;
let channel: BroadcastChannel | null = null;

function messageForReason(reason: LogoutReason): string | null {
  switch (reason) {
    case 'idle-timeout':
      return "You've been signed out due to inactivity. Please sign in again.";
    case 'session-expired':
      return 'Your session has expired. Please sign in again.';
    case 'user':
      return null;
  }
}

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!channel) channel = new BroadcastChannel(LOGOUT_CHANNEL_NAME);
  return channel;
}

export function broadcastLogout(reason: LogoutReason): void {
  if (typeof window === 'undefined') return;

  const payload: LogoutBroadcastMessage = { type: 'LOGOUT', reason, at: Date.now() };

  getChannel()?.postMessage(payload);

  try {
    localStorage.setItem(LOGOUT_BROADCAST_KEY, JSON.stringify(payload));
    localStorage.removeItem(LOGOUT_BROADCAST_KEY);
  } catch {
    /* storage full or private mode */
  }
}

/**
 * Sign out this tab and notify all other tabs to sign out too.
 * Pass `broadcast: false` when handling a broadcast from another tab.
 */
export async function logoutEverywhere(
  reason: LogoutReason,
  options?: { broadcast?: boolean },
): Promise<void> {
  if (logoutInProgress) return;
  logoutInProgress = true;

  const shouldBroadcast = options?.broadcast !== false;
  if (shouldBroadcast) broadcastLogout(reason);

  try {
    await useAuthStore.getState().logout();
  } finally {
    const msg = messageForReason(reason);
    if (msg) redirectToLogin(msg);
    else if (typeof window !== 'undefined') window.location.href = '/auth/login';
    logoutInProgress = false;
  }
}

export function subscribeLogoutBroadcast(
  handler: (reason: LogoutReason) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onMessage = (reason: LogoutReason) => handler(reason);

  const bc = getChannel();
  const onBc = (event: MessageEvent<LogoutBroadcastMessage>) => {
    if (event.data?.type === 'LOGOUT') onMessage(event.data.reason);
  };
  bc?.addEventListener('message', onBc);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== LOGOUT_BROADCAST_KEY || !event.newValue) return;
    try {
      const data = JSON.parse(event.newValue) as LogoutBroadcastMessage;
      if (data.type === 'LOGOUT') onMessage(data.reason);
    } catch {
      /* ignore */
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    bc?.removeEventListener('message', onBc);
    window.removeEventListener('storage', onStorage);
  };
}
