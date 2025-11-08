import type { AxiosError } from "axios";
import { API_BASE_URL } from "@/utils/env";
import { useAuthStore } from "@/store/use-auth-store";

type ForbiddenPayload = {
  route?: string;
  permissionKey?: string;
  message?: string;
};

const METRIC_ENDPOINT = `${API_BASE_URL}/metrics/rbac`;

const isAxiosError = (error: unknown): error is AxiosError => {
  if (!error || typeof error !== "object") return false;
  return (
    "isAxiosError" in error &&
    Boolean((error as { isAxiosError?: boolean }).isAxiosError)
  );
};

const hasPermissionKey = (
  payload: unknown,
): payload is { permissionKey?: string } => {
  if (!payload || typeof payload !== "object") return false;
  return "permissionKey" in payload;
};

const isForbiddenPayload = (payload: unknown): payload is ForbiddenPayload => {
  if (!payload || typeof payload !== "object") return false;
  return true;
};

export const reportForbiddenAccess = (
  error?: AxiosError | ForbiddenPayload,
) => {
  if (typeof window === "undefined") return;

  const state = useAuthStore.getState();
  const axiosError = isAxiosError(error) ? error : undefined;
  const forbiddenPayload =
    !axiosError && isForbiddenPayload(error) ? error : undefined;

  const payload = {
    userId: state.user?.id ?? null,
    route: axiosError?.config?.url ?? forbiddenPayload?.route ?? "unknown",
    permissionKey: axiosError
      ? (() => {
          const data = axiosError.response?.data;
          return hasPermissionKey(data) ? data.permissionKey : undefined;
        })()
      : forbiddenPayload?.permissionKey,
    message: axiosError?.message ?? forbiddenPayload?.message,
  };

  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(METRIC_ENDPOINT, blob);
    } else {
      fetch(METRIC_ENDPOINT, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    // Swallow telemetry errors
  }
};
