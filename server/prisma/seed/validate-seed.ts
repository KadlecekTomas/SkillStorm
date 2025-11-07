import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Validating SkillStorm seed data...\n');

  const results = await Promise.all([
    prisma.user.count(),
    prisma.teacher.count(),
    prisma.student.count(),
    prisma.organization.count(),
    prisma.subject.count(),
    prisma.learningMaterial.count(),
    prisma.test.count(),
    prisma.assignment.count(),
    prisma.submission.count(),
    prisma.response.count(),
  ]);

  const [
    users,
    teachers,
    students,
    orgs,
    subjects,
    materials,
    tests,
    assignments,
    submissions,
    responses,
  ] = results;

  const expectations = {
    users: 5,
    teachers: 1,
    students: 2,
    orgs: 3,
    subjects: 9,
    materials: 2,
    tests: 3,
    assignments: 3,
    submissions: 1,
    responses: 2,
  };

  const report = [
    { label: '👥 Users', value: users, expected: expectations.users },
    { label: '🏫 Organizations', value: orgs, expected: expectations.orgs },
    { label: '👨‍🏫 Teachers', value: teachers, expected: expectations.teachers },
    { label: '👩‍🎓 Students', value: students, expected: expectations.students },
    { label: '📚 Subjects', value: subjects, expected: expectations.subjects },
    { label: '🧩 Materials', value: materials, expected: expectations.materials },
    { label: '🧠 Tests', value: tests, expected: expectations.tests },
    { label: '📝 Assignments', value: assignments, expected: expectations.assignments },
    { label: '📤 Submissions', value: submissions, expected: expectations.submissions },
    { label: '✅ Responses', value: responses, expected: expectations.responses },
  ];

  let passed = true;
  console.log('📊 Seed Data Health Report:');
  console.log('───────────────────────────────');

  for (const { label, value, expected } of report) {
    const ok = value >= expected;
    if (!ok) passed = false;
    console.log(`${ok ? '✅' : '❌'} ${label.padEnd(16)} → ${value} / ${expected}`);
  }

  console.log('───────────────────────────────');
  console.log(passed ? '\n🎉 Validation PASSED — all data present!' : '\n⚠️ Validation FAILED — missing or incomplete data.');
}

main()
  .catch((err) => {
    console.error('❌ Validation error:', err);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
