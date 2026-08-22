type StageLike = { stageKey: string };

type InteractiveLessonRoute = {
  key: 'ALGORITHM_LAB' | 'BUILD_PC';
  studentPath: (sessionId: string) => string;
  teacherPath: (sessionId: string) => string;
};

const ROUTES: InteractiveLessonRoute[] = [
  {
    key: 'ALGORITHM_LAB',
    studentPath: (sessionId) => `/app/labs/algorithm-lab?session=${encodeURIComponent(sessionId)}`,
    teacherPath: (sessionId) =>
      `/app/labs/algorithm-lab/mission-control?session=${encodeURIComponent(sessionId)}`,
  },
  {
    key: 'BUILD_PC',
    studentPath: (sessionId) => `/app/labs/build-a-pc?session=${encodeURIComponent(sessionId)}`,
    teacherPath: (sessionId) =>
      `/app/labs/build-a-pc/mission-control?session=${encodeURIComponent(sessionId)}`,
  },
];

function routeForStages(stages: StageLike[]): InteractiveLessonRoute | null {
  return ROUTES.find((route) => stages.some((stage) => stage.stageKey === route.key)) ?? null;
}

export function teacherMissionControlPath(
  sessionId: string,
  stages: StageLike[],
): string | null {
  return routeForStages(stages)?.teacherPath(sessionId) ?? null;
}

export function studentInteractiveLessonPath(
  sessionId: string,
  stage: StageLike | null | undefined,
): string | null {
  if (!stage) return null;
  return ROUTES.find((route) => route.key === stage.stageKey)?.studentPath(sessionId) ?? null;
}
