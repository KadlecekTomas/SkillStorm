import { describe, expect, it } from "vitest";
import { getNavItemsForRole } from "@/config/dashboard-navigation";
import { roleHome } from "@/types/permissions";

const routesFor = (role: string) => getNavItemsForRole(role).map((i) => i.route);

describe("role-aware navigace (regrese P0-3)", () => {
  it("žák nedostane odkazy na učitelské plochy", () => {
    const routes = routesFor("STUDENT");
    expect(routes).not.toContain("/app/classrooms");
    expect(routes).not.toContain("/app/tests");
    expect(routes).not.toContain("/app/library");
    expect(routes).not.toContain("/app/settings");
    // /app/results je učitelská diagnostika — žák tam nesmí být směrován
    expect(routes).not.toContain("/app/results");
  });

  it("žák má vlastní úkoly a vlastní výsledky", () => {
    const routes = routesFor("STUDENT");
    expect(routes).toContain("/app");
    expect(routes).toContain("/app/assignments");
    expect(routes).toContain("/app/student/analytics");
  });

  it("učitel/ředitel si drží plnou navigaci (beze změny mimo scope)", () => {
    const teacher = routesFor("TEACHER");
    expect(teacher).toContain("/app/classrooms");
    expect(teacher).toContain("/app/tests");
    expect(teacher).toContain("/app/results");
    // Neznámá/prázdná role → výchozí (učitelská) sada
    expect(routesFor("")).toEqual(teacher);
  });

  it("domovská plocha žáka není učitelská diagnostika", () => {
    expect(roleHome.STUDENT).toBe("/app");
    expect(roleHome.STUDENT).not.toBe("/app/results");
  });
});
