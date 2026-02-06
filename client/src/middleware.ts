import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Cookie set by backend on login (ACCESS_TOKEN_COOKIE). Used only to detect "has any session". */
const AUTH_COOKIE = "ss_at";

const LOGIN_PATH = "/login";
const DASHBOARD_PREFIX = "/dashboard";

/**
 * Server-side gate for dashboard routes:
 * - Unauthenticated (no auth cookie) → redirect to /login.
 * - Role-based access to /dashboard/platform* is enforced client-side (isPlatformAdmin).
 * No redirect loop: we never redirect dashboard → platform or platform → dashboard here.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith(DASHBOARD_PREFIX)) {
    return NextResponse.next();
  }

  const hasAuthCookie = request.cookies.get(AUTH_COOKIE)?.value != null;
  if (!hasAuthCookie) {
    const login = new URL(LOGIN_PATH, request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
