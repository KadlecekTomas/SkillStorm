"use client";

import { withGuard } from "@/lib/guard/withGuard";
import { PermissionKey } from "@/types";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function CreateTestPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/tests");
  }, [router]);
  return null;
}

export default withGuard({
  requirePerms: [PermissionKey.CREATE_TEST],
})(CreateTestPage);
