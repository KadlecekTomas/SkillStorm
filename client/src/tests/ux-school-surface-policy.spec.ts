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

  it("pozvánky učitelů jsou centralizované v Lidech a přístupy mají kanonický guard", () => {
    const access = source("src/app/(school)/app/settings/teachers/page.tsx");
    const people = source("src/app/(school)/app/people/page.tsx");

    expect(access).toContain("Přístupy učitelů");
    expect(access).toContain("Zatím tu nejsou žádní učitelé.");
    expect(access).toContain('href="/app/people"');
    expect(access).toContain("Přejít do sekce Lidé");
    expect(access).toContain('label: "Přístup ke třídám"');
    expect(access).toContain("requireRoles: MANAGEMENT_ROLES");
    expect(access).toContain("PermissionKey.MANAGE_TEACHERS");
    expect(access).toContain("requireSchoolWorkspace: true");
    expect(access).not.toContain('label: "Role"');
    expect(access).not.toContain("Zpět na Lidi");
    expect(access).not.toContain('generateInvite("TEACHER")');
    expect(access).not.toContain('"/invites"');

    expect(people).toContain("Lidé ve škole");
    expect(people).toContain("Pozvat učitele");
    expect(people).toContain('generateInvite("TEACHER")');
    expect(people).toContain('"/invites"');

    expect(access).not.toContain("No teachers yet");
    expect(access).not.toContain("Total teachers:");
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

  it("globální hlavička nezobrazuje mrtvou notifikační akci", () => {
    const text = source("src/components/layout/app-header.tsx");

    expect(text).not.toContain("Notifikace zatím nejsou aktivní");
    expect(text).not.toContain("<Bell");
    expect(text).toContain("Vytvořit test");
  });
});
