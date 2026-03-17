"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { storeReturnUrl } from "@/lib/auth-session";

export const useProtectedRoute = (): void => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      if (typeof window !== "undefined") {
        storeReturnUrl(window.location.pathname + window.location.search);
      }
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);
};
