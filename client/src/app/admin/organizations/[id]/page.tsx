import { redirect } from "next/navigation";

export default async function AdminOrganizationRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<never> {
  const { id } = await params;
  redirect(`/app/platform/organizations/${id}`);
}
