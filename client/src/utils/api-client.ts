import axios from "axios";
import { useAuthStore } from "@/store/use-auth-store";
import { toast } from "react-toastify";
import { reportForbiddenAccess } from "@/utils/rbac-telemetry";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("skillstorm_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined") {
      if (error.response?.status === 401) {
        localStorage.removeItem("skillstorm_token");
        useAuthStore.getState().logout();
        toast.error("Relace vypršela. Přihlas se znovu.");
      } else if (error.response?.status === 403) {
        reportForbiddenAccess(error);
        toast.error("Nemáš oprávnění pro tuto akci.");
      }
    }
    return Promise.reject(error);
  },
);
