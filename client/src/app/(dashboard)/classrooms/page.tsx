"use client";

import { withPermission } from "@/components/access/with-permission";
import { PermissionKey } from "@/types";
import { RestrictedView } from "@/components/access/restricted-view";

function ClassroomsPage() {
  return (
    <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
      <h2 className="text-xl font-semibold text-slate-900">Classroom management</h2>
      <p className="text-sm text-slate-600">
        Tady brzy najdeš správu tříd, přiřazování studentů a plánování lekcí.
      </p>
      <RestrictedView description="Detailní správa tříd je postupně nasazována – sleduj aktualizace release notes." />
    </div>
  );
}

export default withPermission(PermissionKey.MANAGE_STUDENTS)(ClassroomsPage);
