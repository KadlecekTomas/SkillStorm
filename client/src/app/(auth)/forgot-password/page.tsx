import { redirect } from "next/navigation";

export default function ForgotPasswordLegacyPage(): never {
  redirect("/reset-password");
}
