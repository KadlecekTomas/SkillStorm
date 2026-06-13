"use client";

import { queryClient, type QueryKey } from "@/lib/query-client";

export type ListFilterPrimitive = string | number | boolean | null | undefined;
export type ListFilters = Record<string, ListFilterPrimitive>;

type NormalizeListFiltersOptions = {
  nullTokens?: string[];
};

const DEFAULT_NULL_TOKENS = ["ALL"];

function normalizePrimitive(
  value: ListFilterPrimitive,
  nullTokens: Set<string>,
): string | number | boolean | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || nullTokens.has(trimmed)) return null;
    return trimmed;
  }
  if (value === undefined) return null;
  return value;
}

export function normalizeListFilters<T extends ListFilters>(
  filters: T,
  options?: NormalizeListFiltersOptions,
): { [K in keyof T]: string | number | boolean | null } {
  const nullTokens = new Set(options?.nullTokens ?? DEFAULT_NULL_TOKENS);
  return Object.fromEntries(
    Object.entries(filters).map(([key, value]) => [
      key,
      normalizePrimitive(value, nullTokens),
    ]),
  ) as { [K in keyof T]: string | number | boolean | null };
}

function sortedEntries(filters: ListFilters): Array<[string, string | number | boolean | null]> {
  return Object.entries(filters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => [key, value ?? null]);
}

export function buildListQueryKey(resource: string, filters: ListFilters): QueryKey {
  const normalized = normalizeListFilters(filters);
  const signature = JSON.stringify(sortedEntries(normalized));
  return [resource, "__list", signature] as const;
}

export function buildListRequestParams(
  filters: ListFilters,
): Record<string, string | number | boolean> {
  const normalized = normalizeListFilters(filters);
  return Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => value !== null),
  ) as Record<string, string | number | boolean>;
}

export async function refreshListAfterMutation(args: {
  resource: string;
  refetch?: (() => Promise<unknown>) | null;
  invalidatePrefixes?: QueryKey[];
}): Promise<void> {
  queryClient.invalidateQueries([args.resource]);
  for (const prefix of args.invalidatePrefixes ?? []) {
    queryClient.invalidateQueries(prefix);
  }
  if (args.refetch) {
    await args.refetch();
  }
}
