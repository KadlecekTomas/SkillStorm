import { PrismaClient } from '@prisma/client';

/**
 * Sets isPlatformAdmin=true for user with email from PLATFORM_ADMIN_EMAIL.
 * Run after users seed. Optional – skip if env not set.
 */
export async function seed(prisma: PrismaClient) {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim();
  if (!email) return;

  const updated = await prisma.user.updateMany({
    where: { email },
    data: { isPlatformAdmin: true },
  });
  if (updated.count > 0) {
    console.log(`✅ Platform admin: ${email} marked as isPlatformAdmin`);
  }
}
