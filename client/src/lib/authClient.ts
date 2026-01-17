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
      window.location.href = '/login';
    }
    return response;
  }

  return fetch(input, { ...init, credentials: 'include' });
}
