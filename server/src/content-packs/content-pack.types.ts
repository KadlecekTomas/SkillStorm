import type {
  CreateActivityDto,
  CreateActivityVersionDto,
} from '@/activity-engine/dto/activity.dto';
import type {
  CreateLessonExperienceDto,
  CreateLessonExperienceVersionDto,
  CreateLessonStageDto,
} from '@/lesson-experience/dto/lesson-experience.dto';
import type { SchoolGrade } from '@prisma/client';

/**
 * Stable curriculum reference used by authored content.
 *
 * Runtime importers resolve these external identifiers against a VERIFIED
 * CurriculumFrameworkRelease. Authored content must never persist database UUIDs.
 */
export type CurriculumOutcomeRef = {
  frameworkCode: string;
  outcomeExternalCode: string;
  role: 'PRIMARY' | 'SECONDARY' | 'SUPPORTING';
  rationale: string;
};

export type UniversalActivitySpec = {
  shell: CreateActivityDto;
  version: CreateActivityVersionDto;
  curriculum: CurriculumOutcomeRef[];
};

/**
 * Authored stages refer to an Activity by stable slug. The publication/import
 * pipeline resolves the slug to an immutable ActivityVersion UUID.
 */
export type AuthoredLessonStage = Omit<
  CreateLessonStageDto,
  'activityVersionId'
> & {
  activityRef?: string;
};

export type AuthoredLessonVersion = Omit<
  CreateLessonExperienceVersionDto,
  'stages'
> & {
  stages: AuthoredLessonStage[];
};

export type UniversalLessonSpec = {
  shell: CreateLessonExperienceDto;
  version: AuthoredLessonVersion;
  curriculum: CurriculumOutcomeRef[];
  /**
   * Existing machine-readable IT-0 year-plan IDs that this detailed Lesson
   * Experience materializes or expands. This prevents a second competing year plan.
   */
  yearPlanRefs: string[];
};

export type UniversalContentPack = {
  packId: string;
  version: number;
  subjectCode: string;
  title: string;
  description: string;
  /** Existing recommended whole-year pack remains the planning source of truth. */
  parentYearPackId: string;
  placement: {
    recommendedGrade: SchoolGrade;
    compatibleGrades: SchoolGrade[];
    /**
     * The RVP node defines the required outcome boundary. The concrete grade
     * placement remains a SkillStorm recommendation and can be overridden by ŠVP.
     */
    placementIsRecommendation: true;
  };
  activities: UniversalActivitySpec[];
  lessons: UniversalLessonSpec[];
};

export type SchoolAdapterCoverage =
  | 'COVERED'
  | 'PARTIAL'
  | 'GAP'
  | 'REUSE_EXISTING';

export type SchoolOutcomeAdapterEntry = {
  sourceOutcomeKey: string;
  sourceAnchor: string;
  /** Short paraphrase for human review; never treated as canonical RVP text. */
  sourceSummary: string;
  coverage: SchoolAdapterCoverage;
  lessonRefs: string[];
  existingExperienceRefs?: string[];
  note?: string;
};

/**
 * School adapters are provenance/mapping metadata only. They may change pacing,
 * emphasis and coverage review, but they never rewrite a UniversalContentPack.
 */
export type SchoolCurriculumAdapter = {
  adapterId: string;
  schoolLabel: string;
  curriculumVersionLabel: string;
  source: {
    documentTitle: string;
    sourceUrl: string;
    validFrom?: string;
  };
  subjectCode: string;
  grade: SchoolGrade;
  entries: SchoolOutcomeAdapterEntry[];
};
