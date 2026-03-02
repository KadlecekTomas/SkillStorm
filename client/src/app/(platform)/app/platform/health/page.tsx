import { redirect } from "next/navigation";

// /platform/health has no dedicated page — the platform overview IS the health dashboard.
export default function PlatformHealthPage() {
  redirect("/app/platform");
}
