-- Migration: fix_subject_catalog_unique_constraint
--
-- Problem: migration 20260314170000_remove_subject_org_semantics created a
-- PARTIAL unique index (WHERE catalog_subject_id IS NOT NULL) instead of a
-- full UNIQUE constraint. PostgreSQL's ON CONFLICT clause — used by every
-- Prisma upsert — requires a full unique constraint, not a partial index.
-- The partial index made the constraint invisible to ON CONFLICT, causing:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Fix: replace the partial index with a proper UNIQUE constraint.
--
-- Why a full constraint is safe on a nullable column:
--   In PostgreSQL, NULL != NULL, so a UNIQUE constraint on a nullable column
--   already allows unlimited NULL values while enforcing uniqueness for
--   non-NULL values. The partial index was unnecessary.

DROP INDEX IF EXISTS subjects_catalog_subject_id_key;

ALTER TABLE subjects
  ADD CONSTRAINT subjects_catalog_subject_id_key
  UNIQUE (catalog_subject_id);
