"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { getAuthIntent, clearAuthIntent, buildJoinUrlFromIntent } from "@/lib/auth-intent";
import { clearReturnUrl, readReturnUrl } from "@/lib/auth-session";
import { resolvePostAuthTarget } from "@/lib/post-auth-policy";

/**
 * Single source of truth for post-auth navigation. When user becomes authenticated
 * on auth routes (login/register/join), computes target via resolvePostAuthTarget()
 * and navigates once per auth transition. Clears intent only when it was consumed
 * for navigation. No in-memory resolved flag; idempotency via ref keyed by auth transition.
 */
export function PostAuthResolver(): null {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { authStatus, isAuthenticated, context } = useAuth();
  const navigatedThisTransitionRef = useRef(false);
  const prevAuthenticatedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const justBecameAuthenticated =
      isAuthenticated && authStatus === "authenticated" && !prevAuthenticatedRef.current;
    prevAuthenticatedRef.current = isAuthenticated;

    if (!isAuthenticated) {
      navigatedThisTransitionRef.current = false;
      return;
    }

    const path = pathname ?? "";
    const isAuthRoute = path === "/login" || path === "/register" || path === "/join" || path.startsWith("/join/");
    if (!isAuthRoute || !justBecameAuthenticated || navigatedThisTransitionRef.current) {
      return;
    }

    const currentPath = path + (typeof window !== "undefined" ? window.location.search : "");
    const intent = getAuthIntent();
    const contextMode = (context?.mode ?? null) as "personal" | "organization" | "platform" | null;
    const storedReturnUrl = readReturnUrl();
    const target =
      storedReturnUrl ??
      resolvePostAuthTarget({
        authIntent: intent,
        currentPath,
        searchParams,
        contextMode,
      });

    if (target === null) {
      if (intent && path.startsWith("/join")) {
        clearAuthIntent();
      }
      return;
    }

    const intentWasUsed =
      intent &&
      ((intent.type === "JOIN" && target === buildJoinUrlFromIntent(intent)) ||
        (intent.type === "RETURN_TO" && target === intent.path));
    if (intentWasUsed) {
      clearAuthIntent();
    }
    if (storedReturnUrl) {
      clearReturnUrl();
    }
    navigatedThisTransitionRef.current = true;
    router.replace(target);
  }, [authStatus, isAuthenticated, pathname, context?.mode, router, searchParams]);

  return null;
}
