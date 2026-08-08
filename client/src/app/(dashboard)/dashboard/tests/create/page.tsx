import { redirect } from "next/navigation";

export default function LegacyCreateTestPage(): never {
  redirect("/app/tests/create");
}
