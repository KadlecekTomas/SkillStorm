"use client";

import { PermissionKey } from "@/types";
import { withGuard } from "@/lib/guard/withGuard";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function TestsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/tests");
  }, [router]);
  return null;
}

export default withGuard({
  requirePerms: [PermissionKey.CREATE_TEST, PermissionKey.EDIT_TEST],
})(TestsPage);
