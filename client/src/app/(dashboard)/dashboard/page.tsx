"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OverviewCard } from "@/components/cards/overview-card";
import { TestCard } from "@/components/cards/test-card";
import { ClassroomList } from "@/components/content/classroom-list";
import { StudentProgress } from "@/components/content/student-progress";
import { TeacherOverview } from "@/components/content/teacher-overview";
import { Card } from "@/components/ui/card";
import { httpClient } from "@/lib/http/client";
import type { Classroom, TestSummary } from "@/types";
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

function DashboardPage() {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [classroomsLoading, setClassroomsLoading] = useState(false);
  const { can } = usePermissions();
  const { summary: gamification } = useGamification();
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const previousLevelRef = useRef<number | null>(null);

  const canSeeTests = can(PermissionKey.VIEW_RESULTS);
  const canManageStudents = can(PermissionKey.MANAGE_STUDENTS);

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
        if (data?.length) setTests(data);
      })
      .catch((error) => console.warn("Dashboard tests fallback:", error))
      .finally(() => {
        if (!cancelled) setTestsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canSeeTests]);

  useEffect(() => {
    let cancelled = false;
    if (!canManageStudents) {
      setClassroomsLoading(false);
      return;
    }
    setClassroomsLoading(true);
    httpClient
      .get<Classroom[]>("/classrooms")
      .then((data) => {
        if (cancelled) return;
        if (data?.length) setClassrooms(data);
      })
      .catch((error) => console.warn("Dashboard classrooms fallback:", error))
      .finally(() => {
        if (!cancelled) setClassroomsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canManageStudents]);

  const handleViewTest = (testId: string) => {
    console.log("CLICKED: test details", testId);
    router.push(`/dashboard/tests?test=${testId}`);
  };

  const handleManageClassroom = (classroom: Classroom) => {
    console.log("CLICKED: manage classroom", classroom.id);
    router.push(`/dashboard/classrooms?class=${classroom.id}`);
  };

  const handleTeacherAction = (href: string) => {
    console.log("CLICKED: teacher action", href);
    router.push(href);
  };

  return (
    <>
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {/* ✅ Fixed server/client separation – no function props passed */}
        <OverviewCard
          title="Active learners"
          value="248"
          delta="+12% vs last week"
          icon={<Users2 className="h-5 w-5" />}
        />
        <OverviewCard
          title="Assessments"
          value="32"
          delta="4 drafts awaiting"
          icon={<NotebookTabs className="h-5 w-5" />}
          accent="bg-blue-50 text-blue-600"
        />
        <OverviewCard
          title="Content assets"
          value="112"
          delta="+5 curated"
          icon={<BookOpenCheck className="h-5 w-5" />}
          accent="bg-amber-50 text-amber-600"
        />
      </div>

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
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {tests.map((test) => (
                  <TestCard key={test.id} test={test} onView={handleViewTest} />
                ))}
              </div>
            )}
          </Card>
        </PermissionGate>
        <PermissionGate
          permission={PermissionKey.VIEW_RESULTS}
          fallback={<RestrictedView description="Výukový pokrok je dostupný jen s oprávněním k výsledkům." />}
        >
          <StudentProgress
            items={[
              { id: "s1", name: "Emily Park", progress: 78, trend: 6 },
              { id: "s2", name: "Joshua Chen", progress: 64, trend: -2 },
              { id: "s3", name: "Sara Patel", progress: 88, trend: 4 },
              { id: "s4", name: "Leo Kramer", progress: 59, trend: 3 },
            ]}
          />
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
        <TeacherOverview
          highlight={{
            title: "Teacher health",
            description: "4 lessons planned for next week. Shareable agenda ready.",
            metric: "Next sprint: STEM focus",
          }}
          actions={[
            { label: "View roadmap", href: "/dashboard/tests" },
            { label: "Invite co-teacher", href: "/dashboard/classrooms" },
          ]}
          onAction={handleTeacherAction}
        />
      </PermissionGate>

      <PermissionGate
        permission={PermissionKey.MANAGE_STUDENTS}
        fallback={<RestrictedView description="Správa tříd je dostupná pouze uživatelům s oprávněním MANAGE_STUDENTS." />}
      >
        {classroomsLoading ? (
          <Card className="p-6">
            <LoadingSpinner label="Načítám třídy" />
          </Card>
        ) : (
          <ClassroomList classrooms={classrooms} onManage={handleManageClassroom} />
        )}
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
