import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/utils/env";

export async function POST(request: Request) {
  let refreshToken: string | undefined;
  try {
    const body = await request.json();
    refreshToken = body?.refreshToken;
  } catch {
    // no body provided
  }

  const payload =
    refreshToken && refreshToken.length > 0 ? { refreshToken } : undefined;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { message: "Failed to logout" },
      { status: 500 },
    );
  }
}
