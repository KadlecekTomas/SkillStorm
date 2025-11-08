import type { AxiosError } from "axios";
import { API_BASE_URL } from "@/utils/api-client";
import { useAuthStore } from "@/store/use-auth-store";

type ForbiddenPayload = {
  route?: string;
  permissionKey?: string;
  message?: string;
};

const METRIC_ENDPOINT = `${API_BASE_URL}/metrics/rbac`;

export const reportForbiddenAccess = (
  error?: AxiosError | ForbiddenPayload,
) => {
  if (typeof window === "undefined") return;

  const state = useAuthStore.getState();
  const payload = {
    userId: state.user?.id ?? null,
    route:
      (error as AxiosError)?.config?.url ??
      (error as ForbiddenPayload)?.route ??
      "unknown",
    permissionKey: (error as any)?.response?.data?.permissionKey,
    message: (error as AxiosError)?.message,
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
