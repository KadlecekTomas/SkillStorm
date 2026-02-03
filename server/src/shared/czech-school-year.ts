/**
 * Default Czech school year: starts 1 Sept, ends 31 Aug next year.
 * Label e.g. "2025/2026". Used when creating the first academic year for an organization.
 */
export function getDefaultCzechSchoolYear(): {
  startDate: Date;
  endDate: Date;
  label: string;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1–12
  // From September (9) onward, current school year started this calendar year.
  const startYear = month >= 9 ? year : year - 1;
  const endYear = startYear + 1;
  const startDate = new Date(Date.UTC(startYear, 8, 1)); // 1 Sept
  const endDate = new Date(Date.UTC(endYear, 7, 31)); // 31 Aug
  const label = `${startYear}/${endYear}`;
  return { startDate, endDate, label };
}
