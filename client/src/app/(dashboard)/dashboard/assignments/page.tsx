import { redirect } from "next/navigation";

export default function LegacyAssignmentsPage(): never {
  redirect("/app/assignments");
}
