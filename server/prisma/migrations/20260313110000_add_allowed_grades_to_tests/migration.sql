ALTER TABLE "public"."tests"
ADD COLUMN "allowed_grades" "public"."SchoolGrade"[] NOT NULL DEFAULT ARRAY[]::"public"."SchoolGrade"[];

/*
  Backfill strategy:
  1) Preferred truth for existing tests: grades already in live use via assignments -> class_sections.grade.
  2) Fallback for tests with no assignments yet: enabled SubjectLevel grades for the same subject.
     This preserves the closest existing business signal without fabricating unrelated grades.
  3) Tests with neither assignments nor enabled SubjectLevels remain [] and must be completed by a teacher before publish.
*/
WITH assignment_grades AS (
  SELECT
    a.test_id,
    array_agg(DISTINCT cs.grade ORDER BY cs.grade) AS grades
  FROM "public"."assignments" a
  JOIN "public"."class_sections" cs
    ON cs.class_section_id = a.class_section_id
   AND cs.academic_year_id = a.academic_year_id
  GROUP BY a.test_id
),
subject_level_grades AS (
  SELECT
    t.test_id,
    array_agg(DISTINCT sl.grade ORDER BY sl.grade) AS grades
  FROM "public"."tests" t
  JOIN "public"."subject_levels" sl
    ON sl.subject_id = t.subject_id
   AND sl.is_enabled = true
  GROUP BY t.test_id
)
UPDATE "public"."tests" t
SET "allowed_grades" = COALESCE(ag.grades, slg.grades, ARRAY[]::"public"."SchoolGrade"[])
FROM assignment_grades ag
FULL OUTER JOIN subject_level_grades slg
  ON slg.test_id = ag.test_id
WHERE t.test_id = COALESCE(ag.test_id, slg.test_id);

CREATE INDEX "tests_allowed_grades_gin_idx"
  ON "public"."tests"
  USING GIN ("allowed_grades");
