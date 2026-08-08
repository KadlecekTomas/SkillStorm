import { redirect } from "next/navigation";

export default function LegacyTestsAliasPage(): never {
  redirect("/app/tests");
}
