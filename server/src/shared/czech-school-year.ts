import { BadRequestException } from '@nestjs/common';

/** CZ school year: 1 Sept – 31 Aug next year. Label YYYY/YYYY+1. */

/**
 * Derive Czech school year from start year. Enforces invariants.
 * @throws BadRequestException if startYear out of range
 */
export function deriveCzechSchoolYearFromStartYear(startYear: number): {
  startDate: Date;
  endDate: Date;
  label: string;
} {
  if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) {
    throw new BadRequestException('Neplatný rok školního roku (2000–2100).');
  }
  const endYear = startYear + 1;
  const startDate = new Date(Date.UTC(startYear, 8, 1)); // 1 Sept
  const endDate = new Date(Date.UTC(endYear, 7, 31)); // 31 Aug
  const label = `${startYear}/${endYear}`;
  return { startDate, endDate, label };
}

/**
 * Default Czech school year for current date. Used when creating org.
 */
export function getDefaultCzechSchoolYear(): {
  startDate: Date;
  endDate: Date;
  label: string;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1–12
  const startYear = month >= 9 ? year : year - 1;
  return deriveCzechSchoolYearFromStartYear(startYear);
}
