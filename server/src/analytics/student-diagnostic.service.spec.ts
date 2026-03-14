import { buildStudentDiagnosticFromRecords } from './student-diagnostic.service';

describe('StudentDiagnosticService aggregation', () => {
  const baseRecord = {
    studentId: 'student-1',
  };

  it('returns empty summary for student with no submissions', () => {
    const result = buildStudentDiagnosticFromRecords('student-1', []);
    expect(result.summary).toEqual({
      subjectsCount: 0,
      topicsEvaluated: 0,
      weakTopicsCount: 0,
    });
    expect(result.subjects).toEqual([]);
    expect(result.weakestTopics).toEqual([]);
  });

  it('marks topic as GOOD when only correct answers exist', () => {
    const records = Array.from({ length: 3 }, (_, index) => ({
      questionId: `q-${index}`,
      questionText: `Q${index}`,
      studentAnswer: 'A',
      correctAnswer: 'A',
      attemptedAt: `2026-03-14T10:0${index}:00.000Z`,
      isCorrect: true,
      topicId: 'topic-1',
      topicName: 'Zlomky',
      subjectId: 'subject-1',
      subjectName: 'Matematika',
    }));

    const result = buildStudentDiagnosticFromRecords('student-1', records);
    expect(result.subjects[0]?.topics[0]?.status).toBe('GOOD');
    expect(result.subjects[0]?.topics[0]?.accuracy).toBe(1);
  });

  it('marks topic as WEAK when repeated wrong answers dominate', () => {
    const records = [
      {
        questionId: 'q-1',
        questionText: '1/2 + 1/3 = ?',
        studentAnswer: '2/5',
        correctAnswer: '5/6',
        attemptedAt: '2026-03-14T10:00:00.000Z',
        isCorrect: false,
        topicId: 'topic-1',
        topicName: 'Zlomky',
        subjectId: 'subject-1',
        subjectName: 'Matematika',
      },
      {
        questionId: 'q-1',
        questionText: '1/2 + 1/3 = ?',
        studentAnswer: '2/5',
        correctAnswer: '5/6',
        attemptedAt: '2026-03-14T11:00:00.000Z',
        isCorrect: false,
        topicId: 'topic-1',
        topicName: 'Zlomky',
        subjectId: 'subject-1',
        subjectName: 'Matematika',
      },
      {
        questionId: 'q-2',
        questionText: '3/4 - 1/2 = ?',
        studentAnswer: '1/4',
        correctAnswer: '1/4',
        attemptedAt: '2026-03-14T12:00:00.000Z',
        isCorrect: true,
        topicId: 'topic-1',
        topicName: 'Zlomky',
        subjectId: 'subject-1',
        subjectName: 'Matematika',
      },
    ];

    const result = buildStudentDiagnosticFromRecords('student-1', records);
    expect(result.subjects[0]?.topics[0]?.status).toBe('WEAK');
    expect(result.subjects[0]?.topics[0]?.accuracy).toBeCloseTo(1 / 3, 5);
    expect(result.subjects[0]?.topics[0]?.repeatedlyWrongQuestions).toEqual([
      {
        questionId: 'q-1',
        questionText: '1/2 + 1/3 = ?',
        wrongCount: 2,
      },
    ]);
  });

  it('groups multiple subjects independently', () => {
    const records = [
      {
        questionId: 'q-1',
        questionText: 'Fractions',
        studentAnswer: '2/5',
        correctAnswer: '5/6',
        attemptedAt: '2026-03-14T10:00:00.000Z',
        isCorrect: false,
        topicId: 'topic-math',
        topicName: 'Zlomky',
        subjectId: 'subject-math',
        subjectName: 'Matematika',
      },
      {
        questionId: 'q-2',
        questionText: 'Grammar',
        studentAnswer: 'podmět',
        correctAnswer: 'podmět',
        attemptedAt: '2026-03-14T11:00:00.000Z',
        isCorrect: true,
        topicId: 'topic-cz',
        topicName: 'Mluvnice',
        subjectId: 'subject-cz',
        subjectName: 'Český jazyk',
      },
      {
        questionId: 'q-3',
        questionText: 'Grammar 2',
        studentAnswer: 'přísudek',
        correctAnswer: 'přísudek',
        attemptedAt: '2026-03-14T12:00:00.000Z',
        isCorrect: true,
        topicId: 'topic-cz',
        topicName: 'Mluvnice',
        subjectId: 'subject-cz',
        subjectName: 'Český jazyk',
      },
      {
        questionId: 'q-4',
        questionText: 'Grammar 3',
        studentAnswer: 'shoda',
        correctAnswer: 'shoda',
        attemptedAt: '2026-03-14T13:00:00.000Z',
        isCorrect: true,
        topicId: 'topic-cz',
        topicName: 'Mluvnice',
        subjectId: 'subject-cz',
        subjectName: 'Český jazyk',
      },
    ];

    const result = buildStudentDiagnosticFromRecords('student-1', records);
    expect(result.summary.subjectsCount).toBe(2);
    expect(result.subjects.map((item) => item.subject)).toEqual([
      'Český jazyk',
      'Matematika',
    ]);
  });

  it('marks topics with fewer than 3 answers as INSUFFICIENT_DATA', () => {
    const records = [
      {
        questionId: 'q-1',
        questionText: 'Linear equation',
        studentAnswer: 'x=2',
        correctAnswer: 'x=3',
        attemptedAt: '2026-03-14T10:00:00.000Z',
        isCorrect: false,
        topicId: 'topic-1',
        topicName: 'Rovnice',
        subjectId: 'subject-1',
        subjectName: 'Matematika',
      },
      {
        questionId: 'q-2',
        questionText: 'Linear equation 2',
        studentAnswer: 'x=4',
        correctAnswer: 'x=4',
        attemptedAt: '2026-03-14T11:00:00.000Z',
        isCorrect: true,
        topicId: 'topic-1',
        topicName: 'Rovnice',
        subjectId: 'subject-1',
        subjectName: 'Matematika',
      },
    ];

    const result = buildStudentDiagnosticFromRecords('student-1', records);
    expect(result.subjects[0]?.topics[0]?.status).toBe('INSUFFICIENT_DATA');
  });

  it('limits sample mistakes to five most recent wrong answers', () => {
    const records = Array.from({ length: 6 }, (_, index) => ({
      questionId: `q-${index}`,
      questionText: `Question ${index}`,
      studentAnswer: `wrong-${index}`,
      correctAnswer: `correct-${index}`,
      attemptedAt: `2026-03-14T10:0${index}:00.000Z`,
      isCorrect: false,
      topicId: 'topic-1',
      topicName: 'Zlomky',
      subjectId: 'subject-1',
      subjectName: 'Matematika',
    }));

    const result = buildStudentDiagnosticFromRecords('student-1', records);
    expect(result.subjects[0]?.topics[0]?.sampleMistakes).toHaveLength(5);
    expect(result.subjects[0]?.topics[0]?.sampleMistakes[0]?.questionId).toBe('q-5');
  });
});
