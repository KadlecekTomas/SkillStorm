import { NextResponse } from "next/server";

const resolveBackendBaseUrl = (): string | null => {
  const proxyTarget = process.env.API_PROXY_TARGET?.trim();
  if (proxyTarget) return proxyTarget;
  const publicBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (publicBase) return publicBase;
  return null;
};

export async function POST(req: Request): Promise<Response> {
  const baseUrl = resolveBackendBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { error: "Missing API proxy target." },
      { status: 500 },
    );
  }

  const target = `${baseUrl.replace(/\/+$/, "")}/audit`;
  const body = await req.text();
  const contentType = req.headers.get("content-type") ?? "application/json";
  const cookie = req.headers.get("cookie") ?? "";

  const upstream = await fetch(target, {
    method: "POST",
    headers: {
      "content-type": contentType,
      ...(cookie ? { cookie } : {}),
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
  const setCookie = upstream.headers.get("set-cookie");
  if (setCookie) {
    responseHeaders.set("set-cookie", setCookie);
  }

  return new Response(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
