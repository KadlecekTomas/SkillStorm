import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { TeachersController } from '@/teachers/teachers.controller';
import { OrgSubjectController } from '@/org-subject/org-subject.controller';
import {
  ORG_OPERATION_KEY,
  OrgOperationType,
} from '@/common/decorators/org-operation.decorator';

describe('classrooms optional endpoints readiness classification', () => {
  const reflector = new Reflector();

  it('marks TeachersController as AUTHORING so optional classroom support data is allowed in NOT_READY repair flow', () => {
    expect(
      reflector.get<OrgOperationType>(ORG_OPERATION_KEY, TeachersController),
    ).toBe(OrgOperationType.AUTHORING);
  });

  it('marks OrgSubjectController as AUTHORING so optional classroom support data is allowed in NOT_READY repair flow', () => {
    expect(
      reflector.get<OrgOperationType>(ORG_OPERATION_KEY, OrgSubjectController),
    ).toBe(OrgOperationType.AUTHORING);
  });
});
