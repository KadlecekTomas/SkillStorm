"use client";

import { PermissionKey } from "@/types";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { RestrictedView } from "@/components/access/restricted-view";
import { withGuard } from "@/lib/guard/withGuard";
import { Badge } from "@/components/ui/badge";

function TestsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-100 bg-white p-6 shadow-soft">
        <div>
          <p className="text-sm text-slate-500">Test builder</p>
          <h2 className="text-xl font-semibold text-slate-900">Automated assessments</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">TODO</Badge>
          <Button
            variant="outline"
            disabled
            className="rounded-2xl"
            title="Test builder není implementovaný."
          >
            <PlusCircle className="h-4 w-4" />
            <span className="ml-2">Create test</span>
          </Button>
        </div>
      </div>
      <RestrictedView description="Test builder není implementovaný. Pro práci s testy použij API /tests." />
    </div>
  );
}

export default withGuard({
  requirePerms: [PermissionKey.CREATE_TEST],
})(TestsPage);
