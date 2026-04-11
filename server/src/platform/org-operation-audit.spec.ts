import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import {
  ORG_OPERATION_KEY,
  OrgOperationType,
} from '@/common/decorators/org-operation.decorator';
import { AcademicYearsController } from '@/academic-years/academic-years.controller';
import { CatalogController } from '@/catalog/catalog.controller';
import { ClassroomsController } from '@/classroom/classrooms.controller';
import { ClassSectionsController } from '@/classroom/class-sections.controller';
import { EventsController } from '@/events/events.controller';
import { GamificationController } from '@/gamification/gamification.controller';
import { InvitationsController } from '@/invites/invitations.controller';
import { InvitesController } from '@/invites/invites.controller';
import { MembershipsController } from '@/memberships/memberships.controller';
import { OrganizationsController } from '@/organizations/organizations.controller';
import { OrgSubjectController } from '@/org-subject/org-subject.controller';
import { SubjectsController } from '@/subject/subject.controller';
import { TeachersController } from '@/teachers/teachers.controller';
import { TopicsController } from '@/topic/topic.controller';
import { UsersController } from '@/users/users.controller';

describe('OrgOperation audit for onboarding/setup controllers', () => {
  const reflector = new Reflector();

  const authoringControllers = [
    AcademicYearsController,
    CatalogController,
    ClassroomsController,
    ClassSectionsController,
    EventsController,
    InvitationsController,
    InvitesController,
    MembershipsController,
    OrganizationsController,
    OrgSubjectController,
    SubjectsController,
    TeachersController,
    TopicsController,
    UsersController,
  ];

  it.each(authoringControllers.map((controller) => [controller.name, controller]))(
    '%s is classified as AUTHORING',
    (_name, controller) => {
      expect(
        reflector.get<OrgOperationType>(ORG_OPERATION_KEY, controller),
      ).toBe(OrgOperationType.AUTHORING);
    },
  );

  it('GamificationController is classified as EXECUTION', () => {
    expect(
      reflector.get<OrgOperationType>(ORG_OPERATION_KEY, GamificationController),
    ).toBe(OrgOperationType.EXECUTION);
  });
});
