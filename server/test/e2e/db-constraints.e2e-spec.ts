import { Test as NestTest } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';

type FkRow = {
  conname: string;
  confdeltype: string;
  table_name: string;
  ref_table: string;
  definition: string;
};

describe('DB constraints sanity (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await NestTest.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  const loadFk = async (name: string): Promise<FkRow | null> => {
    const rows = await prisma.$queryRaw<FkRow[]>`
      SELECT
        c.conname,
        c.confdeltype,
        (c.conrelid::regclass)::text AS table_name,
        (c.confrelid::regclass)::text AS ref_table,
        pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.conname = ${name}
    `;
    return rows[0] ?? null;
  };

  it('Assignment year-invariant FK exists and is ON DELETE RESTRICT', async () => {
    const fk = await loadFk('assignments_class_section_id_academic_year_id_fkey');

    expect(fk).not.toBeNull();
    expect(fk?.table_name).toContain('assignments');
    expect(fk?.ref_table).toContain('class_sections');
    expect(fk?.confdeltype).toBe('r'); // r = RESTRICT
    expect(fk?.definition).toContain('FOREIGN KEY (class_section_id, academic_year_id)');
    expect(fk?.definition).toContain('REFERENCES class_sections(class_section_id, academic_year_id)');
    expect(fk?.definition).toContain('ON DELETE RESTRICT');
  });

  it('Enrollment year-invariant FK exists and is ON DELETE RESTRICT', async () => {
    const fk = await loadFk('enrollments_class_section_id_academic_year_id_fkey');

    expect(fk).not.toBeNull();
    expect(fk?.table_name).toContain('enrollments');
    expect(fk?.ref_table).toContain('class_sections');
    expect(fk?.confdeltype).toBe('r'); // r = RESTRICT
    expect(fk?.definition).toContain('FOREIGN KEY (class_section_id, academic_year_id)');
    expect(fk?.definition).toContain('REFERENCES class_sections(class_section_id, academic_year_id)');
    expect(fk?.definition).toContain('ON DELETE RESTRICT');
  });

  it('Legacy single-column enrollment FK is absent (prevents accidental cascade)', async () => {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM pg_constraint
      WHERE conname = 'enrollments_class_section_id_fkey'
    `;

    expect(rows[0]?.count ?? 0).toBe(0);
  });
});
