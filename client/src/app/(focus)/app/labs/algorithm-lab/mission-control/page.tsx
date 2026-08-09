import type { JSX } from 'react';
import { AlgorithmLabMissionControl } from '@/components/it-lab/algorithm-lab/AlgorithmLabMissionControl';

type MissionControlPageProps = {
  searchParams: Promise<{ session?: string | string[] }>;
};

export default async function MissionControlPage({ searchParams }: MissionControlPageProps): Promise<JSX.Element> {
  const params = await searchParams;
  const sessionId = Array.isArray(params.session) ? params.session[0] : params.session;

  return <AlgorithmLabMissionControl sessionId={sessionId ?? null} />;
}
