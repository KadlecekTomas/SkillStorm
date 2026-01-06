import type { Prisma } from '@prisma/client';

export type WithId<T extends { id: string }> = T;

type FindUniqueArgs<M extends keyof Prisma.TypeMap['model']> =
  Prisma.TypeMap['model'][M]['operations']['findUnique']['args'];

export type SelectOf<M extends keyof Prisma.TypeMap['model']> =
  FindUniqueArgs<M> extends { select: infer S } ? S : never;

export type IncludeOf<M extends keyof Prisma.TypeMap['model']> =
  FindUniqueArgs<M> extends { include: infer I } ? I : never;

export type Result<
  M extends keyof Prisma.TypeMap['model'],
  S,
> = Prisma.TypeMap['model'][M]['payload']['scalars'] &
  Prisma.SelectSubset<S, Record<string, unknown>>;
