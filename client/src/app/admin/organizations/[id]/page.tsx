import { redirect } from "next/navigation";

export default async function AdminOrganizationRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/app/platform/organizations/${id}`);
}
