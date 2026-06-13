import { PermissionKey } from '@prisma/client';

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  [PermissionKey.CREATE_TEST]:
    'Allows creating new tests and assessments within the organization.',
  [PermissionKey.EDIT_TEST]:
    'Allows editing and reordering questions for existing tests.',
  [PermissionKey.DELETE_TEST]:
    'Allows archiving or deleting tests and their questions.',
  [PermissionKey.VIEW_RESULTS]:
    'Allows viewing aggregated results and individual submissions.',
  [PermissionKey.MANAGE_STUDENTS]:
    'Allows inviting students, editing enrollments, and assigning work.',
  [PermissionKey.MANAGE_TEACHERS]:
    'Allows inviting teachers and adjusting their organization roles.',
  [PermissionKey.VIEW_ANALYTICS]: 'View analytics',
  [PermissionKey.INVITE_STUDENTS]: 'Allows sharing invite links for students.',
  [PermissionKey.INVITE_TEACHERS]: 'Allows sharing invite links for teachers.',
  [PermissionKey.VIEW_TEST_OVERVIEW]:
    'Allows viewing the list of tests and aggregates (read-only).',
  [PermissionKey.MANAGE_TESTS]: 'Allows creating, editing, and deleting tests.',
  [PermissionKey.ASSIGN_TESTS]:
    'Allows creating and managing assignments (assign test to class).',
  [PermissionKey.VIEW_SUBMISSIONS]:
    'Allows viewing submission list and detail.',
  [PermissionKey.MANAGE_ASSIGNMENTS]:
    'Allows full assignment lifecycle management.',
  [PermissionKey.VIEW_OWN_ASSIGNMENTS]:
    'Allows viewing assignments where the user is an intended recipient (enrolled in class or in assignment students).',
  [PermissionKey.VIEW_CLASS_ASSIGNMENTS]:
    'Allows viewing assignments for classes where the user is the teacher.',
  [PermissionKey.VIEW_ORG_ASSIGNMENTS]:
    'Allows viewing all assignments in the organization.',
};

export function buildPermissionMarkdownTable(): string {
  const header = '| Permission | Description |\n| --- | --- |';
  const rows = Object.entries(PERMISSION_DESCRIPTIONS).map(
    ([key, description]) => `| ${key} | ${description} |`,
  );
  return [header, ...rows].join('\n');
}
