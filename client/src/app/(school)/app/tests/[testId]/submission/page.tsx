import { redirect } from "next/navigation";

export default function LegacySubmissionPage(): never {
  redirect("/app/assignments");
}
