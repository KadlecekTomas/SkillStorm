"use client";

import { API_BASE_URL } from "@/utils/env";
import { useAuthStore, type OrganizationContext } from "@/store/use-auth-store";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; error: string; meta?: any };

export type RequestConfig<TBody = unknown> = {
  headers?: Record<string, string>;
  body?: TBody;
  signal?: AbortSignal;
  retries?: number | null;
  query?: Record<string, string | number | boolean | undefined>;
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
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Nedostatečná oprávnění", data?: unknown) {
    super(message, 403, data);
    this.name = "ForbiddenError";
  }
}

const LOGIN_REDIRECT = "/login?reason=expired";
const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
};

type PersistedAuthState = {
  org?: OrganizationContext | null;
  sessionToken?: string | null;
};

const readPersistedAuthState = (): PersistedAuthState | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem("skillstorm_auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: PersistedAuthState };
    return parsed.state ?? null;
  } catch {
    return null;
  }
};

const readCookie = (name: string) => {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split("=").slice(1).join("="));
};

export const createCorrelationId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
};

const resolveUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const sanitizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${sanitizedPath}`;
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
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      clearTimeout(timer);
    };

    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) {
        onAbort();
      }
    }
  });

class RateLimiter {
  private active = 0;
  constructor(
    private readonly maxConcurrent = 5,
    private readonly baseDelay = 40,
  ) {}

  async acquire(signal?: AbortSignal): Promise<void> {
    let attempt = 0;
    while (this.active >= this.maxConcurrent) {
      const backoff = Math.min(500, this.baseDelay * 2 ** attempt);
      await waitWithSignal(backoff, signal);
      attempt += 1;
    }
    this.active += 1;
  }

  release() {
    this.active = Math.max(0, this.active - 1);
  }
}

const limiter = new RateLimiter();
let refreshPromise: Promise<void> | null = null;

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
  const state = useAuthStore.getState();
  const persisted = !state.sessionToken || !state.org ? readPersistedAuthState() : null;

  const headers: Record<string, string> = {
    ...DEFAULT_HEADERS,
    ...config.headers,
    "x-cid": createCorrelationId(),
  };

  const orgId =
    state.org?.id ??
    persisted?.org?.id ??
    state.user?.organizationId ??
    null;
  if (orgId) {
    headers["x-org-id"] = orgId;
  }
  const sessionToken = state.sessionToken ?? persisted?.sessionToken ?? null;
  if (sessionToken) {
    headers["x-session-token"] = sessionToken;
  }
  if (typeof document !== "undefined") {
    const csrf = readCookie("ss_csrf");
    if (csrf) {
      headers["x-csrf-token"] = csrf;
    }
  }

  const init: RequestInit = {
    method,
    headers,
    credentials: "include",
    mode: "cors",
    signal: controller.signal,
  };

  if (config.body !== undefined) {
    init.body = typeof config.body === "string" ? config.body : JSON.stringify(config.body);
  }

  const url = resolveUrl(applyQuery(path, config.query));

  try {
    const response = await fetch(url, init);
    if (response.status === 401 && (config.authAttempt ?? 0) === 0) {
      try {
        await refreshSession();
      } catch {
        logoutAndRedirect();
        throw new HttpError("Session expired", 401, null);
      }
      return performFetch(method, path, { ...config, authAttempt: 1 });
    }
    return response;
  } finally {
    limiter.release();
  }
};

const applyQuery = (
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
) => {
  if (!query || !Object.keys(query).length) return path;
  const isAbsolute = /^https?:\/\//i.test(path);
  const base = isAbsolute ? path : `https://dummy.base${path.startsWith("/") ? "" : "/"}`;
  const url = new URL(base);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) return;
    url.searchParams.set(key, String(value));
  });
  if (isAbsolute) {
    return url.toString();
  }
  return `${url.pathname}${url.search}`;
};

const refreshSession = async () => {
  if (refreshPromise) {
    return refreshPromise;
  }
  refreshPromise = (async () => {
    const response = await performFetch("POST", "/auth/refresh", {
      authAttempt: 1,
    });
    if (!response.ok) {
      throw new HttpError("Refresh failed", response.status, null);
    }
    await response.json().catch(() => null);
    return;
  })();
  try {
    await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

const normalizePath = (path: string) => {
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

const shouldAllowProfileRetry = (path: string) => {
  const normalized = normalizePath(path).replace(/\/+$/, "");
  return normalized.endsWith("/me");
};

const shouldBypassAuthRetry = (path: string) => {
  const normalized = normalizePath(path).replace(/\/+$/, "");
  return (
    normalized === "/auth/login" ||
    normalized === "/auth/register" ||
    normalized === "/auth/logout"
  );
};

const handleUnauthorized = async <TResponse, TBody>(
  method: HttpMethod,
  path: string,
  config: InternalRequestConfig<TBody>,
): Promise<TResponse> => {
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

const logoutAndRedirect = () => {
  useAuthStore.getState().logout();
  if (typeof window !== "undefined") {
    const reason = window.location.search.includes("reason=")
      ? window.location.search
      : "";
    const target = reason ? `/login${reason}` : LOGIN_REDIRECT;
    window.location.replace(target);
  }
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
};

export const request = async <TResponse = unknown, TBody = unknown>(
  method: HttpMethod,
  path: string,
  config: InternalRequestConfig<TBody> = {},
): Promise<TResponse> => {
  const response = await performFetch(method, path, config);

  if (response.status === 401) {
    if (shouldBypassAuthRetry(path)) {
      const data = await parseResponse<unknown>(response);
      throw new HttpError(
        (data as { message?: string })?.message ?? "Unauthorized",
        response.status,
        data,
      );
    }
    return handleUnauthorized<TResponse, TBody>(method, path, config);
  }

  if (response.status === 403) {
    const data = await parseResponse<unknown>(response);
    throw new ForbiddenError(
      data && typeof data === "object" && "message" in data
        ? String((data as { message?: string }).message)
        : "Nedostatečná oprávnění",
      data,
    );
  }

  if (!response.ok) {
    const data = await parseResponse<unknown>(response);
    throw new HttpError(
      (data as { message?: string })?.message ?? "HTTP error",
      response.status,
      data,
    );
  }

  const envelope = (await parseResponse<ApiEnvelope<TResponse>>(response)) as ApiEnvelope<TResponse>;
  if (envelope && typeof envelope === "object" && "success" in envelope) {
    if (envelope.success === false) {
      throw new HttpError(envelope.error ?? "API error", response.status, envelope.meta);
    }
    return (envelope as { data: TResponse }).data;
  }
  return envelope as unknown as TResponse;
};

export const httpClient = {
  request,
  get: <TResponse>(path: string, config?: RequestConfig) =>
    request<TResponse>("GET", path, config),
  post: <TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    config?: RequestConfig<TBody>,
  ) => request<TResponse>("POST", path, { ...config, body }),
  put: <TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    config?: RequestConfig<TBody>,
  ) => request<TResponse>("PUT", path, { ...config, body }),
  patch: <TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    config?: RequestConfig<TBody>,
  ) => request<TResponse>("PATCH", path, { ...config, body }),
  delete: <TResponse>(path: string, config?: RequestConfig) =>
    request<TResponse>("DELETE", path, config),
};

// Backward-compatible alias with explicit envelope parsing
export const fetchWithAuth = request;
