"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PermissionKey, type OrganizationRole } from "@/types";
import { useTeachers } from "@/hooks/use-teachers";
import { DataTable } from "@/components/ui/table";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/lib/query-client";
import { fetchWithAuth } from "@/lib/http/client";
import { TeacherAccessManager } from "@/components/pages/settings/teachers/teacher-access-manager";
import { withGuard } from "@/lib/guard/withGuard";

const EMPTY_CLASSROOM_OPTIONS: Array<{
  id: string;
  label?: string | null;
  grade: string;
  section: string;
}> = [];

const MANAGEMENT_ROLES: OrganizationRole[] = ["OWNER", "DIRECTOR"];

function TeacherManagerPage(): React.JSX.Element {
  const { teachers, loading, error } = useTeachers();
  const classroomsQuery = useQuery<
    Array<{ id: string; label?: string | null; grade: string; section: string }>
  >({
    queryKey: ["teacher-access", "classrooms-options"],
    staleTime: 10_000,
    queryFn: async () => {
      const response = await fetchWithAuth<
        | Array<{
            id: string;
            label?: string | null;
            grade: string;
            section: string;
          }>
        | {
            data?: Array<{
              id: string;
              label?: string | null;
              grade: string;
              section: string;
            }>;
          }
      >("GET", "/class-sections");
      return Array.isArray(response) ? response : response?.data ?? [];
    },
  });

  const emptyState = (
    <div className="space-y-3 py-2">
      <p className="font-medium text-slate-800">Zatím tu nejsou žádní učitelé.</p>
      <Button asChild variant="outline" size="sm">
        <Link href="/app/people">Přejít do sekce Lidé</Link>
      </Button>
    </div>
  );

  return (
    <div className="space-y-6 rounded-3xl border border-slate-100 bg-white p-4 text-sm text-slate-600 shadow-soft sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Přístupy učitelů</h1>
          <p className="mt-1 text-sm text-slate-500">
            Určete, které třídy může každý učitel spravovat.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="w-fit shrink-0 px-2">
          <Link href="/app/people">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Lidé
          </Link>
        </Button>
      </div>

      {error && (
        <ErrorAlert
          title="Nepodařilo se načíst učitele"
          description={error}
        />
      )}

      <DataTable
        data={teachers}
        loading={loading}
        emptyState={emptyState}
        columns={[
          {
            key: "name",
            label: "Jméno",
            render: (row) => row.membership?.user?.name ?? "—",
          },
          {
            key: "email",
            label: "E-mail",
            render: (row) => row.membership?.user?.email ?? "—",
          },
          {
            key: "access",
            label: "Přístup ke třídám",
            render: (row) => (
              <TeacherAccessManager
                teacher={row}
                classrooms={
                  classroomsQuery.data ?? EMPTY_CLASSROOM_OPTIONS
                }
              />
            ),
          },
        ]}
      />
    </div>
  );
}

export default withGuard({
  requireRoles: MANAGEMENT_ROLES,
  requirePerms: [PermissionKey.MANAGE_TEACHERS],
  requireSchoolWorkspace: true,
})(TeacherManagerPage);
