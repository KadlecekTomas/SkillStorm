import { redirect } from "next/navigation";

export default function LegacyDashboardTeachersPage(): never {
  redirect("/app/people");
}
