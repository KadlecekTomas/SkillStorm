import { Injectable, Logger } from '@nestjs/common';
import {
  AnalyticsDataQuality,
  AnalyticsSnapshotSource,
  Prisma,
} from '@prisma/client';

/**
 * Phase 2 — immutable analytics snapshots.
 *
 * Creates a {@link SubmissionFact} (+ one {@link ResponseFact} per Response) capturing the
 * historically valid context of a submitted attempt. The snapshot is the foundation of
 * long-term, multi-year student progress analytics and must never be mutated after creation.
 *
 * Design contract (see docs/analytics/student-progress-prisma-models.md):
 *  - Runs INSIDE the finish() transaction → fail-closed: a thrown error rolls back the submit.
 *  - Idempotent: if a SubmissionFact already exists for the submission, it is a no-op.
 *  - Missing NON-KEY context (studentId / classSection / topic / subject / year) must NOT throw;
 *    it degrades `dataQuality` to PARTIAL instead.
 *  - Never stores correctAnswerSnapshot / explanationSnapshot.
 */
@Injectable()
export class AnalyticsSnapshotService {
  private readonly logger = new Logger(AnalyticsSnapshotService.name);

  /**
   * Create the immutable analytics snapshot for a finished submission.
   *
   * @param tx           Prisma transaction client from the finish() flow.
   * @param submissionId The just-finished submission.
   * @param source       Provenance (defaults to LIVE_SUBMIT).
   */
  async createSubmissionSnapshot(
    tx: Prisma.TransactionClient,
    submissionId: string,
    source: AnalyticsSnapshotSource = AnalyticsSnapshotSource.LIVE_SUBMIT,
  ): Promise<{ created: boolean; submissionFactId?: string }> {
    // ── Idempotence: never create a duplicate fact for the same submission ────
    const existing = await tx.submissionFact.findUnique({
      where: { submissionId },
      select: { id: true },
    });
    if (existing) {
      return { created: false, submissionFactId: existing.id };
    }

    const submission = await tx.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        organizationId: true,
        studentId: true, // = Membership.id
        testId: true,
        assignmentId: true,
        attemptNo: true,
        earnedPoints: true,
        maxPoints: true,
        createdAt: true,
        submittedAt: true,
        student: { select: { userId: true } }, // Membership.userId
        assignment: {
          select: {
            yearId: true,
            classSectionId: true,
            topicLevelId: true,
            topicLevel: {
              select: {
                catalogTopicId: true,
                difficulty: true,
                subjectLevel: {
                  select: {
                    subject: {
                      select: { id: true, catalogSubjectId: true },
                    },
                  },
                },
              },
            },
          },
        },
        test: {
          select: {
            version: true,
            subjectId: true,
            subject: { select: { catalogSubjectId: true } },
            _count: { select: { questions: true } },
          },
        },
        responses: {
          select: {
            id: true,
            questionId: true,
            givenText: true,
            isCorrect: true,
            awardedPoints: true,
            maxPoints: true,
            corrected: true,
            attemptNumber: true,
            questionTextSnapshot: true,
            question: { select: { type: true, order: true } },
          },
        },
      },
    });

    // A finished submission must exist + be submitted. If not, this is a real
    // integrity error worth a rollback (fail-closed), not a PARTIAL.
    if (!submission) {
      throw new Error(
        `AnalyticsSnapshot: submission ${submissionId} not found in transaction`,
      );
    }
    if (!submission.submittedAt) {
      throw new Error(
        `AnalyticsSnapshot: submission ${submissionId} has no submittedAt; snapshot must run after finalize`,
      );
    }

    const assignment = submission.assignment;
    const test = submission.test;

    // ── Resolve identity anchors ─────────────────────────────────────────────
    const membershipId = submission.studentId;
    const userId = submission.student?.userId ?? null;
    // Student.id via unique Student.membershipId (resolve even if soft-deleted).
    const studentRecord = await tx.student.findUnique({
      where: { membershipId },
      select: { id: true },
    });
    const studentId = studentRecord?.id ?? null;

    // ── Historical context (frozen at submit time) ───────────────────────────
    const academicYearId = assignment?.yearId ?? null;
    const topicLevelId = assignment?.topicLevelId ?? null;
    const catalogTopicId = assignment?.topicLevel?.catalogTopicId ?? null;
    const difficulty = assignment?.topicLevel?.difficulty ?? null;

    const topicSubject = assignment?.topicLevel?.subjectLevel?.subject ?? null;
    const subjectId = test?.subjectId ?? topicSubject?.id ?? null;
    const catalogSubjectId = test?.subjectId
      ? (test?.subject?.catalogSubjectId ?? null)
      : (topicSubject?.catalogSubjectId ?? null);

    // classSection in effect at submit time: assignment first, else active enrollment.
    let classSectionId = assignment?.classSectionId ?? null;
    if (!classSectionId && studentId && academicYearId) {
      const enrollment = await tx.enrollment.findFirst({
        where: { studentId, yearId: academicYearId },
        select: { classSectionId: true },
      });
      classSectionId = enrollment?.classSectionId ?? null;
    }

    // ── Result aggregates ────────────────────────────────────────────────────
    const responses = submission.responses;
    const questionCount = test?._count?.questions ?? responses.length;
    const correctCount = responses.filter((r) => r.isCorrect === true).length;
    const incorrectCount = responses.filter(
      (r) => r.isCorrect === false,
    ).length;
    const unansweredCount = Math.max(
      0,
      questionCount - correctCount - incorrectCount,
    );

    const score = submission.earnedPoints ?? 0;
    const maxScore = submission.maxPoints ?? 0;
    const percentage =
      maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;

    const startedAt = submission.createdAt ?? null;
    const submittedAt = submission.submittedAt;
    const durationSec =
      startedAt && submittedAt
        ? Math.max(
            0,
            Math.floor((submittedAt.getTime() - startedAt.getTime()) / 1000),
          )
        : null;

    // ── Data quality: degrade to PARTIAL when non-key context is missing ──────
    const missing: string[] = [];
    if (!studentId) missing.push('studentId');
    if (!academicYearId) missing.push('academicYearId');
    if (!classSectionId) missing.push('classSectionId');
    if (!subjectId) missing.push('subjectId');
    if (!topicLevelId) missing.push('topicLevelId');
    const dataQuality =
      missing.length > 0
        ? AnalyticsDataQuality.PARTIAL
        : AnalyticsDataQuality.COMPLETE;

    if (missing.length > 0) {
      this.logger.warn(
        `AnalyticsSnapshot PARTIAL for submission ${submissionId}: missing ${missing.join(', ')}`,
      );
    }

    // userId is a non-null FK on Membership; treat its absence as a real error.
    if (!userId) {
      throw new Error(
        `AnalyticsSnapshot: submission ${submissionId} membership has no userId`,
      );
    }

    // ── Persist (create-only; uniqueness on submissionId guards duplicates) ──
    const fact = await tx.submissionFact.create({
      data: {
        submissionId: submission.id,
        assignmentId: submission.assignmentId,
        testId: submission.testId,
        testVersion: test?.version ?? 1,
        organizationId: submission.organizationId,
        userId,
        membershipId,
        studentId,
        academicYearId,
        classSectionId,
        subjectId,
        catalogSubjectId,
        topicLevelId,
        catalogTopicId,
        attemptNo: submission.attemptNo,
        score,
        maxScore,
        percentage,
        questionCount,
        correctCount,
        incorrectCount,
        unansweredCount,
        startedAt,
        submittedAt,
        durationSec,
        dataQuality,
        source,
      },
      select: { id: true },
    });

    if (responses.length > 0) {
      await tx.responseFact.createMany({
        data: responses.map((r) => ({
          submissionFactId: fact.id,
          submissionId: submission.id,
          responseId: r.id,
          organizationId: submission.organizationId,
          userId,
          membershipId,
          studentId,
          academicYearId,
          questionId: r.questionId,
          questionOrder: r.question?.order ?? null,
          questionType: r.question!.type,
          questionTextSnapshot: r.questionTextSnapshot ?? null,
          topicLevelId,
          catalogTopicId,
          subjectId,
          difficulty,
          score: r.awardedPoints ?? 0,
          maxScore: r.maxPoints ?? 0,
          isCorrect: r.isCorrect,
          corrected: r.corrected ?? false,
          attemptNumber: r.attemptNumber ?? 1,
          givenTextSnapshot: r.givenText ?? null,
          dataQuality,
        })),
        skipDuplicates: true,
      });
    }

    return { created: true, submissionFactId: fact.id };
  }
}
