import { toast as hotToast } from 'react-hot-toast';

/**
 * Compatibility wrapper over the canonical react-hot-toast Toaster
 * (mounted in dashboard + admin layouts). Preserves sonner-style
 * info/warning/description without mounting a second provider.
 */
type ToastExtra = {
  description?: string;
  duration?: number;
  id?: string;
  icon?: string;
  /** Accepted for sonner call-site compatibility; not rendered (no second toaster). */
  action?: unknown;
};

function formatMessage(message: string, extra?: ToastExtra): string {
  if (!extra?.description) return message;
  return `${message}\n${extra.description}`;
}

function options(extra?: ToastExtra) {
  if (!extra) return undefined;
  return {
    duration: extra.duration,
    id: extra.id,
    icon: extra.icon,
  };
}

function notify(
  kind: 'default' | 'success' | 'error',
  message: string,
  extra?: ToastExtra,
) {
  const text = formatMessage(message, extra);
  const opts = options(extra);
  if (kind === 'success') return hotToast.success(text, opts);
  if (kind === 'error') return hotToast.error(text, opts);
  return hotToast(text, opts);
}

export const toast = Object.assign(
  (message: string, extra?: ToastExtra) => notify('default', message, extra),
  {
    success: (message: string, extra?: ToastExtra) => notify('success', message, extra),
    error: (message: string, extra?: ToastExtra) => notify('error', message, extra),
    loading: hotToast.loading.bind(hotToast),
    dismiss: hotToast.dismiss.bind(hotToast),
    custom: hotToast.custom.bind(hotToast),
    promise: hotToast.promise.bind(hotToast),
    info: (message: string, extra?: ToastExtra) =>
      notify('default', message, { ...extra, icon: extra?.icon ?? 'ℹ️' }),
    warning: (message: string, extra?: ToastExtra) =>
      notify('default', message, { ...extra, icon: extra?.icon ?? '⚠️' }),
  },
);

export default toast;
