import * as signalR from '@microsoft/signalr';

let sharedConnection: signalR.HubConnection | null = null;
let sharedToken: string | null = null;
let refCount = 0;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

export function isSignalRAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; message?: string };
  return (
    e.name === 'AbortError' ||
    (e.message?.includes('stopped during negotiation') ?? false) ||
    (e.message?.includes('The connection was stopped') ?? false)
  );
}

function buildConnection(token: string): signalR.HubConnection {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5073/api';
  const hubUrl = apiUrl.replace('/api', '/notificationHub');

  return new signalR.HubConnectionBuilder()
    .withUrl(hubUrl, { accessTokenFactory: () => token })
    .withAutomaticReconnect({
      nextRetryDelayInMilliseconds: (retryContext) =>
        Math.min(2000 * Math.pow(2, retryContext.previousRetryCount), 32000),
    })
    .configureLogging(signalR.LogLevel.Warning)
    .build();
}

export function acquireNotificationConnection(token: string): signalR.HubConnection {
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }

  refCount++;

  if (sharedConnection && sharedToken === token) {
    return sharedConnection;
  }

  if (sharedConnection) {
    void sharedConnection.stop();
    sharedConnection = null;
  }

  sharedToken = token;
  sharedConnection = buildConnection(token);
  return sharedConnection;
}

export function releaseNotificationConnection(): void {
  refCount = Math.max(0, refCount - 1);

  if (refCount > 0) return;

  stopTimer = setTimeout(() => {
    if (refCount <= 0 && sharedConnection) {
      void sharedConnection.stop();
      sharedConnection = null;
      sharedToken = null;
    }
    stopTimer = null;
  }, 150);
}

export async function startNotificationConnection(
  connection: signalR.HubConnection,
): Promise<void> {
  if (connection.state === signalR.HubConnectionState.Connected) return;
  if (connection.state === signalR.HubConnectionState.Connecting) return;
  await connection.start();
}
