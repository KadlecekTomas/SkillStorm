import { NextResponse } from "next/server";

const ACCESS_TOKEN_COOKIE = "ss_at";
const CSRF_TOKEN_COOKIE = "ss_csrf";

const resolveBackendBaseUrl = (): string | null => {
  const proxyTarget = process.env.API_PROXY_TARGET?.trim();
  if (proxyTarget) return proxyTarget;
  const publicBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (publicBase) return publicBase;
  return null;
};

const readCookie = (cookieHeader: string, name: string): string | null => {
  const parts = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const match = parts.find((part) => part.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split("=").slice(1).join("="));
};

export async function POST(req: Request): Promise<Response> {
  const baseUrl = resolveBackendBaseUrl();
  const ingestKey = process.env.METRICS_INGEST_KEY?.trim();
  const cookieHeader = req.headers.get("cookie") ?? "";
  const accessToken = readCookie(cookieHeader, ACCESS_TOKEN_COOKIE);
  const csrfCookie = readCookie(cookieHeader, CSRF_TOKEN_COOKIE);
  const csrfHeader = req.headers.get("x-csrf-token");

  if (!baseUrl) {
    return NextResponse.json(
      { error: "Missing API proxy target." },
      { status: 500 },
    );
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return NextResponse.json(
      { error: "CSRF token mismatch." },
      { status: 403 },
    );
  }

  if (!ingestKey) {
    return NextResponse.json(
      { error: "Telemetry unavailable." },
      { status: 500 },
    );
  }

  const body = await req.text();
  const contentType = req.headers.get("content-type") ?? "application/json";
  const target = `${baseUrl.replace(/\/+$/, "")}/metrics/rbac`;

  const upstream = await fetch(target, {
    method: "POST",
    headers: {
      "content-type": contentType,
      "x-metrics-key": ingestKey,
      "x-csrf-token": csrfHeader,
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: body.length ? body : null,
    cache: "no-store",
  });

  const responseBody = await upstream.text();
  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get("content-type");
  if (upstreamContentType) {
    responseHeaders.set("content-type", upstreamContentType);
  }

  return new Response(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
