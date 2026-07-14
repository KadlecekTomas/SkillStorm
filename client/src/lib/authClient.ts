import { setAuthIntent, buildReturnToPath } from "@/lib/auth-intent";

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(input, { ...init, credentials: 'include' });
  if (response.status !== 401) {
    return response;
  }

  const refreshResponse = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });

  if (!refreshResponse.ok) {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      // Preserve where the user was so PostAuthResolver can return them
      // after re-login (same contract as lib/http/client.ts) — a bare
      // redirect here was the "session expired → lost my page" bug.
      if (currentPath !== '/login' && currentPath !== '/register') {
        setAuthIntent({ type: 'RETURN_TO', path: buildReturnToPath() });
      }
      window.location.href = '/login?reason=expired';
    }
    return response;
  }

  return fetch(input, { ...init, credentials: 'include' });
}
