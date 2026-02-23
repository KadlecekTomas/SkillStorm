import { derivePermissions } from "@/utils/permissions";
import { PermissionKey, type User } from "@/types";

describe("derivePermissions", () => {
  it("uses backend permissions as the only source when provided", () => {
    const user: User = {
      id: "u-1",
      name: "Teacher",
      organizationRole: "TEACHER",
      permissions: [PermissionKey.VIEW_RESULTS],
    };

    const permissions = derivePermissions(user);

    expect(permissions).toEqual([PermissionKey.VIEW_RESULTS]);
    expect(permissions).not.toContain(PermissionKey.CREATE_TEST);
  });

  it("falls back to static role matrix only when backend permissions are missing", () => {
    const user: User = {
      id: "u-2",
      name: "Teacher",
      organizationRole: "TEACHER",
    };

    const permissions = derivePermissions(user);

    expect(permissions).toContain(PermissionKey.CREATE_TEST);
    expect(permissions).toContain(PermissionKey.ASSIGN_TESTS);
  });
});
