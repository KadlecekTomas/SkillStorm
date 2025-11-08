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
};

export function buildPermissionMarkdownTable(): string {
  const header = '| Permission | Description |\n| --- | --- |';
  const rows = Object.entries(PERMISSION_DESCRIPTIONS).map(
    ([key, description]) => `| ${key} | ${description} |`,
  );
  return [header, ...rows].join('\n');
}
