import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Cookie set by backend on login (ACCESS_TOKEN_COOKIE). Used only to detect "has any session". */
const AUTH_COOKIE = "ss_at";

const LOGIN_PATH = "/login";
const APP_PREFIX = "/app";
const JOIN_PREFIX = "/join";

/** Redirect legacy /dashboard* to /app* for bookmarks. */
function redirectDashboardToApp(pathname: string, request: NextRequest): NextResponse | null {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    const newPath = pathname === "/dashboard" ? "/app" : pathname.replace(/^\/dashboard/, "/app");
    return NextResponse.redirect(new URL(newPath, request.url));
  }
  return null;
}

/**
 * Server-side gate for app and join routes:
 * - /dashboard* → redirect to /app* (legacy bookmarks).
 * - Unauthenticated on /app* → redirect to /login?from=pathname.
 * - Unauthenticated on /join* → redirect to /login?redirect=fullUrl (join has priority; after login user continues join flow).
 * - Role-based access to /app/platform* is enforced client-side (isPlatformAdmin).
 */
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const { pathname } = url;

  const legacyRedirect = redirectDashboardToApp(pathname, request);
  if (legacyRedirect) return legacyRedirect;

  const hasAuthCookie = request.cookies.get(AUTH_COOKIE)?.value != null;

  if (pathname === JOIN_PREFIX || pathname.startsWith(`${JOIN_PREFIX}/`)) {
    if (!hasAuthCookie) {
      const login = new URL(LOGIN_PATH, request.url);
      login.searchParams.set("redirect", `${pathname}${url.search}`);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith(APP_PREFIX)) {
    return NextResponse.next();
  }

  if (!hasAuthCookie) {
    const login = new URL(LOGIN_PATH, request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/app", "/app/:path*", "/join", "/join/:path*"],
};
