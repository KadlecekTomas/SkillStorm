import { redirect } from "next/navigation";

export default function AdminSupportRedirectPage(): never {
  redirect("/app/platform/support");
}
