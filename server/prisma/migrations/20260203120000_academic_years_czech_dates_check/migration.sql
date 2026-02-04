-- Enforce CZ school year format: starts 1 Sept, ends 31 Aug next year.
-- THIS STATE MUST BE IMPOSSIBLE: invalid dates in academic_years.

-- Fix existing rows with wrong end date (30.6. -> 31.8. of next year)
UPDATE "public"."academic_years"
SET "endsAt" = MAKE_DATE(EXTRACT(YEAR FROM "startsAt")::int + 1, 8, 31)
WHERE EXTRACT(MONTH FROM "endsAt") = 6 AND EXTRACT(DAY FROM "endsAt") = 30;

ALTER TABLE "public"."academic_years"
ADD CONSTRAINT "academic_years_czech_dates_check" CHECK (
  EXTRACT(DAY FROM "startsAt") = 1
  AND EXTRACT(MONTH FROM "startsAt") = 9
  AND EXTRACT(DAY FROM "endsAt") = 31
  AND EXTRACT(MONTH FROM "endsAt") = 8
  AND "endsAt" > "startsAt"
);
