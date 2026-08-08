import { redirect } from "next/navigation";

export default function LegacyDashboardSettingsPage(): never {
  redirect("/app/settings");
}
