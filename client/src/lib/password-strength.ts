/**
 * Password policy: min 8 chars, at least 1 number, at least 1 letter.
 * Strength: low / medium / strong for UI indicator.
 */
export type PasswordStrength = "low" | "medium" | "strong";

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return "low";
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const len = password.length;
  if (len < 8 || !hasLetter || !hasNumber) return "low";
  if (len >= 12 || /[^a-zA-Z0-9]/.test(password)) return "strong";
  return "medium";
}

export function meetsPasswordPolicy(password: string): boolean {
  if (!password || password.length < 8) return false;
  if (!/[a-zA-Z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  return true;
}

export const PASSWORD_POLICY_MESSAGE =
  "Heslo musí mít alespoň 8 znaků, obsahovat alespoň jedno písmeno a jednu číslici.";
