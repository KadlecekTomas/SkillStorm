"use client";

import { withPermission } from "@/components/access/with-permission";
import { PermissionKey } from "@/types";
import { useTeachers } from "@/hooks/use-teachers";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useQuery } from "@/lib/query-client";
import { fetchWithAuth } from "@/lib/http/client";
import { TeacherAccessManager } from "@/components/pages/settings/teachers/teacher-access-manager";

const EMPTY_CLASSROOM_OPTIONS: Array<{ id: string; label?: string | null; grade: string; section: string }> = [];

function TeacherManagerPage(): React.JSX.Element {
  const { teachers, loading, error, total } = useTeachers();
  const classroomsQuery = useQuery<Array<{ id: string; label?: string | null; grade: string; section: string }>>({
    queryKey: ["teacher-access", "classrooms-options"],
    staleTime: 10_000,
    queryFn: async () => {
      const response = await fetchWithAuth<
        | Array<{ id: string; label?: string | null; grade: string; section: string }>
        | { data?: Array<{ id: string; label?: string | null; grade: string; section: string }> }
      >("GET", "/class-sections");
      return Array.isArray(response) ? response : response?.data ?? [];
    },
  });

  const emptyState = (
    <div className="space-y-3">
      <p>No teachers yet</p>
      <Button asChild variant="outline" size="sm">
        <Link href="/app/settings">Invite teacher</Link>
      </Button>
    </div>
  );

  return (
    <div className="space-y-6 rounded-3xl border border-slate-100 bg-white p-6 text-sm text-slate-600 shadow-soft">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Teachers</h1>
        <p className="mt-2">Teachers in your organization</p>
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
            label: "Name",
            render: (row) => row.membership?.user?.name ?? "—",
          },
          {
            key: "email",
            label: "Email",
            render: (row) => row.membership?.user?.email ?? "—",
          },
          {
            key: "role",
            label: "Role",
            render: (row) => (
              <Badge variant="info">
                {row.membership?.role ?? "TEACHER"}
              </Badge>
            ),
          },
          {
            key: "createdAt",
            label: "Created",
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
                classrooms={classroomsQuery.data ?? EMPTY_CLASSROOM_OPTIONS}
              />
            ),
          },
        ]}
      />

      {!loading && !error && total > 0 && (
        <p className="text-xs text-slate-500">Total teachers: {total}</p>
      )}
    </div>
  );
}

export default withPermission(PermissionKey.MANAGE_TEACHERS)(TeacherManagerPage);
