"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OverviewCard } from "@/components/cards/overview-card";
import { TestCard } from "@/components/cards/test-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { httpClient } from "@/lib/http/client";
import type { TestSummary } from "@/types";
import { BookOpenCheck, NotebookTabs, Users2 } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { usePermissions } from "@/hooks/use-permissions";
import { PermissionKey } from "@/types";
import { PermissionGate } from "@/components/access/permission-gate";
import { RestrictedView } from "@/components/access/restricted-view";
import { useGamification } from "@/hooks/use-gamification";
import { GamificationPanel } from "@/components/gamification/gamification-panel";
import { LevelUpModal } from "@/components/gamification/level-up-modal";
import { withGuard } from "@/lib/guard/withGuard";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import {
  getDashboardOverview,
  getDashboardTeacher,
  getDashboardStudent,
  type TeacherDashboardResponse,
  type StudentDashboardResponse,
  type StatsOverviewResponse,
} from "@/lib/api/dashboard";

/**
 * Dashboard entrypoint (/dashboard). Renders overview only.
 * Must NOT redirect to /dashboard/platform (would create redirect loop with platform page).
 */
function DashboardPage() {
  const router = useRouter();
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const { can, hasRole } = usePermissions();
  const { context } = useAuth();
  const { summary: gamification } = useGamification();
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const previousLevelRef = useRef<number | null>(null);

  // Dashboard data states
  const [overviewData, setOverviewData] = useState<StatsOverviewResponse | null>(null);
  const [teacherData, setTeacherData] = useState<TeacherDashboardResponse | null>(null);
  const [studentData, setStudentData] = useState<StudentDashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const canSeeTests = can(PermissionKey.VIEW_RESULTS);
  const isTeacher = hasRole("TEACHER");
  const isStudent = hasRole("STUDENT");

  // Load dashboard data
  useEffect(() => {
    let cancelled = false;
    setDashboardLoading(true);
    setDashboardError(null);

    const loadDashboardData = async () => {
      try {
        // Load overview stats (available for all with VIEW_RESULTS permission)
        if (canSeeTests) {
          const overview = await getDashboardOverview("evaluated");
          if (!cancelled) setOverviewData(overview);
        }

        // Load role-specific dashboard
        if (isTeacher) {
          const teacher = await getDashboardTeacher();
          if (!cancelled) setTeacherData(teacher);
        } else if (isStudent) {
          const student = await getDashboardStudent();
          if (!cancelled) setStudentData(student);
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Nepodařilo se načíst data dashboardu";
        setDashboardError(message);
        console.error("Dashboard data loading error:", error);
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    };

    loadDashboardData();
    return () => {
      cancelled = true;
    };
  }, [canSeeTests, isTeacher, isStudent]);

  useEffect(() => {
    if (gamification?.level && previousLevelRef.current !== null) {
      if (gamification.level > previousLevelRef.current) {
        setLevelModalOpen(true);
      }
    }
    if (gamification?.level !== undefined) {
      previousLevelRef.current = gamification.level ?? null;
    }
  }, [gamification]);

  // Load tests
  useEffect(() => {
    let cancelled = false;
    if (!canSeeTests) {
      setTestsLoading(false);
      return;
    }
    setTestsLoading(true);
    httpClient
      .get<TestSummary[]>("/tests")
      .then((data) => {
        if (cancelled) return;
        // Handle null, undefined, or non-array responses
        if (Array.isArray(data) && data.length > 0) {
          setTests(data);
        } else {
          setTests([]);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("Dashboard tests fallback:", error);
        setTests([]);
      })
      .finally(() => {
        if (!cancelled) setTestsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canSeeTests]);

  const handleViewTest = (testId: string) => {
    router.push(`/dashboard/tests?test=${testId}`);
  };

  return (
    <>
    <div className="space-y-8">
      {context?.mode === "personal" && (
        <Card className="space-y-4 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Bez školy
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              Některé týmové funkce vyžadují školu
            </h2>
            <p className="text-sm text-slate-600">
              Můžeš pokračovat bez školy, nebo si školu založit či se připojit
              a odemknout správu tříd, pozvánky a certifikovaný obsah.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild className="rounded-2xl">
              <Link href="/dashboard/onboarding">Založit nebo se připojit</Link>
            </Button>
            <Button
              disabled
              variant="outline"
              title="Vyžaduje školu"
              className="rounded-2xl"
            >
              Pozvat členy
            </Button>
            <Button
              disabled
              variant="outline"
              title="Vyžaduje školu"
              className="rounded-2xl"
            >
              Spravovat třídy
            </Button>
          </div>
        </Card>
      )}
      {dashboardError && (
        <Alert
          title="Chyba načítání dat"
          description={dashboardError}
          variant="warning"
        />
      )}
      
      {dashboardLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <LoadingSpinner label="Načítání..." />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {isTeacher && teacherData ? (
            <>
              <OverviewCard
                title="Active learners"
                value={teacherData.studentsCount.toString()}
                delta={`${teacherData.classroomsCount} tříd`}
                icon={<Users2 className="h-5 w-5" />}
              />
              <OverviewCard
                title="Assessments"
                value={teacherData.testsCreated.toString()}
                delta={
                  teacherData.pendingSubmissions > 0
                    ? `${teacherData.pendingSubmissions} čeká na vyhodnocení`
                    : "Všechny vyhodnocené"
                }
                icon={<NotebookTabs className="h-5 w-5" />}
                accent="bg-blue-50 text-blue-600"
              />
              <OverviewCard
                title="Průměrné skóre"
                value={
                  teacherData.avgScoreOnMyTests !== null
                    ? `${Math.round(teacherData.avgScoreOnMyTests)}%`
                    : "—"
                }
                delta={`${teacherData.classroomsCount} tříd`}
                icon={<BookOpenCheck className="h-5 w-5" />}
                accent="bg-amber-50 text-amber-600"
              />
            </>
          ) : isStudent && studentData ? (
            <>
              <OverviewCard
                title="Dokončené testy"
                value={studentData.testsTaken.toString()}
                delta="Celkem odevzdáno"
                icon={<NotebookTabs className="h-5 w-5" />}
                accent="bg-blue-50 text-blue-600"
              />
              <OverviewCard
                title="Průměrné skóre"
                value={
                  studentData.avgScore !== null
                    ? `${Math.round(studentData.avgScore)}%`
                    : "—"
                }
                delta="Z vyhodnocených testů"
                icon={<BookOpenCheck className="h-5 w-5" />}
                accent="bg-amber-50 text-amber-600"
              />
            </>
          ) : overviewData ? (
            <>
              <OverviewCard
                title="Celkem testů"
                value={overviewData.totalTests.toString()}
                delta={`${overviewData.counts.approved} schváleno`}
                icon={<NotebookTabs className="h-5 w-5" />}
                accent="bg-blue-50 text-blue-600"
              />
              <OverviewCard
                title="Odevzdání"
                value={overviewData.totalSubmissions.toString()}
                delta={`${overviewData.counts.pending} čeká`}
                icon={<Users2 className="h-5 w-5" />}
              />
              <OverviewCard
                title="Úspěšnost"
                value={`${Math.round(overviewData.passRate * 100)}%`}
                delta={
                  overviewData.avgScore !== null
                    ? `Průměr: ${Math.round(overviewData.avgScore)}%`
                    : "Bez průměru"
                }
                icon={<BookOpenCheck className="h-5 w-5" />}
                accent="bg-amber-50 text-amber-600"
              />
            </>
          ) : null}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <PermissionGate
          permission={PermissionKey.VIEW_RESULTS}
          fallback={
            <RestrictedView className="col-span-full" description="Výsledky testů jsou dostupné pouze učitelům a vedení." />
          }
        >
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Latest tests</p>
                <p className="text-lg font-semibold text-slate-900">
                  Completion & averages
                </p>
              </div>
            </div>
            {testsLoading ? (
              <LoadingSpinner label="Loading tests" className="py-8" />
            ) : tests.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {tests.map((test) => (
                  <TestCard key={test.id} test={test} onView={handleViewTest} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-slate-500">
                Zatím žádné testy.
              </div>
            )}
          </Card>
        </PermissionGate>
        <PermissionGate
          permission={PermissionKey.VIEW_RESULTS}
          fallback={<RestrictedView description="Výukový pokrok je dostupný jen s oprávněním k výsledkům." />}
        >
          {isStudent && studentData ? (
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Poslední aktivity</p>
                  <p className="text-lg font-semibold text-slate-900">
                    Moje odevzdání
                  </p>
                </div>
              </div>
              {studentData.lastSubmissions.length > 0 ? (
                <div className="space-y-2">
                  {studentData.lastSubmissions.slice(0, 5).map((submission) => (
                    <div
                      key={submission.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {submission.testTitle}
                        </p>
                        <p className="text-xs text-slate-500">
                          {submission.submittedAt
                            ? new Date(submission.submittedAt).toLocaleDateString("cs-CZ")
                            : "Datum není k dispozici"}
                        </p>
                      </div>
                      {submission.score !== null ? (
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">
                            {Math.round(submission.score)}%
                          </p>
                        </div>
                      ) : (
                        <Badge variant="neutral">Čeká na vyhodnocení</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-slate-500">
                  Zatím žádná odevzdání.
                </div>
              )}
            </Card>
          ) : isTeacher && teacherData ? (
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Poslední aktivity</p>
                  <p className="text-lg font-semibold text-slate-900">
                    Odevzdání studentů
                  </p>
                </div>
              </div>
              {teacherData.recentActivity.length > 0 ? (
                <div className="space-y-2">
                  {teacherData.recentActivity.slice(0, 5).map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">
                          {activity.testTitle}
                        </p>
                        <p className="text-xs text-slate-500">
                          {activity.studentName ?? "Anonymní student"} •{" "}
                          {activity.submittedAt
                            ? new Date(activity.submittedAt).toLocaleDateString("cs-CZ")
                            : "Datum není k dispozici"}
                        </p>
                      </div>
                      {activity.score !== null ? (
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">
                            {Math.round(activity.score)}%
                          </p>
                        </div>
                      ) : (
                        <Badge variant="neutral">Čeká na vyhodnocení</Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-slate-500">
                  Zatím žádné aktivity.
                </div>
              )}
            </Card>
          ) : (
            <RestrictedView description="Dashboard data nejsou k dispozici." />
          )}
        </PermissionGate>
      </div>

      {gamification && (
        <GamificationPanel
          xp={gamification.xp}
          level={gamification.level}
          nextLevelXp={gamification.nextLevelXp ?? null}
          achievements={gamification.achievements}
        />
      )}

      <PermissionGate
        permission={PermissionKey.MANAGE_TEACHERS}
        fallback={
          <RestrictedView description="Pouze vedení může plánovat týmové akce a spravovat učitele." />
        }
      >
        <RestrictedView description="Teacher overview není v UI napojený na backend." />
      </PermissionGate>

      <PermissionGate
        permission={PermissionKey.MANAGE_STUDENTS}
        fallback={<RestrictedView description="Správa tříd je dostupná pouze uživatelům s oprávněním MANAGE_STUDENTS." />}
      >
        <Card className="space-y-2 p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Badge variant="neutral">TODO</Badge>
            <span>Classrooms UI</span>
          </div>
          <p className="text-sm text-slate-600">
            Správa tříd v dashboardu není napojená na backend. Použij API pro class sections a enrollments.
          </p>
        </Card>
      </PermissionGate>
    </div>
    <LevelUpModal
      open={levelModalOpen}
      level={gamification?.level ?? 1}
      onOpenChange={setLevelModalOpen}
    />
    </>
  );
}

export default withGuard()(DashboardPage);
