import axios from "axios";
import { reportForbiddenAccess } from "@/utils/rbac-telemetry";
import { API_BASE_URL } from "@/utils/env";
import { showToastOnce } from "@/utils/toast";
import { useAuthStore } from "@/store/use-auth-store";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname ?? "";
      const isAuthPage = path.startsWith("/login") || path.startsWith("/register");
      if (error.response?.status === 401) {
        useAuthStore.getState().logout();
        if (!isAuthPage) {
          showToastOnce("Relace vypršela. Přihlas se znovu.");
        }
      } else if (error.response?.status === 403) {
        reportForbiddenAccess(error);
        showToastOnce("Nemáš oprávnění pro tuto akci.", { type: "error" });
      }
    }
    return Promise.reject(error);
  },
);
