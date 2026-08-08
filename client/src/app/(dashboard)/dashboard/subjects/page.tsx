import { redirect } from "next/navigation";

export default function LegacyDashboardSubjectsPage(): never {
  redirect("/app/settings");
}
