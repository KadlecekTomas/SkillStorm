import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Cookie set by backend on login (ACCESS_TOKEN_COOKIE). Used only to detect "has any session". */
const AUTH_COOKIE = "ss_at";

const LOGIN_PATH = "/login";
const APP_PREFIX = "/app";
const JOIN_PREFIX = "/join";

function redirectToLogin(request: NextRequest, pathname: string, param: "from" | "redirect"): NextResponse {
  const login = new URL(LOGIN_PATH, request.url);
  login.searchParams.set(param, pathname);
  return NextResponse.redirect(login);
}

/** Origin-relative redirect: preserves the browser host and therefore host-only auth cookies. */
function redirectRelative(pathname: string): NextResponse {
  return new NextResponse(null, {
    status: 307,
    headers: { Location: pathname },
  });
}

/** Redirect legacy /dashboard* to /app* for bookmarks. */
function redirectDashboardToApp(pathname: string): NextResponse | null {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    const newPath = pathname === "/dashboard" ? "/app" : pathname.replace(/^\/dashboard/, "/app");
    return redirectRelative(newPath);
  }
  return null;
}

/**
 * Server-side gate for app and join routes:
 * - /dashboard* → redirect to /app* (legacy bookmarks) without changing origin.
 * - Unauthenticated on /app* → redirect to /login?from=pathname.
 * - Unauthenticated on /join* → redirect to /login?redirect=fullUrl (join has priority; after login user continues join flow).
 * - Role-based access to /app/platform* is enforced client-side (isPlatformAdmin).
 */
export function middleware(request: NextRequest): NextResponse {
  const url = request.nextUrl;
  const { pathname } = url;

  const legacyRedirect = redirectDashboardToApp(pathname);
  if (legacyRedirect) return legacyRedirect;

  const hasAuthCookie = request.cookies.get(AUTH_COOKIE)?.value != null;

  if (pathname === JOIN_PREFIX || pathname.startsWith(`${JOIN_PREFIX}/`)) {
    if (!hasAuthCookie) {
      return redirectToLogin(request, `${pathname}${url.search}`, "redirect");
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith(APP_PREFIX)) {
    return NextResponse.next();
  }

  // Missing session always goes to /login. /forbidden is reserved for authenticated users
  // who do have a token but fail a role/permission gate later in the request lifecycle.
  if (!hasAuthCookie) {
    return redirectToLogin(request, pathname, "from");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/app", "/app/:path*", "/join", "/join/:path*"],
};
