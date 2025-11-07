import { PrismaClient } from '@prisma/client';
import {
  ORG_IDS,
  ORG_NAMES,
  ORG_TYPES,
} from './seed-constants';
import { logDone, logStep } from './seed-helpers';

const ORG_ADDRESSES = {
  [ORG_IDS.chodovicka]: {
    address: 'Chodovická 3600/22',
    city: 'Praha',
    country: 'CZ',
  },
  [ORG_IDS.edutoDemo]: {
    address: 'Remote',
    city: 'Online',
    country: 'CZ',
  },
  [ORG_IDS.pythonCommunity]: {
    address: 'Impact Hub D10',
    city: 'Brno',
    country: 'CZ',
  },
} as const;

export async function seed(prisma: PrismaClient) {
  logStep('Organizations > creating demo tenants');

  for (const key of Object.keys(ORG_IDS) as (keyof typeof ORG_IDS)[]) {
    const id = ORG_IDS[key];
    const base = ORG_ADDRESSES[id];

    await prisma.organization.upsert({
      where: { id },
      update: {
        name: ORG_NAMES[key],
        address: base.address,
        city: base.city,
        country: base.country,
        type: ORG_TYPES[key],
      },
      create: {
        id,
        name: ORG_NAMES[key],
        address: base.address,
        city: base.city,
        country: base.country,
        type: ORG_TYPES[key],
      },
    });

    await prisma.organizationSettings.upsert({
      where: { orgId: id },
      update: {
        usernamePattern: '{surname}{fi}{yy}',
        initialPassword: 'ChangeMe!{yy}',
        forceResetOnFirstLogin: true,
        domainAlias:
          key === 'chodovicka' ? 'chodovicka.cz' : undefined,
      },
      create: {
        id: `${id}-settings`,
        orgId: id,
        usernamePattern: '{surname}{fi}{yy}',
        initialPassword: 'ChangeMe!{yy}',
        forceResetOnFirstLogin: true,
        domainAlias: key === 'chodovicka' ? 'chodovicka.cz' : undefined,
      },
    });
  }

  logDone('Organizations ready');
}
