import 'reflect-metadata';
import { OrganizationRole } from '@prisma/client';
import { PERMISSION_KEY } from '../modules/rbac/permission.decorator';
import { ProgressController } from './progress.controller';

type PermissionedMethod =
  | 'context'
  | 'ownStudentDetail'
  | 'createCompetency'
  | 'createEntry'
  | 'sync'
  | 'createAttendance'
  | 'createIntervention'
  | 'resolveIntervention'
  | 'studentDetail'
  | 'schoolDashboard'
  | 'classDashboard'
  | 'guardianStudentDetail';

function requiredRoles(method: PermissionedMethod): OrganizationRole[] {
  const handler = ProgressController.prototype[method] as object;
  return (Reflect.getMetadata(PERMISSION_KEY, handler) ?? []) as OrganizationRole[];
}

describe('ProgressController leadership role contract', () => {
  it.each([
    'context',
    'createEntry',
    'sync',
    'createAttendance',
    'createIntervention',
    'resolveIntervention',
    'studentDetail',
    'classDashboard',
  ] as const)('%s permits teacher, director and school leadership', (method) => {
    expect(requiredRoles(method)).toEqual(
      expect.arrayContaining([
        OrganizationRole.TEACHER,
        OrganizationRole.DIRECTOR,
        OrganizationRole.OWNER,
      ]),
    );
  });

  it.each(['createCompetency', 'schoolDashboard'] as const)(
    '%s gives director and school leadership the same access',
    (method) => {
      const roles = requiredRoles(method);
      expect(roles).toEqual(
        expect.arrayContaining([
          OrganizationRole.DIRECTOR,
          OrganizationRole.OWNER,
        ]),
      );
      expect(roles).not.toContain(OrganizationRole.TEACHER);
    },
  );

  it('keeps student self progress strictly student-only', () => {
    expect(requiredRoles('ownStudentDetail')).toEqual([OrganizationRole.STUDENT]);
  });

  it('keeps guardian progress relationship-scoped instead of role-decorated', () => {
    expect(requiredRoles('guardianStudentDetail')).toEqual([]);
  });
});
