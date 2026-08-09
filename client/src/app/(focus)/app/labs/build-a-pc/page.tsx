import type { JSX } from 'react';
import { BuildPcClassroomShell } from '@/components/it-lab/build-pc/BuildPcClassroomShell';

type BuildAPcPageProps = {
  searchParams: Promise<{ session?: string | string[] }>;
};

export default async function BuildAPcPage({ searchParams }: BuildAPcPageProps): Promise<JSX.Element> {
  const params = await searchParams;
  const sessionId = Array.isArray(params.session) ? params.session[0] : params.session;
  return <BuildPcClassroomShell sessionId={sessionId ?? null} />;
}
