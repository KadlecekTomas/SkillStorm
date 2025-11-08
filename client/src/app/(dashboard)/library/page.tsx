"use client";

import { withPermission } from "@/components/access/with-permission";
import { PermissionKey } from "@/types";
import { RestrictedView } from "@/components/access/restricted-view";

function LibraryPage() {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 text-slate-700 shadow-soft">
      <h2 className="text-xl font-semibold text-slate-900">Content library</h2>
      <p className="mt-2 text-sm">
        Portál pro sdílení materiálů učitelů bude dostupný v příštím releasu. Připrav si šablony
        a lesson plany – builder automaticky přebere oprávnění z RBAC.
      </p>
      <RestrictedView description="Potřebuješ oprávnění CREATE_TEST nebo EDIT_TEST, aby ses stal/a kurátorem obsahu." />
    </div>
  );
}

export default withPermission([PermissionKey.CREATE_TEST, PermissionKey.EDIT_TEST])(LibraryPage);
