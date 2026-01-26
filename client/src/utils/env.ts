export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4200";

export const AUTH_DEBUG = process.env.NEXT_PUBLIC_AUTH_DEBUG === "1";

/**
 * Validates required environment variables at runtime.
 * Throws if critical configuration is missing in production.
 */
export const validateEnv = (): void => {
  if (typeof window === "undefined") {
    // Server-side: allow localhost fallback
    return;
  }

  // In production (non-localhost), API_BASE_URL must be explicitly set
  const isProduction = window.location.hostname !== "localhost" && 
                       window.location.hostname !== "127.0.0.1" &&
                       !window.location.hostname.startsWith("192.168.") &&
                       !window.location.hostname.startsWith("10.");

  if (isProduction && API_BASE_URL.includes("localhost")) {
    throw new Error(
      "NEXT_PUBLIC_API_URL must be set in production. " +
      "Current value points to localhost, which is not allowed."
    );
  }
};

// Validate on module load (client-side only)
if (typeof window !== "undefined") {
  try {
    validateEnv();
  } catch (error) {
    // In development, log warning instead of crashing
    if (process.env.NODE_ENV === "development") {
      console.warn("[ENV] Environment validation warning:", error);
    } else {
      // In production, fail loudly
      throw error;
    }
  }
}
