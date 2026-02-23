/**
 * Submission integrity verifier (read-only).
 * Checks: duplicate (assignment, student, attempt), cross-org, score vs recalculated.
 * Exit 1 if any violation.
 *
 * Usage: VERIFY_ORG_ID=<uuid> ts-node scripts/verify-submissions.ts
 */
import { PrismaClient } from '@prisma/client';
import { computeScore } from '../src/submissions/submission-scoring';

const prisma = new PrismaClient();

type Violation = { invariant: string; count: number; sampleIds: string[] };

const SCORE_TOLERANCE = 1e-5;

async function main() {
  const orgIdFilter = process.env.VERIFY_ORG_ID ?? undefined;
  const violations: Violation[] = [];

  const submissions = await prisma.submission.findMany({
    where: {
      ...(orgIdFilter ? { organizationId: orgIdFilter } : {}),
      deletedAt: null,
    },
    include: {
      assignment: { select: { organizationId: true } },
      student: { select: { organizationId: true } },
      responses: {
        select: {
          id: true,
          questionId: true,
          givenText: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      test: {
        select: {
          questions: {
            select: {
              id: true,
              type: true,
              correctAnswer: true,
              correctAnswers: true,
              score: true,
            },
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });

  const s1Bad = submissions.filter(
    (s) =>
      s.organizationId !== s.assignment?.organizationId ||
      s.organizationId !== s.student?.organizationId,
  );
  if (s1Bad.length > 0) {
    violations.push({
      invariant: 'S1_CROSS_ORG',
      count: s1Bad.length,
      sampleIds: s1Bad.slice(0, 10).map((s) => s.id),
    });
  }

  const groups = await prisma.submission.groupBy({
    by: ['organizationId', 'studentId', 'assignmentId', 'attemptNo'],
    ...(orgIdFilter ? { where: { organizationId: orgIdFilter } } : {}),
    _count: { id: true },
  });
  const dup = groups.filter((g) => (g._count && typeof g._count === 'object' && 'id' in g._count ? g._count.id : 0) > 1);
  if (dup.length > 0) {
    violations.push({
      invariant: 'S2_DUPLICATE_ATTEMPT',
      count: dup.length,
      sampleIds: dup
        .slice(0, 10)
        .map(
          (g) =>
            `${g.organizationId}:${g.assignmentId}:${g.studentId}:${g.attemptNo}`,
        ),
    });
  }

  // S3: answers changed after submit (response created/updated after submission.submittedAt)
  const responsesWithSubmission = await prisma.response.findMany({
    where: {
      submission: {
        ...(orgIdFilter ? { organizationId: orgIdFilter } : {}),
        submittedAt: { not: null },
      },
    },
    select: {
      id: true,
      submissionId: true,
      createdAt: true,
      updatedAt: true,
      submission: { select: { submittedAt: true } },
    },
  });
  const changedAfterSubmit = responsesWithSubmission.filter(
    (r) =>
      r.submission.submittedAt &&
      (r.updatedAt > r.submission.submittedAt ||
        r.createdAt > r.submission.submittedAt),
  );
  if (changedAfterSubmit.length > 0) {
    violations.push({
      invariant: 'S3_ANSWERS_CHANGED_AFTER_SUBMIT',
      count: changedAfterSubmit.length,
      sampleIds: changedAfterSubmit
        .slice(0, 10)
        .map((r) => `${r.submissionId}:${r.id}`),
    });
  }

  let scoreMismatch = 0;
  const scoreSample: string[] = [];
  for (const s of submissions) {
    if (s.submittedAt == null || s.score == null || !s.test?.questions?.length) continue;
    const questions = s.test.questions.map((q) => ({
      id: q.id,
      type: q.type,
      correctAnswer: q.correctAnswer,
      correctAnswers: q.correctAnswers,
      score: q.score ?? 1,
    }));
    const responses = s.responses.map((r) => ({
      id: r.id,
      questionId: r.questionId,
      givenText: r.givenText,
    }));
    const result = computeScore(questions, responses);
    if (result.unscorableQuestionIds.length > 0) continue;
    const diff = Math.abs((result.normalizedScore ?? 0) - s.score);
    if (diff > SCORE_TOLERANCE) {
      scoreMismatch++;
      if (scoreSample.length < 10) scoreSample.push(s.id);
    }
  }
  if (scoreMismatch > 0) {
    violations.push({
      invariant: 'S4_SCORE_MISMATCH',
      count: scoreMismatch,
      sampleIds: scoreSample,
    });
  }

  console.log('Submission integrity verifier');
  console.log('Scope:', orgIdFilter ? `org ${orgIdFilter}` : 'all organizations');
  console.log('Submissions checked:', submissions.length);
  console.log('');

  if (violations.length === 0) {
    console.log('OK — no invariant violations detected.');
    process.exit(0);
  }

  console.log('VIOLATIONS:');
  for (const v of violations) {
    console.log(`  ${v.invariant}: ${v.count} (sample: ${v.sampleIds.join(', ')})`);
  }
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
