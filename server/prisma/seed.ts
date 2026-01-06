import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      passwordHash,
      status: 'ACTIVE',
    },
    create: {
      email: 'admin@example.com',
      name: 'Super Admin',
      passwordHash,
      systemRole: 'SUPERADMIN',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Admin ready: admin@example.com / admin123');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
