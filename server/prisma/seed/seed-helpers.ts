import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { USER_EMAILS } from './seed-constants';

export const logStep = (message: string) =>
  console.log(`🌱 ${message}`);

export const logDone = (message: string) =>
  console.log(`✅ ${message}`);

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function getOrganizationById(prisma: PrismaClient, id: string) {
  return prisma.organization.findUniqueOrThrow({ where: { id } });
}

export async function getUserByEmail(prisma: PrismaClient, email: string) {
  return prisma.user.findUniqueOrThrow({ where: { email } });
}

export async function getMembershipId(
  prisma: PrismaClient,
  email: string,
  organizationId: string,
) {
  const membership = await prisma.membership.findFirstOrThrow({
    where: {
      organizationId,
      user: { email },
    },
    select: { id: true },
  });

  return membership.id;
}

export const SEED_USERS = {
  superadmin: USER_EMAILS.superadmin,
  director: USER_EMAILS.director,
  teacher: USER_EMAILS.teacher,
  student1: USER_EMAILS.student1,
  student2: USER_EMAILS.student2,
};
