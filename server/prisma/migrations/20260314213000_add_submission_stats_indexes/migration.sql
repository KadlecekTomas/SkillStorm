CREATE INDEX "submissions_organization_id_created_at_idx"
ON "submissions"("organization_id", "created_at");

CREATE INDEX "submissions_organization_id_assignment_id_student_id_idx"
ON "submissions"("organization_id", "assignment_id", "student_id");
