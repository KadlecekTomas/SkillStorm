"use client";

import { isSafeRedirectPath } from "@/lib/safe-redirect";

const AUTH_STORAGE_KEY = "skillstorm_auth";
const ACADEMIC_YEAR_STORAGE_KEY = "skillstorm_academic_year";
const ACTIVE_MEMBERSHIP_STORAGE_KEY = "skillstorm_activeMembershipId";
const ACTIVE_MEMBERSHIP_SWITCHED_AT_STORAGE_KEY = "skillstorm_activeMembershipSwitchedAt";
const RETURN_URL_STORAGE_KEY = "returnUrl";
let logoutNavigationInProgress = false;

export const markLogoutNavigationInProgress = (): void => {
  logoutNavigationInProgress = true;
};

export const clearLogoutNavigationInProgress = (): void => {
  logoutNavigationInProgress = false;
};

export const isLogoutNavigationInProgress = (): boolean => logoutNavigationInProgress;

export const clearClientSessionArtifacts = (): void => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem(ACADEMIC_YEAR_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_MEMBERSHIP_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_MEMBERSHIP_SWITCHED_AT_STORAGE_KEY);
    window.sessionStorage.removeItem(RETURN_URL_STORAGE_KEY);
  }

  if (typeof document !== "undefined") {
    document.cookie = "ss_csrf=; Max-Age=0; Path=/; SameSite=Lax";
  }
};

export const storeReturnUrl = (path: string): void => {
  if (typeof window === "undefined") return;
  if (!isSafeRedirectPath(path)) return;
  window.sessionStorage.setItem(RETURN_URL_STORAGE_KEY, path);
};

export const readReturnUrl = (): string | null => {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(RETURN_URL_STORAGE_KEY);
  if (!value || !isSafeRedirectPath(value)) return null;
  return value;
};

export const clearReturnUrl = (): void => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(RETURN_URL_STORAGE_KEY);
};
