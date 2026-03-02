/**
 * Safe redirect validation for post-login/post-register redirects.
 * Prevents open redirect: only same-origin paths allowed, no protocol, no "//", no "javascript:".
 */

/** Returns true if path is safe for client-side redirect (same-origin path only). */
export function isSafeRedirectPath(path: string): boolean {
  if (!path || typeof path !== "string") return false;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) return false;
  if (trimmed.startsWith("//")) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:")) return false;
  if (lower.startsWith("http://") || lower.startsWith("https://")) return false;
  try {
    const u = new URL(trimmed, "https://example.com");
    if (u.protocol !== "https:" || u.host !== "example.com") return false;
  } catch {
    return false;
  }
  return true;
}

export function getSafeRedirectRedirect(searchParams: URLSearchParams): string | null {
  const redirect = searchParams.get("redirect") ?? searchParams.get("from");
  if (!redirect || typeof redirect !== "string") return null;
  const trimmed = redirect.trim();
  if (!isSafeRedirectPath(trimmed)) return null;
  return trimmed;
}
