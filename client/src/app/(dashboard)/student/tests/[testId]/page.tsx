"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { withGuard } from "@/lib/guard/withGuard";
import type { OrganizationRole } from "@/types";

function StudentTestPage() {
  const router = useRouter();
  const search = useSearchParams();
  const assignmentId = search.get("assignmentId");

  useEffect(() => {
    if (!assignmentId) return;
    router.replace(`/assignments/${assignmentId}`);
  }, [assignmentId, router]);

  if (assignmentId) {
    return <LoadingSpinner label="Přesměrovávám na zadání" />;
  }

  return (
    <div className="space-y-4">
      <Alert
        title="Chybí assignmentId"
        description="Otevři zadání ze seznamu assignments."
        variant="warning"
      />
      <Button asChild className="w-fit">
        <Link href="/dashboard/assignments">Přejít na assignments</Link>
      </Button>
    </div>
  );
}

const studentOnly: OrganizationRole[] = ["STUDENT"];

export default withGuard({
  requireRoles: studentOnly,
})(StudentTestPage);
