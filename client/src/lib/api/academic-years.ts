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
