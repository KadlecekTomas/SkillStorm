import { Prisma } from '@prisma/client';

export type WithId<T extends { id: string }> = T;

export type SelectOf<
  M extends keyof Prisma.TypeMap['model'],
> = Prisma.TypeMap['model'][M]['operations']['findUnique']['args']['select'];

export type IncludeOf<
  M extends keyof Prisma.TypeMap['model'],
> = Prisma.TypeMap['model'][M]['operations']['findUnique']['args']['include'];

export type Result<
  M extends keyof Prisma.TypeMap['model'],
  S,
> = Prisma.TypeMap['model'][M]['payload']['scalars'] &
  Prisma.SelectSubset<S, Record<string, unknown>>;
