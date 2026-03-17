ALTER TABLE "public"."submissions"
ADD COLUMN "earned_points" INTEGER,
ADD COLUMN "max_points" INTEGER;

WITH response_points AS (
  SELECT
    r.submission_id,
    SUM(COALESCE(r.awarded_points, 0))::int AS earned_points,
    SUM(COALESCE(r.max_points, q.score, 1))::int AS max_points
  FROM "public"."responses" r
  LEFT JOIN "public"."questions" q ON q.question_id = r.question_id
  GROUP BY r.submission_id
),
test_points AS (
  SELECT
    s.submission_id,
    COALESCE(SUM(q.score), 0)::int AS max_points
  FROM "public"."submissions" s
  LEFT JOIN "public"."tests" t ON t.test_id = s.test_id
  LEFT JOIN "public"."questions" q ON q.test_id = t.test_id
  GROUP BY s.submission_id
)
UPDATE "public"."submissions" s
SET
  "earned_points" = CASE
    WHEN rp.earned_points IS NOT NULL THEN rp.earned_points
    WHEN s.score IS NOT NULL AND COALESCE(tp.max_points, 0) > 0 THEN ROUND(s.score * tp.max_points)::int
    ELSE NULL
  END,
  "max_points" = COALESCE(rp.max_points, tp.max_points, 0)
FROM test_points tp
LEFT JOIN response_points rp ON rp.submission_id = tp.submission_id
WHERE s.submission_id = tp.submission_id;
