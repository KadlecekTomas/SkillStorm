import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT_ROOT = process.cwd().endsWith("/client")
  ? process.cwd()
  : join(process.cwd(), "client");
const SCHOOL_APP_ROOT = join(CLIENT_ROOT, "src/app/(school)/app");

function source(relativePath: string): string {
  return readFileSync(join(CLIENT_ROOT, relativePath), "utf8");
}

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? collectTsxFiles(path)
      : path.endsWith(".tsx")
        ? [path]
        : [];
  });
}

const schoolTsxFiles = collectTsxFiles(SCHOOL_APP_ROOT);
const nestedLinkButton =
  /<Link\b[^>]*>(?:(?!<\/Link>)[\s\S])*?<Button\b(?:(?!<\/Link>)[\s\S])*?<\/Link>/;

describe("school UI surface policy", () => {
  it("nemá v produkčních školních stránkách vnořené Link + Button", () => {
    const offenders = schoolTsxFiles.filter((file) =>
      nestedLinkButton.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("nemá placeholder odkazy ani prázdné click handlery", () => {
    const offenders = schoolTsxFiles.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      const reasons = [
        text.includes('href="#"') ? "href=#" : null,
        /onClick=\{\(\) => \{\s*\}\}/.test(text) ? "empty onClick" : null,
        /onClick=\{\(\) => undefined\}/.test(text) ? "undefined onClick" : null,
      ].filter(Boolean);
      return reasons.length > 0 ? [`${file}: ${reasons.join(", ")}`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it("nemá produkční console.log v uživatelských školních stránkách", () => {
    const offenders = schoolTsxFiles.filter((file) =>
      /\bconsole\.log\s*\(/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("správa učitelů je lokalizovaná a používá kanonický role/permission guard", () => {
    const text = source("src/app/(school)/app/settings/teachers/page.tsx");

    expect(text).toContain("Zatím tu nejsou žádní učitelé.");
    expect(text).toContain("Pozvat učitele");
    expect(text).toContain("Celkem učitelů:");
    expect(text).toContain('TEACHER: "Učitel"');
    expect(text).toContain("requireRoles: MANAGEMENT_ROLES");
    expect(text).toContain("PermissionKey.MANAGE_TEACHERS");
    expect(text).toContain("requireSchoolWorkspace: true");
    expect(text).not.toContain("No teachers yet");
    expect(text).not.toContain("Total teachers:");
  });

  it("audit nepoužívá zastaralý organizationRole branch a je chráněný guardem", () => {
    const text = source("src/app/(school)/app/audit/page.tsx");

    expect(text).toContain("requireRoles: AUDIT_ROLES");
    expect(text).toContain("requireSchoolWorkspace: true");
    expect(text).not.toContain("user?.organizationRole");
    expect(text).not.toContain("role DIRECTOR a OWNER");
  });

  it("student a teacher analytika rozlišují loading, chybu a prázdná data", () => {
    const student = source("src/app/(school)/app/student/analytics/page.tsx");
    const teacher = source("src/app/(school)/app/teacher/analytics/page.tsx");

    for (const text of [student, teacher]) {
      expect(text).toContain("setLoadError");
      expect(text).toContain("Zkusit znovu");
      expect(text).toContain("requirePerms: [PermissionKey.VIEW_RESULTS]");
      expect(text).not.toContain("const [, setLoading]");
    }
  });

  it("heatmap vedení neprezentuje API chybu jako legitimně prázdná data", () => {
    const text = source("src/app/(school)/app/analytics/class-heatmap/page.tsx");

    expect(text).toContain("Přehled výsledků tříd se nepodařilo načíst.");
    expect(text).toContain("Zkusit znovu");
    expect(text).toContain("!loading && !error");
  });
});
