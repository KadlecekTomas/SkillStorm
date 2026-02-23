"use client";

import { withPermission } from "@/components/access/with-permission";
import { PermissionKey } from "@/types";
import { useTeachers } from "@/hooks/use-teachers";
import { DataTable } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function TeacherManagerPage(): React.JSX.Element {
  const { teachers, loading, error, total } = useTeachers();

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
        ]}
      />

      {!loading && !error && total > 0 && (
        <p className="text-xs text-slate-500">Total teachers: {total}</p>
      )}
    </div>
  );
}

export default withPermission(PermissionKey.MANAGE_TEACHERS)(TeacherManagerPage);
