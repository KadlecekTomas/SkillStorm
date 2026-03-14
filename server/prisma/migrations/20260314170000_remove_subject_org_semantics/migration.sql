BEGIN;

-- 1) Canonicalize duplicate org-scoped Subject rows into a single global Subject.
CREATE TEMP TABLE _subject_canonical_map AS
SELECT
  s.subject_id AS old_subject_id,
  FIRST_VALUE(s.subject_id) OVER (
    PARTITION BY COALESCE(s.catalog_subject_id::text, lower(s.name))
    ORDER BY s.created_at ASC, s.subject_id ASC
  ) AS canonical_subject_id
FROM subjects s;

CREATE TEMP TABLE _subject_duplicates AS
SELECT old_subject_id, canonical_subject_id
FROM _subject_canonical_map
WHERE old_subject_id <> canonical_subject_id;

-- Normalize canonical rows to the widest grade span seen across duplicates.
UPDATE subjects target
SET
  grade_from = agg.grade_from,
  grade_to = agg.grade_to,
  name = agg.name
FROM (
  SELECT
    scm.canonical_subject_id,
    MIN(s.grade_from) AS grade_from,
    MAX(s.grade_to) AS grade_to,
    MIN(s.name) AS name
  FROM _subject_canonical_map scm
  JOIN subjects s ON s.subject_id = scm.old_subject_id
  GROUP BY scm.canonical_subject_id
) agg
WHERE target.subject_id = agg.canonical_subject_id;

-- 2) Move non-conflicting SubjectLevel rows to canonical subjects.
UPDATE subject_levels sl
SET subject_id = dup.canonical_subject_id
FROM _subject_duplicates dup
WHERE sl.subject_id = dup.old_subject_id
  AND NOT EXISTS (
    SELECT 1
    FROM subject_levels existing
    WHERE existing.subject_id = dup.canonical_subject_id
      AND existing.grade = sl.grade
  );

CREATE TEMP TABLE _duplicate_level_map AS
SELECT
  old_sl.subject_level_id AS old_level_id,
  canon_sl.subject_level_id AS canonical_level_id
FROM subject_levels old_sl
JOIN _subject_duplicates dup ON dup.old_subject_id = old_sl.subject_id
JOIN subject_levels canon_sl
  ON canon_sl.subject_id = dup.canonical_subject_id
 AND canon_sl.grade = old_sl.grade;

-- 3) Merge TopicLevel rows when duplicate SubjectLevels collapse.
CREATE TEMP TABLE _duplicate_topic_map AS
SELECT
  old_tl.topic_level_id AS old_topic_id,
  canon_tl.topic_level_id AS canonical_topic_id
FROM topic_levels old_tl
JOIN _duplicate_level_map dlm ON dlm.old_level_id = old_tl.subject_level_id
JOIN topic_levels canon_tl
  ON canon_tl.subject_level_id = dlm.canonical_level_id
 AND canon_tl.catalog_topic_id = old_tl.catalog_topic_id
 AND canon_tl.phase = old_tl.phase;

UPDATE assignments a
SET topic_level_id = tm.canonical_topic_id
FROM _duplicate_topic_map tm
WHERE a.topic_level_id = tm.old_topic_id;

UPDATE learning_materials lm
SET topic_level_id = tm.canonical_topic_id
FROM _duplicate_topic_map tm
WHERE lm.topic_level_id = tm.old_topic_id;

UPDATE material_assignments ma
SET topic_level_id = tm.canonical_topic_id
FROM _duplicate_topic_map tm
WHERE ma.topic_level_id = tm.old_topic_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'student_classrooms'
      AND column_name = 'topic_level_id'
  ) THEN
    EXECUTE $sql$
      UPDATE student_classrooms sc
      SET topic_level_id = tm.canonical_topic_id
      FROM _duplicate_topic_map tm
      WHERE sc.topic_level_id = tm.old_topic_id
    $sql$;
  END IF;
END $$;

UPDATE test_assignments ta
SET topic_level_id = tm.canonical_topic_id
FROM _duplicate_topic_map tm
WHERE ta.topic_level_id = tm.old_topic_id;

DELETE FROM topic_levels tl
USING _duplicate_topic_map tm
WHERE tl.topic_level_id = tm.old_topic_id;

UPDATE topic_levels tl
SET subject_level_id = dlm.canonical_level_id
FROM _duplicate_level_map dlm
WHERE tl.subject_level_id = dlm.old_level_id;

DELETE FROM subject_levels sl
USING _duplicate_level_map dlm
WHERE sl.subject_level_id = dlm.old_level_id;

-- 4) Repoint remaining FK tables from duplicate subjects to canonical subjects.
UPDATE tests t
SET subject_id = dup.canonical_subject_id
FROM _subject_duplicates dup
WHERE t.subject_id = dup.old_subject_id;

UPDATE learning_materials lm
SET subject_id = dup.canonical_subject_id
FROM _subject_duplicates dup
WHERE lm.subject_id = dup.old_subject_id;

INSERT INTO teacher_subjects (teacher_subject_id, teacher_id, subject_id)
SELECT gen_random_uuid(), ts.teacher_id, dup.canonical_subject_id
FROM teacher_subjects ts
JOIN _subject_duplicates dup ON dup.old_subject_id = ts.subject_id
ON CONFLICT (teacher_id, subject_id) DO NOTHING;

DELETE FROM teacher_subjects ts
USING _subject_duplicates dup
WHERE ts.subject_id = dup.old_subject_id;

INSERT INTO org_subjects (
  org_subject_id,
  organization_id,
  subject_id,
  is_enabled,
  is_custom,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  os.organization_id,
  dup.canonical_subject_id,
  os.is_enabled,
  os.is_custom,
  os.created_at,
  os.updated_at
FROM org_subjects os
JOIN _subject_duplicates dup ON dup.old_subject_id = os.subject_id
ON CONFLICT (organization_id, subject_id) DO UPDATE
SET
  is_enabled = org_subjects.is_enabled OR EXCLUDED.is_enabled,
  is_custom = org_subjects.is_custom OR EXCLUDED.is_custom,
  updated_at = GREATEST(org_subjects.updated_at, EXCLUDED.updated_at);

DELETE FROM org_subjects os
USING _subject_duplicates dup
WHERE os.subject_id = dup.old_subject_id;

DELETE FROM subjects s
USING _subject_duplicates dup
WHERE s.subject_id = dup.old_subject_id;

-- 5) Remove legacy org-scoped constraints/columns and establish global uniqueness.
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_organization_id_fkey;
DROP INDEX IF EXISTS subjects_organization_id_idx;
DROP INDEX IF EXISTS subjects_organization_id_is_active_idx;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_organization_id_catalog_subject_id_key;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_organization_id_name_key;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_name_key;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_catalog_subject_id_key;

ALTER TABLE subjects
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS is_active;

ALTER TABLE subjects
  ADD CONSTRAINT subjects_name_key UNIQUE (name);

CREATE UNIQUE INDEX IF NOT EXISTS subjects_catalog_subject_id_key
  ON subjects (catalog_subject_id)
  WHERE catalog_subject_id IS NOT NULL;

COMMIT;
