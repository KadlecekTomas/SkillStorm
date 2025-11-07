import { OverviewCard } from "@/components/cards/overview-card";
import { TestCard } from "@/components/cards/test-card";
import { ClassroomList } from "@/components/content/classroom-list";
import { StudentProgress } from "@/components/content/student-progress";
import { TeacherOverview } from "@/components/content/teacher-overview";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/utils/api-client";
import {
  classroomSamples,
  testSamples,
} from "@/utils/sample-data";
import type { Classroom, TestSummary } from "@/types";
import { BookOpenCheck, NotebookTabs, Users2 } from "lucide-react";

async function fetchDashboardSnapshot() {
  try {
    const [{ data: classrooms }, { data: tests }] = await Promise.all([
      apiClient.get<Classroom[]>("/classrooms"),
      apiClient.get<TestSummary[]>("/tests"),
    ]);
    return {
      classrooms: classrooms ?? classroomSamples,
      tests: tests ?? testSamples,
    };
  } catch {
    return { classrooms: classroomSamples, tests: testSamples };
  }
}

export default async function DashboardPage() {
  const { classrooms, tests } = await fetchDashboardSnapshot();

  return (
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
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Latest tests</p>
              <p className="text-lg font-semibold text-slate-900">
                Completion & averages
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {tests.map((test) => (
              <TestCard key={test.id} test={test} />
            ))}
          </div>
        </Card>
        <StudentProgress
          items={[
            { id: "s1", name: "Emily Park", progress: 78, trend: 6 },
            { id: "s2", name: "Joshua Chen", progress: 64, trend: -2 },
            { id: "s3", name: "Sara Patel", progress: 88, trend: 4 },
            { id: "s4", name: "Leo Kramer", progress: 59, trend: 3 },
          ]}
        />
      </div>

      <TeacherOverview
        highlight={{
          title: "Teacher health",
          description: "4 lessons planned for next week. Shareable agenda ready.",
          metric: "Next sprint: STEM focus",
        }}
        actions={[
          { label: "View roadmap", href: "#" },
          { label: "Invite co-teacher", href: "#" },
        ]}
      />

      <ClassroomList classrooms={classrooms} />
    </div>
  );
}
