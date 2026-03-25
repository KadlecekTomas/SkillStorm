import { describe, expect, it } from "vitest";
import {
  canAccessPlatform,
  canTriageSupport,
  getRoleHomePath,
} from "@/utils/permissions";

describe("platform permissions", () => {
  it("allows SUPPORT into platform workspace", () => {
    expect(
      canAccessPlatform({
        id: "support-1",
        name: "Support Agent",
        systemRole: "SUPPORT",
      }),
    ).toBe(true);
  });

  it("allows DEVOPS read access but not support triage actions", () => {
    const user = {
      id: "devops-1",
      name: "DevOps",
      systemRole: "DEVOPS" as const,
    };

    expect(canAccessPlatform(user)).toBe(true);
    expect(canTriageSupport(user)).toBe(false);
  });

  it("routes SUPPORT and DEVOPS users to platform home", () => {
    expect(
      getRoleHomePath({
        id: "support-1",
        name: "Support Agent",
        systemRole: "SUPPORT",
      }),
    ).toBe("/app/platform");

    expect(
      getRoleHomePath({
        id: "devops-1",
        name: "DevOps",
        systemRole: "DEVOPS",
      }),
    ).toBe("/app/platform");
  });
});
