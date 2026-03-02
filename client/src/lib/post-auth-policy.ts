/**
 * Canonical post-auth redirect policy. Single source of truth for where to send
 * the user after login/register. Pure and testable; no side effects.
 */

import type { AuthIntent } from "./auth-intent";
import { buildJoinUrlFromIntent } from "./auth-intent";
import { getSafeRedirectRedirect, isSafeRedirectPath } from "./safe-redirect";

export type ContextMode = "personal" | "organization" | "platform" | null;

export type ResolvePostAuthTargetArgs = {
  authIntent: AuthIntent | null;
  currentPath: string;
  searchParams: URLSearchParams;
  contextMode: ContextMode;
};

/**
 * Returns the path to navigate to after auth, or null if no navigation needed
 * (e.g. already on target). Order: intent (JOIN / RETURN_TO) → safe redirect/from
 * param → context fallback.
 */
export function resolvePostAuthTarget(args: ResolvePostAuthTargetArgs): string | null {
  const { authIntent, currentPath, searchParams, contextMode } = args;
  const normalizedCurrent = currentPath.trim() || "/";

  // 1) Intent takes precedence
  if (authIntent) {
    if (authIntent.type === "JOIN") {
      const target = buildJoinUrlFromIntent(authIntent);
      return normalizedCurrent === target ? null : target;
    }
    if (authIntent.type === "RETURN_TO") {
      if (!isSafeRedirectPath(authIntent.path)) return null;
      const target = authIntent.path.trim();
      return normalizedCurrent === target ? null : target;
    }
  }

  // 2) Safe redirect/from from URL (fallback when no intent)
  const redirectFromUrl = getSafeRedirectRedirect(searchParams);
  if (redirectFromUrl) {
    return normalizedCurrent === redirectFromUrl ? null : redirectFromUrl;
  }

  // 3) Context-based fallback
  let fallback: string;
  if (contextMode === "personal") {
    fallback = "/onboarding/create-organization";
  } else if (contextMode === "platform") {
    fallback = "/app/platform";
  } else if (contextMode === "organization") {
    fallback = "/app";
  } else {
    fallback = "/app";
  }
  return normalizedCurrent === fallback ? null : fallback;
}
