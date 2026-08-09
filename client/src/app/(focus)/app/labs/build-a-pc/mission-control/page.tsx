import type { JSX } from 'react';
import { BuildPcAnalyticsDock } from '@/components/it-lab/build-pc/BuildPcAnalyticsDock';
import { BuildPcMissionControl } from '@/components/it-lab/build-pc/BuildPcMissionControl';

type MissionControlPageProps = {
  searchParams: Promise<{ session?: string | string[] }>;
};

export default async function MissionControlPage({ searchParams }: MissionControlPageProps): Promise<JSX.Element> {
  const params = await searchParams;
  const sessionId = Array.isArray(params.session) ? params.session[0] : params.session;
  const resolvedSessionId = sessionId ?? null;

  return (
    <>
      <BuildPcMissionControl sessionId={resolvedSessionId} />
      <BuildPcAnalyticsDock sessionId={resolvedSessionId} />
    </>
  );
}
