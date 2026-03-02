/**
 * Auth intent layer: preserves join/return-to intent across login, register, and 401.
 * Uses sessionStorage so intent survives navigation between auth pages but not new tabs.
 * SSR-safe: all access guarded with typeof window !== "undefined".
 */

export type AuthIntent =
  | { type: "JOIN"; token?: string; code?: string }
  | { type: "RETURN_TO"; path: string }
  | null;

const KEY = "skillstorm_auth_intent";

export function setAuthIntent(intent: AuthIntent): void {
  if (typeof window === "undefined") return;
  try {
    if (intent === null) {
      window.sessionStorage.removeItem(KEY);
      return;
    }
    window.sessionStorage.setItem(KEY, JSON.stringify(intent));
  } catch {
    // sessionStorage full or disabled
  }
}

export function getAuthIntent(): AuthIntent {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && "type" in parsed) {
      const type = (parsed as { type: string }).type;
      if (type === "JOIN") {
        const o = parsed as { type: "JOIN"; token?: string; code?: string };
        return {
          type: "JOIN",
          ...(typeof o.token === "string" ? { token: o.token } : {}),
          ...(typeof o.code === "string" ? { code: o.code } : {}),
        };
      }
      if (type === "RETURN_TO") {
        const o = parsed as { type: "RETURN_TO"; path: string };
        return typeof o.path === "string" && o.path.length > 0
          ? { type: "RETURN_TO", path: o.path }
          : null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function clearAuthIntent(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Current pathname + search (e.g. "/join?token=XYZ").
 * SSR-safe; returns "/" when no window.
 */
export function buildReturnToPath(): string {
  if (typeof window === "undefined") return "/";
  const path = window.location.pathname ?? "/";
  const search = window.location.search ?? "";
  return search ? `${path}${search}` : path;
}

/**
 * Build /join URL from JOIN intent for PostAuthResolver.
 * Only produces relative path with token/code/role params.
 */
export function buildJoinUrlFromIntent(intent: { type: "JOIN"; token?: string; code?: string }): string {
  const base = "/join";
  const params = new URLSearchParams();
  if (intent.token) params.set("token", intent.token);
  if (intent.code) params.set("code", intent.code);
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}
