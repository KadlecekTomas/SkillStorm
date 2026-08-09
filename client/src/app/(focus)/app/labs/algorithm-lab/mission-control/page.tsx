import type { JSX } from 'react';
import { AlgorithmLabMissionControl } from '@/components/it-lab/algorithm-lab/AlgorithmLabMissionControl';
import { AlgorithmLabQuickStart } from '@/components/it-lab/algorithm-lab/AlgorithmLabQuickStart';

type MissionControlPageProps = {
  searchParams: Promise<{ session?: string | string[] }>;
};

export default async function MissionControlPage({ searchParams }: MissionControlPageProps): Promise<JSX.Element> {
  const params = await searchParams;
  const sessionId = Array.isArray(params.session) ? params.session[0] : params.session;

  if (!sessionId) return <AlgorithmLabQuickStart />;
  return <AlgorithmLabMissionControl sessionId={sessionId} />;
}
