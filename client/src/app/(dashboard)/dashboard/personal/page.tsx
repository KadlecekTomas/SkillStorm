import { redirect } from "next/navigation";

export default function LegacyPersonalDashboardPage(): never {
  redirect("/app/personal");
}
