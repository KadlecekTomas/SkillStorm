import { redirect } from "next/navigation";

export default function LegacyTestsPage(): never {
  redirect("/app/tests");
}
