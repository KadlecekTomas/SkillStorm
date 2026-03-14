"use client";

import { API_BASE_PATH, AUTH_DEBUG } from "@/utils/env";
import { useAuthStore, type OrganizationContext } from "@/store/use-auth-store";
import { setAuthIntent, buildReturnToPath } from "@/lib/auth-intent";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: string; meta?: unknown };

export type RequestConfig<TBody = unknown> = {
  headers?: Record<string, string>;
  body?: TBody;
  signal?: AbortSignal;
  retries?: number | null;
  query?: Record<string, string | number | boolean | undefined>;
  skipAuthRetry?: boolean;
  /** e.g. 'no-store' for hard refresh (superadmin platform). */
  cache?: RequestCache;
};

type InternalRequestConfig<TBody> = RequestConfig<TBody> & {
  authAttempt?: number;
};

export class HttpError extends Error {
  public readonly status: number;
  public readonly data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = "HttpError";
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Nedostatečná oprávnění", data?: unknown) {
    super(message, 403, data);
    this.name = "ForbiddenError";
  }
}

const extractErrorMessage = (data: unknown, fallback: string): string => {
  const normalizeMessageValue = (value: unknown): string | null => {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
    if (Array.isArray(value)) {
      const messages = value.filter((item): item is string => typeof item === "string" && item.length > 0);
      if (messages.length > 0) {
        return messages.join("\n");
      }
    }
    return null;
  };

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const message = normalizeMessageValue(record.message);
    if (message) {
      return message;
    }
    const error = normalizeMessageValue(record.error);
    if (error) {
      return error;
    }
  }
  return fallback;
};

const LOGIN_REDIRECT = "/login?reason=expired";
const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];
const isPublicRoutePath = (path: string) =>
  PUBLIC_ROUTES.includes(path) || path.startsWith("/reset-password/");

const DEFAULT_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
};

type PersistedAuthState = {
  org?: OrganizationContext | null;
};

const readPersistedAuthState = (): PersistedAuthState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("skillstorm_auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: PersistedAuthState };
    return parsed.state ?? null;
  } catch {
    return null;
  }
};

const readCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split("=").slice(1).join("="));
};

export const createCorrelationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
};

const resolveUrl = (path: string): string => {
  if (/^https?:\/\//i.test(path)) return path;
  const sanitizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = sanitizedPath.startsWith(API_BASE_PATH) ? "" : API_BASE_PATH;
  return `${base}${sanitizedPath}`;
};

const applyQuery = (
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string => {
  if (!query || !Object.keys(query).length) return path;

  const isAbsolute = /^https?:\/\//i.test(path);
  const base = isAbsolute
    ? path
    : `https://dummy.base${path.startsWith("/") ? "" : "/"}${path}`;

  const url = new URL(base);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) return;
    url.searchParams.set(key, String(value));
  });

  if (isAbsolute) return url.toString();
  return `${url.pathname}${url.search}`;
};

const waitWithSignal = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (ms <= 0) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      const reason =
        (signal?.reason as Error | undefined)?.message ?? "Aborted by signal";
      reject(new Error(reason));
    };

    const cleanup = () => {
      if (signal) signal.removeEventListener("abort", onAbort);
      clearTimeout(timer);
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
    }
  });

class RateLimiter {
  private active = 0;

  constructor(
    private readonly maxConcurrent = 5,
    private readonly baseDelay = 40,
  ) { }

  async acquire(signal?: AbortSignal): Promise<void> {
    let attempt = 0;
    while (this.active >= this.maxConcurrent) {
      const backoff = Math.min(500, this.baseDelay * 2 ** attempt);
      await waitWithSignal(backoff, signal);
      attempt += 1;
    }
    this.active += 1;
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
  }
}

const limiter = new RateLimiter();
let refreshPromise: Promise<void> | null = null;

const normalizePath = (path: string): string => {
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      return url.pathname ?? path;
    } catch {
      return path;
    }
  }
  return path.startsWith("/") ? path : `/${path}`;
};

const isOnPublicRoute = (): boolean => {
  if (typeof window === "undefined") return false;
  return isPublicRoutePath(window.location.pathname);
};

const shouldAllowProfileRetry = (path: string): boolean => {
  const normalized = normalizePath(path).replace(/\/+$/, "");
  return normalized.endsWith("/me");
};

const shouldBypassAuthRetry = (path: string): boolean => {
  const normalized = normalizePath(path).replace(/\/+$/, "");
  return (
    normalized === "/auth/login" ||
    normalized === "/auth/register" ||
    normalized === "/auth/logout" ||
    normalized === "/auth/refresh"
  );
};

const logoutAndRedirect = (): void => {
  // Clear local state first (avoid UI thinking it is still authed)
  useAuthStore.getState().logout();

  if (typeof window !== "undefined") {
    const currentPath = window.location.pathname;
    // ⛔ Do not store RETURN_TO or redirect if already on login/register (prevent loop)
    if (currentPath === "/login" || currentPath === "/register") {
      return;
    }

    // Preserve current path so PostAuthResolver can return user after re-login (fixes 401 "black hole")
    const path = buildReturnToPath();
    setAuthIntent({ type: "RETURN_TO", path });

    const target = LOGIN_REDIRECT;
    window.location.replace(target);
  }
};

const buildHeaders = (configHeaders?: Record<string, string>): Record<string, string> => {
  const state = useAuthStore.getState();
  const persisted = !state.org ? readPersistedAuthState() : null;

  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    ...configHeaders,
    "x-cid": createCorrelationId(),
  };

  const orgId =
    state.org?.id ?? persisted?.org?.id ?? state.user?.organizationId ?? null;
  if (orgId) {
    headers["x-org-id"] = orgId;
  }

  if (typeof document !== "undefined") {
    const csrf = readCookie("ss_csrf");
    if (csrf) {
      headers["x-csrf-token"] = csrf;
    }
  }

  return headers;
};

const performFetch = async (
  method: HttpMethod,
  path: string,
  config: InternalRequestConfig<unknown> = {},
): Promise<Response> => {
  const controller = new AbortController();
  if (config.signal) {
    config.signal.addEventListener(
      "abort",
      () => controller.abort(config.signal?.reason),
      { once: true },
    );
  }

  await limiter.acquire(controller.signal);

  const cache =
    config.cache !== undefined
      ? config.cache
      : method === "GET"
        ? "no-cache"
        : undefined;
  const init: RequestInit = {
    method,
    headers: buildHeaders(config.headers),
    credentials: "include",
    mode: "cors",
    signal: controller.signal,
    ...(cache !== undefined && { cache }),
  };

  if (config.body !== undefined) {
    if (
      typeof config.body === "string" ||
      config.body instanceof FormData
    ) {
      init.body = config.body;
    } else {
      init.body = JSON.stringify(config.body);
    }
  }


  const url = resolveUrl(applyQuery(path, config.query));

  try {
    return await fetch(url, init);
  } finally {
    limiter.release();
  }
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
};

const refreshSession = async (): Promise<void> => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const response = await performFetch("POST", "/auth/refresh", { authAttempt: 1 });

    // Do not recurse refresh through handleUnauthorized
    if (!response.ok) {
      const data = await parseResponse<unknown>(response).catch(() => null);
      throw new HttpError("Refresh failed", response.status, data);
    }

    // Backend might return 204 or JSON; ignore body
    await parseResponse<unknown>(response).catch(() => null);
  })();

  try {
    await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

const handleUnauthorized = async <TResponse, TBody>(
  method: HttpMethod,
  path: string,
  config: InternalRequestConfig<TBody>,
): Promise<TResponse> => {
  if (isOnPublicRoute()) {
    throw new HttpError("Unauthorized", 401, null);
  }
  const attempt = config.authAttempt ?? 0;
  const maxAttempts = shouldAllowProfileRetry(path) ? 2 : 1;

  if (attempt >= maxAttempts) {
    logoutAndRedirect();
    throw new HttpError("Session expired", 401, null);
  }

  try {
    await refreshSession();
  } catch {
    logoutAndRedirect();
    throw new HttpError("Session expired", 401, null);
  }

  return request<TResponse, TBody>(method, path, {
    ...config,
    authAttempt: attempt + 1,
  });
};

export const request = async <TResponse = unknown, TBody = unknown>(
  method: HttpMethod,
  path: string,
  config: InternalRequestConfig<TBody> = {},
): Promise<TResponse> => {
  const response = await performFetch(method, path, config);

  if (AUTH_DEBUG) {
    const normalized = normalizePath(path);
    if (normalized.startsWith("/auth/login") || normalized.startsWith("/auth/me")) {
      console.log(
        "%c[AUTH][HTTP]",
        "color:#16a34a;font-weight:600",
        normalized,
        response.status,
      );
    }
  }

  if (response.status === 401) {
    if (config.skipAuthRetry) {
      const data = await parseResponse<unknown>(response);
      throw new HttpError(
        extractErrorMessage(data, "Unauthorized"),
        response.status,
        data,
      );
    }
    if (shouldBypassAuthRetry(path)) {
      const data = await parseResponse<unknown>(response);
      throw new HttpError(
        extractErrorMessage(data, "Unauthorized"),
        response.status,
        data,
      );
    }
    return handleUnauthorized<TResponse, TBody>(method, path, config);
  }

  if (response.status === 403) {
    const data = await parseResponse<unknown>(response);
    throw new ForbiddenError(
      extractErrorMessage(data, "Nedostatečná oprávnění"),
      data,
    );
  }

  if (!response.ok) {
    const data = await parseResponse<unknown>(response);
    throw new HttpError(
      extractErrorMessage(data, "HTTP error"),
      response.status,
      data,
    );
  }

  // Your API typically responds with ApiEnvelope<T>.
  // But some endpoints may return raw T; support both.
  const parsed = await parseResponse<ApiEnvelope<TResponse> | TResponse>(response);

  if (parsed && typeof parsed === "object" && "success" in (parsed as Record<string, unknown>)) {
    const envelope = parsed as ApiEnvelope<TResponse>;
    if (envelope.success === false) {
      throw new HttpError(envelope.error ?? "API error", response.status, envelope.meta);
    }
    return (envelope as { success: true; data: TResponse }).data;
  }

  return parsed as TResponse;
};

const withBody = <TBody>(
  config: RequestConfig<TBody> | undefined,
  body: TBody | undefined,
): InternalRequestConfig<TBody> => {
  if (body === undefined) {
    return { ...(config ?? {}) };
  }
  return { ...(config ?? {}), body };
};


export const httpClient = {
  request,

  get<TResponse>(
    path: string,
    config?: RequestConfig,
  ): Promise<TResponse> {
    return request<TResponse>("GET", path, config);
  },

  post<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    config?: RequestConfig<TBody>,
  ): Promise<TResponse> {
    return request<TResponse, TBody>(
      "POST",
      path,
      withBody(config, body),
    );
  },

  put<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    config?: RequestConfig<TBody>,
  ): Promise<TResponse> {
    return request<TResponse, TBody>(
      "PUT",
      path,
      withBody(config, body),
    );
  },

  patch<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    config?: RequestConfig<TBody>,
  ): Promise<TResponse> {
    return request<TResponse, TBody>(
      "PATCH",
      path,
      withBody(config, body),
    );
  },

  delete<TResponse>(
    path: string,
    config?: RequestConfig,
  ): Promise<TResponse> {
    return request<TResponse>("DELETE", path, config);
  },
};


export async function fetchWithAuth<T>(
  method: string,
  url: string,
  options?: {
    body?: unknown;
    signal?: AbortSignal;
  } & RequestConfig<unknown>,
): Promise<T> {
  return request<T, unknown>(method as HttpMethod, url, options);
}
