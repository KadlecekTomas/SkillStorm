"use client";

import { httpClient } from "@/lib/http/client";
import type { AcademicYear } from "@/types";

export async function fetchActiveAcademicYear(): Promise<AcademicYear> {
  return httpClient.get<AcademicYear>("/academic-years/active");
}
