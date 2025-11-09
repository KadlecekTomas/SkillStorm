import { toast, type ToastOptions } from "react-toastify";

const activeToasts = new Set<string>();

export function showToastOnce(message: string, options?: ToastOptions) {
  if (activeToasts.has(message)) return;
  const id = toast(message, {
    ...options,
    onClose: (...args) => {
      activeToasts.delete(message);
      if (options?.onClose) {
        (options.onClose as (...p: unknown[]) => void)(...args);
      }
    },
  });
  activeToasts.add(message);
  return id;
}
