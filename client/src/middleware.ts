import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Cookie set by backend on login (ACCESS_TOKEN_COOKIE). Used only to detect "has any session". */
const AUTH_COOKIE = "ss_at";

const LOGIN_PATH = "/login";
const APP_PREFIX = "/app";
const JOIN_PREFIX = "/join";

/**
 * Build auth redirects from the request host. Legacy /dashboard routes are
 * intentionally handled by Next config redirects before rendering, so this
 * middleware stays focused on session-gating the canonical /app surface.
 */
function sameOriginUrl(request: NextRequest, pathname: string): URL {
  const host =
    request.headers.get("host")?.trim() ||
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.nextUrl.host;
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const protocol =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : request.nextUrl.protocol.replace(/:$/, "");

  return new URL(pathname, `${protocol}://${host}`);
}

function redirectToLogin(
  request: NextRequest,
  pathname: string,
  param: "from" | "redirect",
): NextResponse {
  const login = sameOriginUrl(request, LOGIN_PATH);
  login.searchParams.set(param, pathname);
  return NextResponse.redirect(login);
}

/**
 * Server-side gate for protected app and join routes:
 * - legacy /dashboard* bookmarks redirect to canonical routes in next.config;
 * - unauthenticated /app* → /login?from=pathname;
 * - unauthenticated /join* → /login?redirect=fullUrl;
 * - role-based /app/platform* access is enforced by the platform guard.
 */
export function middleware(request: NextRequest): NextResponse {
  const url = request.nextUrl;
  const { pathname } = url;
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
  matcher: ["/app", "/app/:path*", "/join", "/join/:path*"],
};
