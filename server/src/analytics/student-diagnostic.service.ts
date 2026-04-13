import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentStatus, Prisma, SystemRole } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import { buildCompletedStudentSubmissionWhere } from '@/student/student-analytics-query.util';
import type {
  StudentDiagnosticResponse,
  StudentDiagnosticStatus,
} from '@/student/dto/student-diagnostic.dto';

const MIN_ANSWERS_FOR_CONFIDENT_STATUS = 3;
const MAX_SAMPLE_MISTAKES = 5;
const MAX_REPEATED_QUESTIONS = 5;
const UNASSIGNED_TOPIC_PREFIX = 'unassigned-topic:';
const UNKNOWN_SUBJECT_ID = 'unknown-subject';
const UNKNOWN_SUBJECT_NAME = 'Neznámý předmět';
const UNASSIGNED_TOPIC_NAME = 'Bez tématu';

type DiagnosticRecord = {
  questionId: string;
  questionText: string;
  studentAnswer: string;
  correctAnswer: string | null;
  attemptedAt: string | null;
  isCorrect: boolean;
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
};

type WrongQuestionBucket = {
  questionId: string;
  questionText: string;
  wrongCount: number;
};

type TopicBucket = {
  topicId: string;
  topic: string;
  subjectId: string;
  subject: string;
  totalAnswers: number;
  correctAnswers: number;
  wrongAnswers: number;
  sampleMistakes: Array<{
    questionId: string;
    questionText: string;
    studentAnswer: string;
    correctAnswer: string | null;
    attemptedAt: string | null;
  }>;
  wrongQuestions: Map<string, WrongQuestionBucket>;
};

export function diagnosticStatusForTopic(
  accuracy: number,
  totalAnswers: number,
): StudentDiagnosticStatus {
  if (totalAnswers < MIN_ANSWERS_FOR_CONFIDENT_STATUS) {
    return 'INSUFFICIENT_DATA';
  }
  if (accuracy < 0.5) return 'WEAK';
  if (accuracy < 0.75) return 'WARNING';
  return 'GOOD';
}

export function buildStudentDiagnosticFromRecords(
  studentId: string,
  records: DiagnosticRecord[],
): StudentDiagnosticResponse {
  const topicBuckets = new Map<string, TopicBucket>();

  for (const record of records) {
    const topicKey = `${record.subjectId}::${record.topicId}`;
    const bucket =
      topicBuckets.get(topicKey) ??
      {
        topicId: record.topicId,
        topic: record.topicName,
        subjectId: record.subjectId,
        subject: record.subjectName,
        totalAnswers: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        sampleMistakes: [],
        wrongQuestions: new Map<string, WrongQuestionBucket>(),
      };

    bucket.totalAnswers += 1;
    if (record.isCorrect) {
      bucket.correctAnswers += 1;
    } else {
      bucket.wrongAnswers += 1;
      bucket.sampleMistakes.push({
        questionId: record.questionId,
        questionText: record.questionText,
        studentAnswer: record.studentAnswer,
        correctAnswer: record.correctAnswer,
        attemptedAt: record.attemptedAt,
      });
      const wrongQuestion =
        bucket.wrongQuestions.get(record.questionId) ??
        {
          questionId: record.questionId,
          questionText: record.questionText,
          wrongCount: 0,
        };
      wrongQuestion.wrongCount += 1;
      bucket.wrongQuestions.set(record.questionId, wrongQuestion);
    }

    topicBuckets.set(topicKey, bucket);
  }

  const subjectBuckets = new Map<
    string,
    StudentDiagnosticResponse['subjects'][number]
  >();

  for (const bucket of topicBuckets.values()) {
    const accuracy =
      bucket.totalAnswers > 0 ? bucket.correctAnswers / bucket.totalAnswers : 0;
    const status = diagnosticStatusForTopic(accuracy, bucket.totalAnswers);
    const topic = {
      topicId: bucket.topicId,
      topic: bucket.topic,
      totalAnswers: bucket.totalAnswers,
      correctAnswers: bucket.correctAnswers,
      wrongAnswers: bucket.wrongAnswers,
      accuracy,
      status,
      sampleMistakes: bucket.sampleMistakes
        .sort((a, b) => {
          const aTime = a.attemptedAt ? Date.parse(a.attemptedAt) : 0;
          const bTime = b.attemptedAt ? Date.parse(b.attemptedAt) : 0;
          return bTime - aTime;
        })
        .slice(0, MAX_SAMPLE_MISTAKES),
      repeatedlyWrongQuestions: Array.from(bucket.wrongQuestions.values())
        .filter((question) => question.wrongCount > 1)
        .sort((a, b) => b.wrongCount - a.wrongCount || a.questionText.localeCompare(b.questionText))
        .slice(0, MAX_REPEATED_QUESTIONS),
    };

    const subjectBucket =
      subjectBuckets.get(bucket.subjectId) ??
      {
        subjectId: bucket.subjectId,
        subject: bucket.subject,
        topics: [],
      };
    subjectBucket.topics.push(topic);
    subjectBuckets.set(bucket.subjectId, subjectBucket);
  }

  const subjects = Array.from(subjectBuckets.values())
    .map((subjectBucket) => ({
      ...subjectBucket,
      topics: [...subjectBucket.topics].sort((a, b) => {
        if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
        if (a.totalAnswers !== b.totalAnswers) return b.totalAnswers - a.totalAnswers;
        return a.topic.localeCompare(b.topic);
      }),
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));

  const weakestTopics = subjects
    .flatMap((subjectBucket) =>
      subjectBucket.topics.map((topic) => ({
        subjectId: subjectBucket.subjectId,
        subject: subjectBucket.subject,
        topicId: topic.topicId,
        topic: topic.topic,
        accuracy: topic.accuracy,
        totalAnswers: topic.totalAnswers,
        status: topic.status,
      })),
    )
    .filter((topic) => topic.totalAnswers > 0)
    .sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      if (a.totalAnswers !== b.totalAnswers) return b.totalAnswers - a.totalAnswers;
      return a.topic.localeCompare(b.topic);
    })
    .slice(0, 5);

  return {
    studentId,
    summary: {
      subjectsCount: subjects.length,
      topicsEvaluated: subjects.reduce((sum, subject) => sum + subject.topics.length, 0),
      weakTopicsCount: subjects.reduce(
        (sum, subject) =>
          sum + subject.topics.filter((topic) => topic.status === 'WEAK').length,
        0,
      ),
    },
    subjects,
    weakestTopics,
  };
}

@Injectable()
export class StudentDiagnosticService {
  private readonly logger = new Logger(StudentDiagnosticService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getStudentDiagnostic(
    studentId: string,
    user: JwtPayload,
    yearId?: string,
  ): Promise<StudentDiagnosticResponse> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        orgId: true,
        membershipId: true,
        deletedAt: true,
      },
    });

    if (!student || student.deletedAt) {
      throw new NotFoundException('Student nenalezen.');
    }

    if (
      user.systemRole !== SystemRole.SUPERADMIN &&
      user.organizationId != null &&
      student.orgId !== user.organizationId
    ) {
      throw new ForbiddenException('Nemáš oprávnění zobrazit detail tohoto žáka.');
    }

    if (yearId) {
      const yearRecord = await this.prisma.academicYear.findFirst({
        where: { id: yearId, orgId: student.orgId, deletedAt: null },
        select: { id: true },
      });
      if (!yearRecord) {
        throw new BadRequestException({
          code: 'INVALID_YEAR',
          message: 'Zadaný školní rok nebyl nalezen v této organizaci.',
        });
      }
    }

    const responses = await this.prisma.response.findMany({
      where: {
        isCorrect: { not: null },
        submission: buildCompletedStudentSubmissionWhere({
          membershipId: student.membershipId,
          orgId: student.orgId,
          ...(yearId ? { yearId } : {}),
        }),
      },
      select: {
        givenText: true,
        isCorrect: true,
        correctAnswerSnapshot: true,
        questionTextSnapshot: true,
        createdAt: true,
        submission: {
          select: {
            submittedAt: true,
            assignment: {
              select: {
                topicLevelId: true,
                topicLevel: {
                  select: {
                    id: true,
                    name: true,
                    catalogTopic: { select: { name: true } },
                    subjectLevel: {
                      select: {
                        subject: {
                          select: {
                            id: true,
                            name: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            test: {
              select: {
                subject: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        question: {
          select: {
            id: true,
            text: true,
            correctAnswer: true,
            correctAnswers: true,
          },
        },
      },
      orderBy: [{ submission: { submittedAt: 'desc' } }, { createdAt: 'desc' }],
    });

    const records: DiagnosticRecord[] = responses.map((response) => {
      const topicLevel = response.submission.assignment.topicLevel;
      const subject =
        topicLevel?.subjectLevel.subject ?? response.submission.test.subject;
      const subjectId = subject?.id ?? UNKNOWN_SUBJECT_ID;
      const subjectName = subject?.name ?? UNKNOWN_SUBJECT_NAME;
      const topicId =
        response.submission.assignment.topicLevelId ??
        topicLevel?.id ??
        `${UNASSIGNED_TOPIC_PREFIX}${subjectId}`;
      const topicName =
        topicLevel?.name ??
        topicLevel?.catalogTopic?.name ??
        UNASSIGNED_TOPIC_NAME;
      const correctAnswer =
        response.correctAnswerSnapshot ??
        response.question.correctAnswer ??
        response.question.correctAnswers[0] ??
        null;

      return {
        questionId: response.question.id,
        questionText: response.questionTextSnapshot ?? response.question.text,
        studentAnswer: response.givenText,
        correctAnswer,
        attemptedAt:
          response.submission.submittedAt?.toISOString() ??
          response.createdAt.toISOString(),
        isCorrect: response.isCorrect === true,
        topicId,
        topicName,
        subjectId,
        subjectName,
      };
    });

    const fallbackCount = records.filter(
      (record) => record.topicName === UNASSIGNED_TOPIC_NAME,
    ).length;
    if (fallbackCount > 0) {
      this.logger.warn(
        `Student diagnostic fallback topic used for student ${student.id}: ${fallbackCount}/${records.length} responses without assignment.topicLevelId`,
      );
    }

    return buildStudentDiagnosticFromRecords(student.id, records);
  }
}
