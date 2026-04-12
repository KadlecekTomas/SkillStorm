"use client";

type RawFilterValue = string | null | undefined;

export type NormalizedClassroomsFilters = {
  selectedYearId: string | null;
  grade: string | null;
  search: string | null;
  teacherId: string | null;
  cursor: string | null;
  direction: "next" | "prev";
  limit: number;
};

function normalizeToken(value: RawFilterValue, options?: { stripAll?: boolean }): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (options?.stripAll && trimmed === "ALL") return null;
  return trimmed;
}

export function normalizeClassroomsFilters(input: {
  selectedYearId?: RawFilterValue;
  grade?: RawFilterValue;
  search?: RawFilterValue;
  teacherId?: RawFilterValue;
  cursor?: RawFilterValue;
  direction?: "next" | "prev" | null;
  limit?: number;
}): NormalizedClassroomsFilters {
  const selectedYearId = normalizeToken(input.selectedYearId);
  const grade = normalizeToken(input.grade, { stripAll: true });
  const search = normalizeToken(input.search);
  const teacherId = normalizeToken(input.teacherId, { stripAll: true });
  const cursor = normalizeToken(input.cursor);
  const direction = cursor ? (input.direction === "prev" ? "prev" : "next") : "next";
  const limit = typeof input.limit === "number" && Number.isFinite(input.limit) ? input.limit : 20;

  return {
    selectedYearId,
    grade,
    search,
    teacherId,
    cursor,
    direction,
    limit,
  };
}

export function normalizeClassroomsQueryParam(
  value: RawFilterValue,
  options?: { stripAll?: boolean },
): string | null {
  return normalizeToken(value, options);
}
