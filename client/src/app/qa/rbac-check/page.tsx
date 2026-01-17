"use client";

import { PermissionGate } from "@/components/access/permission-gate";
import { PermissionKey } from "@/types";
import { RestrictedView } from "@/components/access/restricted-view";

export default function RbacCheckPage(): React.JSX.Element {
  return (
    <div className="space-y-4 rounded-3xl border border-dashed border-slate-200 bg-white p-6 shadow-soft">
      <h1 className="text-xl font-semibold text-slate-900">
        RBAC Permission Checkpoint
      </h1>
      <p className="text-sm text-slate-600">
        Tato stránka slouží pro automatizované testy a vizuální ověření, že se RBAC gate chová
        správně pro různé role.
      </p>
      <PermissionGate
        permission={PermissionKey.CREATE_TEST}
        fallback={
          <RestrictedView description="Testovací uživatel nemá oprávnění CREATE_TEST – UI hlásí omezený přístup." />
        }
      >
        <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-700">
          Access granted – RBAC povolil CREATE_TEST.
        </div>
      </PermissionGate>
    </div>
  );
}
