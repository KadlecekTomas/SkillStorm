"use client";

import Link from "next/link";
import { PermissionKey, type OrganizationRole } from "@/types";
import { useTeachers } from "@/hooks/use-teachers";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Vlastník",
  DIRECTOR: "Ředitel",
  TEACHER: "Učitel",
  STUDENT: "Žák",
  PARENT: "Rodič",
};

function TeacherManagerPage(): React.JSX.Element {
  const { teachers, loading, error, total } = useTeachers();
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
      <div>
        <p className="font-medium text-slate-800">Zatím tu nejsou žádní učitelé.</p>
        <p className="mt-1 text-sm text-slate-500">
          Pozvěte prvního učitele a potom mu nastavte přístup ke třídám.
        </p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href="/app/settings">Pozvat učitele</Link>
      </Button>
    </div>
  );

  return (
    <div className="space-y-6 rounded-3xl border border-slate-100 bg-white p-6 text-sm text-slate-600 shadow-soft">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Učitelé</h1>
        <p className="mt-2">
          Učitelé školy a jejich přístupy ke třídám.
        </p>
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
            key: "role",
            label: "Role",
            render: (row) => {
              const role = row.membership?.role ?? "TEACHER";
              return (
                <Badge variant="info">
                  {ROLE_LABELS[role] ?? "Učitel"}
                </Badge>
              );
            },
          },
          {
            key: "createdAt",
            label: "Vytvořeno",
            render: (row) =>
              row.createdAt
                ? new Date(row.createdAt).toLocaleDateString("cs-CZ")
                : "—",
            className: "text-slate-500",
          },
          {
            key: "access",
            label: "Přístupy ke třídám",
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

      {!loading && !error && total > 0 && (
        <p className="text-xs text-slate-500">Celkem učitelů: {total}</p>
      )}
    </div>
  );
}

export default withGuard({
  requireRoles: MANAGEMENT_ROLES,
  requirePerms: [PermissionKey.MANAGE_TEACHERS],
  requireSchoolWorkspace: true,
})(TeacherManagerPage);
