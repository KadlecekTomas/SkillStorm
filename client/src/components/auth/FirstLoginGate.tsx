"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const PASSWORD_CHANGE_PATH = "/change-password";

/** Prevents protected UI from rendering while the server requires a password change. */
export function FirstLoginGate({ children }: { children: ReactNode }): ReactNode {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const passwordChangeRequired =
    isAuthenticated && user?.mustChangePassword === true;

  useEffect(() => {
    if (
      !isLoading &&
      passwordChangeRequired &&
      pathname !== PASSWORD_CHANGE_PATH
    ) {
      router.replace(PASSWORD_CHANGE_PATH);
    }
  }, [isLoading, passwordChangeRequired, pathname, router]);

  if (passwordChangeRequired && pathname !== PASSWORD_CHANGE_PATH) {
    return <LoadingSpinner fullScreen label="Připravuji bezpečnou změnu hesla…" />;
  }

  return children;
}
