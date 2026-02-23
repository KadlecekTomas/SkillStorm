import { fetchWithAuth } from "@/lib/http/client";

export type ResetPasswordResult = {
  token: string;
  expiresAt: string;
};

/**
 * Admin-only: create a password reset token for a user.
 * Returns the token so the admin can send the link to the user.
 * Link format: ${origin}/reset-password/${token}
 */
export async function requestUserPasswordReset(userId: string): Promise<ResetPasswordResult> {
  const data = await fetchWithAuth<ResetPasswordResult>("POST", `/users/${userId}/reset-password`);
  return data as ResetPasswordResult;
}
