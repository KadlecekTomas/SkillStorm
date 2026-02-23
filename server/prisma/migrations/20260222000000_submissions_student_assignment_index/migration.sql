-- Lookup by (studentId, assignmentId) for O(log n) when checking existing submissions / listing.
CREATE INDEX IF NOT EXISTS "submissions_student_id_assignment_id_idx" ON "submissions"("student_id", "assignment_id");
