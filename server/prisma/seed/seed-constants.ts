import { OrganizationType, SchoolGrade } from '@prisma/client';

export const ORG_IDS = {
  chodovicka: '11111111-2222-4000-8000-000000000001',
  edutoDemo: '11111111-2222-4000-8000-000000000002',
  pythonCommunity: '11111111-2222-4000-8000-000000000003',
} as const;

export const ORG_NAMES: Record<keyof typeof ORG_IDS, string> = {
  chodovicka: 'FZŠ Chodovická',
  edutoDemo: 'EduTo Demo Class',
  pythonCommunity: 'Komunitní kurz Python',
};

export const ORG_TYPES: Record<keyof typeof ORG_IDS, OrganizationType> = {
  chodovicka: OrganizationType.SCHOOL,
  edutoDemo: OrganizationType.PRIVATE,
  pythonCommunity: OrganizationType.COMMUNITY,
};

export const USER_EMAILS = {
  superadmin: 'superadmin@skillstorm.io',
  owner: 'owner@chodovicka.cz',
  director: 'director@chodovicka.cz',
  teacher: 'teacher@chodovicka.cz',
  student1: 'student1@chodovicka.cz',
  student2: 'student2@chodovicka.cz',
  parent: 'parent@chodovicka.cz',
} as const;

export const PASSWORDS = {
  default: 'SkillStorm123!',
};

export const CATALOG_SUBJECT_IDS = {
  math: '22222222-3333-4000-9000-000000000010',
  english: '22222222-3333-4000-9000-000000000011',
  informatics: '22222222-3333-4000-9000-000000000012',
} as const;

export const CATALOG_TOPIC_IDS = {
  mathFractions: '33333333-4444-4000-9000-000000000020',
  mathGeometry: '33333333-4444-4000-9000-000000000021',
  englishVocabulary: '33333333-4444-4000-9000-000000000022',
  englishGrammar: '33333333-4444-4000-9000-000000000023',
  itAlgorithms: '33333333-4444-4000-9000-000000000024',
  itSecurity: '33333333-4444-4000-9000-000000000025',
} as const;

export const SUBJECT_IDS = {
  math: '44444444-5555-4000-a000-000000000030',
  english: '44444444-5555-4000-a000-000000000031',
  informatics: '44444444-5555-4000-a000-000000000032',
} as const;

export const SUBJECT_LEVEL_IDS = {
  math: '55555555-6666-4000-a000-000000000040',
  english: '55555555-6666-4000-a000-000000000041',
  informatics: '55555555-6666-4000-a000-000000000042',
} as const;

export const TOPIC_LEVEL_IDS = {
  mathFractions: '66666666-7777-4000-a000-000000000050',
  englishVocabulary: '66666666-7777-4000-a000-000000000051',
  itAlgorithms: '66666666-7777-4000-a000-000000000052',
} as const;

export const MATERIAL_IDS = {
  algebraPdf: '77777777-8888-4000-a000-000000000060',
  grammarInteractive: '77777777-8888-4000-a000-000000000061',
} as const;

export const TEST_IDS = {
  math: '88888888-9999-4000-b000-000000000070',
  english: '88888888-9999-4000-b000-000000000071',
  informatics: '88888888-9999-4000-b000-000000000072',
} as const;

export const ACADEMIC_YEAR_ID =
  '99999999-aaaa-4000-b000-000000000080';

export const CLASS_SECTION_IDS = {
  chodovickaA: 'aaaa1111-bbbb-4000-b000-000000000090',
  chodovickaB: 'aaaa1111-bbbb-4000-b000-000000000091',
} as const;

export const ASSIGNMENT_IDS = {
  math: 'bbbb2222-cccc-4000-b000-0000000000a0',
  english: 'bbbb2222-cccc-4000-b000-0000000000a1',
  informatics: 'bbbb2222-cccc-4000-b000-0000000000a2',
} as const;

export const SUBMISSION_IDS = {
  mathStudent1: 'cccc3333-dddd-4000-b000-0000000000b0',
} as const;

export const DEFAULT_GRADE = SchoolGrade.GRADE_6;

export const RESPONSE_IDS = {
  mathQ1: 'dddd4444-eeee-4000-b000-0000000000c0',
  mathQ2: 'dddd4444-eeee-4000-b000-0000000000c1',
};
