import { PrismaClient } from '@prisma/client';
import { logDone, logStep } from './seed-helpers';

const BADGES = [
  {
    code: 'FIRST_TEST_COMPLETED',
    name: 'První dokončený test',
    description: 'Získáno za první odevzdaný test v organizaci.',
    iconKey: 'badge-first-test',
    xpReward: null,
  },
  {
    code: 'PERFECT_SCORE',
    name: 'Perfektní výsledek',
    description: 'Získáno za skóre 100 % v testu.',
    iconKey: 'badge-perfect-score',
    xpReward: null,
  },
  {
    code: 'ACTIVE_LEARNER',
    name: 'Aktivní student',
    description: 'Získáno za tři dokončené testy v organizaci.',
    iconKey: 'badge-active-learner',
    xpReward: null,
  },
];

export async function seed(prisma: PrismaClient) {
  logStep('Badges > seeding definitions');

  await prisma.badgeDefinition.createMany({
    data: BADGES,
    skipDuplicates: true,
  });

  logDone('Badge definitions ready');
}
