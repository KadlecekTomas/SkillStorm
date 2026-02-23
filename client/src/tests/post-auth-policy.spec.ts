import { describe, it, expect } from "vitest";
import { resolvePostAuthTarget } from "@/lib/post-auth-policy";

function searchParams(entries: Record<string, string>): URLSearchParams {
  const p = new URLSearchParams();
  Object.entries(entries).forEach(([k, v]) => p.set(k, v));
  return p;
}

describe("resolvePostAuthTarget", () => {
  it("returns /join?token=X when JOIN intent and current path is login", () => {
    const result = resolvePostAuthTarget({
      authIntent: { type: "JOIN", token: "X" },
      currentPath: "/login",
      searchParams: searchParams({}),
      contextMode: "personal",
    });
    expect(result).toBe("/join?token=X");
  });

  it("returns null when JOIN intent and already on join URL", () => {
    const result = resolvePostAuthTarget({
      authIntent: { type: "JOIN", token: "XYZ" },
      currentPath: "/join?token=XYZ&role=TEACHER",
      searchParams: searchParams({}),
      contextMode: "organization",
    });
    expect(result).toBeNull();
  });

  it("returns RETURN_TO path when safe and different from current", () => {
    const result = resolvePostAuthTarget({
      authIntent: { type: "RETURN_TO", path: "/join?token=abc" },
      currentPath: "/login",
      searchParams: searchParams({}),
      contextMode: "personal",
    });
    expect(result).toBe("/join?token=abc");
  });

  it("returns null when RETURN_TO path is unsafe (protocol)", () => {
    const result = resolvePostAuthTarget({
      authIntent: { type: "RETURN_TO", path: "https://evil.com/path" },
      currentPath: "/login",
      searchParams: searchParams({}),
      contextMode: "personal",
    });
    expect(result).toBeNull();
  });

  it("returns null when RETURN_TO path is unsafe (//)", () => {
    const result = resolvePostAuthTarget({
      authIntent: { type: "RETURN_TO", path: "//evil.com/path" },
      currentPath: "/login",
      searchParams: searchParams({}),
      contextMode: "personal",
    });
    expect(result).toBeNull();
  });

  it("returns null when RETURN_TO path equals current path", () => {
    const result = resolvePostAuthTarget({
      authIntent: { type: "RETURN_TO", path: "/join?token=x" },
      currentPath: "/join?token=x",
      searchParams: searchParams({}),
      contextMode: "organization",
    });
    expect(result).toBeNull();
  });

  it("uses safe redirect param when no intent", () => {
    const result = resolvePostAuthTarget({
      authIntent: null,
      currentPath: "/login",
      searchParams: searchParams({ redirect: "/join?token=xyz" }),
      contextMode: "personal",
    });
    expect(result).toBe("/join?token=xyz");
  });

  it("uses safe from param when no intent and no redirect", () => {
    const result = resolvePostAuthTarget({
      authIntent: null,
      currentPath: "/register",
      searchParams: searchParams({ from: "/app/settings" }),
      contextMode: "personal",
    });
    expect(result).toBe("/app/settings");
  });

  it("returns null when redirect param equals current path", () => {
    const result = resolvePostAuthTarget({
      authIntent: null,
      currentPath: "/join?token=a",
      searchParams: searchParams({ redirect: "/join?token=a" }),
      contextMode: "personal",
    });
    expect(result).toBeNull();
  });

  it("fallback: personal -> /onboarding/create-organization", () => {
    const result = resolvePostAuthTarget({
      authIntent: null,
      currentPath: "/login",
      searchParams: searchParams({}),
      contextMode: "personal",
    });
    expect(result).toBe("/onboarding/create-organization");
  });

  it("fallback: organization -> /app", () => {
    const result = resolvePostAuthTarget({
      authIntent: null,
      currentPath: "/login",
      searchParams: searchParams({}),
      contextMode: "organization",
    });
    expect(result).toBe("/app");
  });

  it("fallback: platform -> /app/platform", () => {
    const result = resolvePostAuthTarget({
      authIntent: null,
      currentPath: "/login",
      searchParams: searchParams({}),
      contextMode: "platform",
    });
    expect(result).toBe("/app/platform");
  });

  it("fallback: null context -> /app", () => {
    const result = resolvePostAuthTarget({
      authIntent: null,
      currentPath: "/register",
      searchParams: searchParams({}),
      contextMode: null,
    });
    expect(result).toBe("/app");
  });

  it("returns null when already on fallback target (personal)", () => {
    const result = resolvePostAuthTarget({
      authIntent: null,
      currentPath: "/onboarding/create-organization",
      searchParams: searchParams({}),
      contextMode: "personal",
    });
    expect(result).toBeNull();
  });

  it("intent overrides redirect param", () => {
    const result = resolvePostAuthTarget({
      authIntent: { type: "JOIN", token: "T" },
      currentPath: "/login",
      searchParams: searchParams({ redirect: "/app" }),
      contextMode: "organization",
    });
    expect(result).toBe("/join?token=T");
  });
});
