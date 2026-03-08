import {
  API_BASE_PATH,
  ENABLE_RBAC_TELEMETRY_CLIENT,
} from "@/utils/env";
import { useAuthStore } from "@/store/use-auth-store";
import type { PermissionKey } from "@/types";

type ForbiddenPayload = {
  route?: string;
  permissionKey?: PermissionKey | string;
  message?: string;
};

const METRIC_ENDPOINT = `${API_BASE_PATH}/metrics/rbac`;

const readCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split("=").slice(1).join("="));
};

export const reportForbiddenAccess = (error?: ForbiddenPayload | Error): void => {
  if (typeof window === "undefined") return;
  if (!ENABLE_RBAC_TELEMETRY_CLIENT) return;

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
  const csrfToken = readCookie("ss_csrf");

  if (!csrfToken) return;

  try {
    fetch(METRIC_ENDPOINT, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      keepalive: true,
      credentials: "include",
    }).catch(() => undefined);
  } catch {
    // Swallow telemetry errors
  }
};
