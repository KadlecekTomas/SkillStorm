"use client";

import { withPermission } from "@/components/access/with-permission";
import { PermissionKey } from "@/types";
import { RestrictedView } from "@/components/access/restricted-view";

function SettingsPage() {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 text-sm text-slate-600 shadow-soft">
      <h2 className="text-xl font-semibold text-slate-900">Organization settings</h2>
      <p className="mt-2">
        Správa rolí, auditních logů a přístupů je dostupná pouze vedení. RBAC změny se nyní zapisují
        do audit logu a invalidují cache během sekund.
      </p>
      <RestrictedView description="Pro úpravu nastavení školy je nutné oprávnění MANAGE_TEACHERS." />
    </div>
  );
}

export default withPermission(PermissionKey.MANAGE_TEACHERS)(SettingsPage);
