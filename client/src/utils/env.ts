/** Frontend never knows backend URL. All API calls go via /api (Next.js proxy). */
export const API_BASE_PATH = "/api";

export const AUTH_DEBUG = process.env.NEXT_PUBLIC_AUTH_DEBUG === "1";
export const ENABLE_RBAC_TELEMETRY_CLIENT =
  process.env.NEXT_PUBLIC_ENABLE_RBAC_TELEMETRY_CLIENT === "1";
