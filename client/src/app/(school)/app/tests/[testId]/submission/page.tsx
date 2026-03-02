"use client";

import Link from "next/link";
import { InfoAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { withGuard } from "@/lib/guard/withGuard";
import type { OrganizationRole } from "@/types";

function TestSubmissionPage() {
  return (
    <div className="space-y-4">
      <InfoAlert
        title="Zastaralá cesta"
        description="Tento odkaz už nevede na student submission. Otevři zadání přes seznam úkolů."
      />
      <Button asChild className="w-fit">
        <Link href="/app/assignments">Přejít na assignments</Link>
      </Button>
    </div>
  );
}

const studentOnly: OrganizationRole[] = ["STUDENT"];

export default withGuard({
  requireRoles: studentOnly,
  requireSchoolWorkspace: true,
})(TestSubmissionPage);
