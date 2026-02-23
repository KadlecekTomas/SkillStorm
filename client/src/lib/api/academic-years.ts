"use client";

import { httpClient } from "@/lib/http/client";

export type CurrentAcademicYear = { id: string; name: string };

/**
 * Single source of truth for the current academic year.
 * GET /academic-years/current returns exactly one object or 409 when invariant is broken.
 */
export async function fetchCurrentAcademicYear(): Promise<CurrentAcademicYear> {
  return httpClient.get<CurrentAcademicYear>("/academic-years/current");
}

export type PromotionStatus = { promoted: boolean; toYearId?: string };

export type NextAcademicYear = { id: string; label: string } | null;

export type PromotionResult = {
  fromYearId: string;
  toYearId: string;
  classroomsCreated: number;
  studentsEnrolled: number;
};

export async function getPromotionStatus(
  fromYearId: string,
): Promise<PromotionStatus> {
  return httpClient.get<PromotionStatus>(
    `/academic-years/${encodeURIComponent(fromYearId)}/promotion-status`,
  );
}

export async function getNextAcademicYear(
  fromYearId: string,
): Promise<NextAcademicYear> {
  return httpClient.get<NextAcademicYear>(
    `/academic-years/${encodeURIComponent(fromYearId)}/next-year`,
  );
}

export async function promoteAcademicYear(
  fromYearId: string,
  toYearId: string,
): Promise<PromotionResult> {
  return httpClient.post<PromotionResult>(
    `/academic-years/${encodeURIComponent(fromYearId)}/promote`,
    { toYearId },
  );
}
