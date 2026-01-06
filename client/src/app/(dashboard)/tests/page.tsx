"use client";

import Link from "next/link";
import { PermissionKey } from "@/types";
import { PermissionGate } from "@/components/access/permission-gate";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { RestrictedView } from "@/components/access/restricted-view";
import { withGuard } from "@/lib/guard/withGuard";

function TestsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
        <div>
          <p className="text-sm text-slate-500">Test builder</p>
          <h2 className="text-xl font-semibold text-slate-900">Automated assessments</h2>
        </div>
        <PermissionGate
          permission={PermissionKey.CREATE_TEST}
          fallback={
            <Button variant="outline" disabled className="rounded-2xl">
              <PlusCircle className="h-4 w-4" />
              <span className="ml-2">Limited</span>
            </Button>
          }
        >
          <Button className="rounded-2xl" asChild>
            <Link href="/tests/create">
              <PlusCircle className="h-4 w-4" />
              <span className="ml-2">Create test</span>
            </Link>
          </Button>
        </PermissionGate>
      </div>
      <RestrictedView description="Integrace na detailní builder je ve vývoji. Zatím můžeš prohlížet testy přes API /tests." />
    </div>
  );
}

export default withGuard({
  requirePerms: [PermissionKey.CREATE_TEST],
})(TestsPage);
