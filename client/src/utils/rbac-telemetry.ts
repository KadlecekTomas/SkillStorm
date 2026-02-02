import { API_BASE_PATH } from "@/utils/env";
import { useAuthStore } from "@/store/use-auth-store";
import type { PermissionKey } from "@/types";

type ForbiddenPayload = {
  route?: string;
  permissionKey?: PermissionKey | string;
  message?: string;
};

const METRIC_ENDPOINT = `${API_BASE_PATH}/metrics/rbac`;

export const reportForbiddenAccess = (error?: ForbiddenPayload | Error): void => {
  if (typeof window === "undefined") return;

  const state = useAuthStore.getState();

  const payload = {
    userId: state.user?.id ?? null,
    route:
      (error && "route" in (error as ForbiddenPayload)
        ? (error as ForbiddenPayload).route
        : undefined) ??
      window.location.pathname ??
      "unknown",
    permissionKey:
      (error && "permissionKey" in (error as ForbiddenPayload)
        ? (error as ForbiddenPayload).permissionKey
        : undefined) ?? null,
    message:
      (error && "message" in (error as ForbiddenPayload)
        ? (error as ForbiddenPayload).message
        : undefined) ?? (error instanceof Error ? error.message : null),
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
