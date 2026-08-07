import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT_ROOT = process.cwd().endsWith("/client")
  ? process.cwd()
  : join(process.cwd(), "client");

function source(relativePath: string): string {
  return readFileSync(join(CLIENT_ROOT, relativePath), "utf8");
}

function expectNoNestedLinkButton(relativePath: string): void {
  const text = source(relativePath);
  const nestedInteractive = /<Link\b[^>]*>[\s\S]*?<Button\b[\s\S]*?<\/Link>/;
  expect(nestedInteractive.test(text), relativePath).toBe(false);
}

describe("school UX action integrity", () => {
  it("nezobrazuje ve Třídách falešné tlačítko, které jen předstírá žádost správci", () => {
    const text = source("src/components/pages/classrooms/classrooms-page.tsx");

    expect(text).not.toContain("Požádat správce o vytvoření školního roku");
    expect(text).not.toContain("Požádej správce o vytvoření školního roku.");
    expect(text).toContain("Školní rok musí nastavit ředitel nebo vlastník školy.");
  });

  it("odvozuje učitelský pohled z aktivní role, ne z absence jiných rolí", () => {
    const text = source("src/components/pages/classrooms/classrooms-page.tsx");

    expect(text).toContain('const effectiveRole = activeRole ?? roles[0] ?? null;');
    expect(text).toContain('const isTeacherView = effectiveRole === "TEACHER";');
    expect(text).not.toContain('!canManageClasses && !roles.includes("STUDENT")');
  });

  it("rodičovský doporučený krok má reálnou akci jen podle guardian policy", () => {
    const text = source("src/app/(school)/app/family/page.tsx");

    expect(text).toContain('nextStepItem.guardianLaunchPolicy !== "DISABLED"');
    expect(text).toContain('"Spustit doma"');
    expect(text).not.toContain("ChevronRight");
  });

  it("TeacherOverview nevykreslí mrtvou šipku bez cíle", () => {
    const text = source("src/components/content/teacher-overview.tsx");

    expect(text).toContain("const primaryAction = actions[0] ?? null;");
    expect(text).toContain("{primaryAction && (");
  });

  it("učitel v Zadání dostane skutečný vstup do výsledků místo disabled studentského CTA", () => {
    const text = source("src/app/(school)/app/assignments/page.tsx");

    expect(text).toContain('router.push(`/app/tests/${assignment.testId}/results`);');
    expect(text).toContain('"Zobrazit výsledky"');
    expect(text).not.toContain("Zadání může odevzdat pouze žák");
  });

  it("výsledky pravdivě popisují browser print místo falešného PDF exportu", () => {
    const text = source("src/app/(school)/app/results/page.tsx");

    expect(text).toContain("Tisk / uložit PDF");
    expect(text).not.toContain("Export PDF");
    expect(text).toContain("window.print()");
  });

  it("detail žáka nepoužívá interní diagnostické enumy jako text pro učitele", () => {
    const text = source("src/app/(school)/app/students/[studentId]/page.tsx");

    expect(text).toContain('WEAK: "Slabé místo"');
    expect(text).toContain('WARNING: "Pozor"');
    expect(text).toContain('GOOD: "V pořádku"');
    expect(text).toContain('INSUFFICIENT_DATA: "Málo dat"');
  });

  it("detail žáka, staff výsledky a guardian kódy mají frontend RBAC před API requesty", () => {
    const studentLayout = source("src/app/(school)/app/students/[studentId]/layout.tsx");
    const testResults = source("src/app/(school)/app/tests/[testId]/results/page.tsx");
    const guardianLayout = source(
      "src/app/(school)/app/classrooms/[classSectionId]/guardian-codes/layout.tsx",
    );

    expect(studentLayout).toContain('"OWNER"');
    expect(studentLayout).toContain('"DIRECTOR"');
    expect(studentLayout).toContain('"TEACHER"');
    expect(studentLayout).not.toContain('"STUDENT"');
    expect(studentLayout).not.toContain('"PARENT"');

    expect(testResults).toContain("requireRoles: STAFF_ROLES");
    expect(testResults).toContain("PermissionKey.VIEW_RESULTS");

    expect(guardianLayout).toContain("PermissionKey.INVITE_STUDENTS");
    expect(guardianLayout).toContain('"TEACHER"');
    expect(guardianLayout).not.toContain('"STUDENT"');
    expect(guardianLayout).not.toContain('"PARENT"');
  });

  it("vytvoření testu neposílá běžného učitele do zakázaného nastavení", () => {
    const text = source("src/app/(school)/app/tests/create/page.tsx");

    expect(text).toContain("canManageSubjects");
    expect(text).toContain("Předměty musí nejdříve připravit ředitel nebo vlastník školy.");
    expect(text).toContain("Otevřít nastavení předmětů");
    expect(text).toContain("requireSchoolWorkspace: true");
    expectNoNestedLinkButton("src/app/(school)/app/tests/create/page.tsx");
  });

  it("detail a editor testu nepoužívají neplatné Link+Button ani interní typy jako učitelský text", () => {
    const detail = source("src/app/(school)/app/tests/[testId]/page.tsx");
    const editor = source("src/app/(school)/app/tests/[testId]/edit/page.tsx");

    expect(detail).not.toContain('console.log("assignment.openAt raw:"');
    expect(detail).toContain("Test bude dostupný od");
    expect(editor).toContain('TRUE_FALSE: "Pravda / nepravda"');
    expect(editor).toContain('MULTIPLE_CHOICE: "Výběr z možností"');
    expect(editor).not.toContain("{index + 1} · {question.type}");
    expectNoNestedLinkButton("src/app/(school)/app/tests/[testId]/page.tsx");
    expectNoNestedLinkButton("src/app/(school)/app/tests/[testId]/edit/page.tsx");
  });

  it("žákovské historické test URL nevedou na 404 a neukazují technické assignmentId", () => {
    const legacyTest = source("src/app/(school)/app/student/tests/[testId]/page.tsx");
    const legacySubmission = source(
      "src/app/(school)/app/tests/[testId]/submission/page.tsx",
    );

    expect(legacyTest).toContain("/app/assignments/${encodeURIComponent(assignmentId)}");
    expect(legacyTest).not.toContain('router.replace(`/assignments/');
    expect(legacyTest).not.toContain("Chybí assignmentId");
    expect(legacyTest).not.toContain("Přejít na assignments");
    expect(legacySubmission).toContain('redirect("/app/assignments")');
  });

  it("support stránka nepředkládá učiteli raw API statusy a priority", () => {
    const text = source("src/app/(school)/app/support/page.tsx");

    expect(text).toContain('OPEN: "Nové"');
    expect(text).toContain('IN_REVIEW: "Řeší se"');
    expect(text).toContain('RESOLVED: "Vyřešeno"');
    expect(text).toContain('HIGH: "Vysoká priorita"');
    expect(text).not.toContain("platform support inboxu");
  });

  it("osobní režim nepoužívá permanentně disabled tlačítka jako popis nedostupných funkcí", () => {
    const text = source("src/app/(school)/app/personal/page.tsx");

    expect(text).not.toContain("<Button disabled");
    expect(text).toContain("Pozvání členů · dostupné po připojení ke škole");
    expect(text).toContain("Správa tříd · dostupná po připojení ke škole");
  });

  it("staré školní URL už neudržují druhou, zastaralou UX implementaci", () => {
    const aliases: Array<[string, string]> = [
      ["src/app/(dashboard)/dashboard/page.tsx", 'redirect("/app")'],
      ["src/app/(dashboard)/dashboard/personal/page.tsx", 'redirect("/app/personal")'],
      ["src/app/(dashboard)/dashboard/assignments/page.tsx", 'redirect("/app/assignments")'],
      ["src/app/(dashboard)/dashboard/tests/page.tsx", 'redirect("/app/tests")'],
      ["src/app/(dashboard)/dashboard/tests/create/page.tsx", 'redirect("/app/tests/create")'],
      ["src/app/(dashboard)/dashboard/academic-years/page.tsx", 'redirect("/app/academic-years")'],
      ["src/app/(dashboard)/tests/page.tsx", 'redirect("/app/tests")'],
    ];

    for (const [path, expectedRedirect] of aliases) {
      expect(source(path), path).toContain(expectedRedirect);
    }
  });
});
