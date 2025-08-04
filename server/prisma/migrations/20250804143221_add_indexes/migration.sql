-- CreateIndex
CREATE INDEX "Classroom_schoolId_idx" ON "Classroom"("schoolId");

-- CreateIndex
CREATE INDEX "Student_classroomId_idx" ON "Student"("classroomId");

-- CreateIndex
CREATE INDEX "Subject_schoolId_idx" ON "Subject"("schoolId");

-- CreateIndex
CREATE INDEX "Submission_studentId_idx" ON "Submission"("studentId");

-- CreateIndex
CREATE INDEX "Submission_testId_idx" ON "Submission"("testId");

-- CreateIndex
CREATE INDEX "Teacher_schoolId_idx" ON "Teacher"("schoolId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");
