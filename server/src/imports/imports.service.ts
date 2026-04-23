import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import type { JwtPayload } from '@/auth/types/jwt-payload';
import {
  EnrollmentStatus,
  ImportStatus,
  OrganizationRole,
  Prisma,
  SystemRole,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

type ParsedCsvRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  className: string;
};

type ClassOption = {
  id: string;
  label: string;
};

type ValidationContext = {
  orgId: string;
  usernameModeEnabled: boolean;
  domainAlias: string | null;
  settings: {
    usernamePattern: string;
    initialPassword: string;
  };
  classOptions: ClassOption[];
  classMap: Map<string, ClassOption>;
  existingEmails: Set<string>;
  defaultClassLabel: string | null;
};

type ValidatedRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  class: string;
  status: 'VALID' | 'INVALID';
  errors: string[];
};

type PreviewRowInput = {
  firstName: string;
  lastName: string;
  email?: string;
  class: string;
};

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async previewStudents(
    input: {
      csv: string;
      fileName?: string;
      defaultClassSectionId?: string;
      academicYearId: string;
    },
    user: JwtPayload,
  ) {
    const orgId = this.assertOrg(user);
    const parsedRows = this.parseCsv(input.csv);
    const context = await this.buildValidationContext({
      orgId,
      academicYearId: input.academicYearId,
      parsedRows,
      ...(input.defaultClassSectionId
        ? { defaultClassSectionId: input.defaultClassSectionId }
        : {}),
    });
    const rows = this.validateRows(parsedRows, context);

    return {
      fileName: input.fileName ?? 'student-import.csv',
      summary: this.buildSummary(rows),
      rows,
      meta: {
        usernameModeEnabled: context.usernameModeEnabled,
        classOptions: context.classOptions,
        reservedEmails: Array.from(context.existingEmails),
      },
    };
  }

  async commitStudents(
    input: {
      rows: PreviewRowInput[];
      fileName?: string;
      defaultClassSectionId?: string;
      academicYearId: string;
    },
    user: JwtPayload,
  ) {
    const orgId = this.assertOrg(user);
    if (!user.membershipId) {
      throw new ForbiddenException('Missing membership context.');
    }
    if (!input.rows.length) {
      throw new BadRequestException('No rows to import.');
    }

    const syntheticRows: ParsedCsvRow[] = input.rows.map((row, index) => ({
      rowNumber: index + 1,
      firstName: row.firstName?.trim() ?? '',
      lastName: row.lastName?.trim() ?? '',
      email: row.email?.trim() ?? '',
      className: row.class?.trim() ?? '',
    }));

    const context = await this.buildValidationContext({
      orgId,
      academicYearId: input.academicYearId,
      parsedRows: syntheticRows,
      ...(input.defaultClassSectionId
        ? { defaultClassSectionId: input.defaultClassSectionId }
        : {}),
    });
    const rows = this.validateRows(syntheticRows, context);
    const validRows = rows.filter((row) => row.status === 'VALID');
    if (!validRows.length) {
      throw new BadRequestException('Nejsou k dispozici žádné validní řádky pro import.');
    }

    const batch = await this.prisma.importBatch.create({
      data: {
        organizationId: orgId,
        importedById: user.membershipId,
        fileName: input.fileName ?? 'student-import.csv',
        status: ImportStatus.PROCESSING,
      },
      select: { id: true },
    });

    const results: Array<{
      rowNumber: number;
      status: 'IMPORTED' | 'ERROR';
      message?: string;
    }> = [];
    const errors: Array<{ rowNumber: number; message: string }> = [];
    let createdUsers = 0;
    let createdMemberships = 0;
    let createdStudents = 0;
    let createdEnrollments = 0;

    for (const row of validRows) {
      const targetClass = context.classMap.get(this.normalizeClassName(row.class));
      if (!targetClass) {
        errors.push({
          rowNumber: row.rowNumber,
          message: `Třída "${row.class}" neexistuje.`,
        });
        results.push({
          rowNumber: row.rowNumber,
          status: 'ERROR',
          message: `Třída "${row.class}" neexistuje.`,
        });
        continue;
      }

      try {
        await this.prisma.$transaction(async (tx) => {
          const passwordHash = await bcrypt.hash(
            this.renderPattern(context.settings.initialPassword, row.firstName, row.lastName),
            10,
          );
          const email = row.email.trim().toLowerCase();
          const username = await this.ensureUniqueUsername(
            tx,
            this.buildUsernameBase(context.settings.usernamePattern, row.firstName, row.lastName, email),
          );

          const createdUser = await tx.user.create({
            data: {
              email,
              username,
              name: `${row.firstName} ${row.lastName}`.trim(),
              passwordHash,
              systemRole: null,
            },
            select: { id: true },
          });
          createdUsers += 1;

          const membership = await tx.membership.create({
            data: {
              userId: createdUser.id,
              organizationId: orgId,
              role: OrganizationRole.STUDENT,
            },
            select: { id: true },
          });
          createdMemberships += 1;

          const student = await tx.student.create({
            data: {
              membershipId: membership.id,
              orgId,
            },
            select: { id: true },
          });
          createdStudents += 1;

          await tx.enrollment.create({
            data: {
              studentId: student.id,
              classSectionId: targetClass.id,
              yearId: input.academicYearId,
              orgId,
              status: EnrollmentStatus.ACTIVE,
            },
          });
          createdEnrollments += 1;
        });

        results.push({ rowNumber: row.rowNumber, status: 'IMPORTED' });
      } catch (error) {
        const message = this.mapCommitError(error);
        this.logger.warn({
          message: 'Student import row failed',
          rowNumber: row.rowNumber,
          error: message,
        });
        errors.push({ rowNumber: row.rowNumber, message });
        results.push({ rowNumber: row.rowNumber, status: 'ERROR', message });
      }
    }

    const batchStatus = errors.length === validRows.length ? ImportStatus.FAILED : ImportStatus.DONE;
    await this.prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: batchStatus,
        processedAt: new Date(),
      },
    });

    return {
      batchId: batch.id,
      summary: {
        requestedRows: input.rows.length,
        importedRows: createdEnrollments,
        failedRows: errors.length,
        createdUsers,
        createdMemberships,
        createdStudents,
        createdEnrollments,
      },
      results,
      errors,
    };
  }

  private assertOrg(user: JwtPayload): string {
    if (user.systemRole === SystemRole.SUPERADMIN && user.organizationId) {
      return user.organizationId;
    }
    if (!user.organizationId) {
      throw new ForbiddenException('Missing organization context.');
    }
    return user.organizationId;
  }

  private async buildValidationContext(input: {
    orgId: string;
    academicYearId: string;
    defaultClassSectionId?: string;
    parsedRows: ParsedCsvRow[];
  }): Promise<ValidationContext> {
    const [settings, classSections] = await Promise.all([
      this.prisma.organizationSettings.findUnique({
        where: { orgId: input.orgId },
        select: {
          usernamePattern: true,
          initialPassword: true,
          domainAlias: true,
        },
      }),
      this.prisma.classSection.findMany({
        where: {
          orgId: input.orgId,
          yearId: input.academicYearId,
        },
        select: {
          id: true,
          label: true,
          grade: true,
          section: true,
        },
      }),
    ]);

    const classOptions = classSections.map((item) => ({
      id: item.id,
      label: item.label?.trim() || `${String(item.grade).replace('GRADE_', '')}.${item.section}`,
    }));
    const classMap = new Map<string, ClassOption>();
    classOptions.forEach((item) => {
      this.buildClassAliases(item.label).forEach((alias) => classMap.set(alias, item));
    });

    let defaultClassLabel: string | null = null;
    if (input.defaultClassSectionId) {
      const match = classOptions.find((item) => item.id === input.defaultClassSectionId);
      defaultClassLabel = match?.label ?? null;
    }

    const emailCandidates = new Set<string>();
    const usernameModeEnabled = Boolean(settings?.domainAlias?.trim());
    for (const row of input.parsedRows) {
      const normalizedEmail = row.email.trim().toLowerCase();
      if (normalizedEmail) {
        emailCandidates.add(normalizedEmail);
        continue;
      }
      if (usernameModeEnabled) {
        const generated = this.generateEmailFromPattern(
          settings?.usernamePattern ?? '{surname}{fi}{yy}',
          settings?.domainAlias ?? '',
          row.firstName,
          row.lastName,
        );
        if (generated) emailCandidates.add(generated);
      }
    }

    const existingUsers =
      emailCandidates.size > 0
        ? await this.prisma.user.findMany({
            where: {
              email: {
                in: Array.from(emailCandidates),
              },
            },
            select: { email: true },
          })
        : [];

    return {
      orgId: input.orgId,
      usernameModeEnabled,
      domainAlias: settings?.domainAlias?.trim() || null,
      settings: {
        usernamePattern: settings?.usernamePattern ?? '{surname}{fi}{yy}',
        initialPassword: settings?.initialPassword ?? 'ChangeMe!{yy}',
      },
      classOptions,
      classMap,
      existingEmails: new Set(
        existingUsers
          .map((item) => item.email?.trim().toLowerCase())
          .filter((item): item is string => Boolean(item)),
      ),
      defaultClassLabel,
    };
  }

  private validateRows(rows: ParsedCsvRow[], context: ValidationContext): ValidatedRow[] {
    const duplicateMap = new Map<string, number[]>();

    const normalizedRows = rows.map((row) => {
      const firstName = row.firstName.trim();
      const lastName = row.lastName.trim();
      const className = row.className.trim() || context.defaultClassLabel || '';
      const normalizedEmail = row.email.trim().toLowerCase();
      const email =
        normalizedEmail ||
        (context.usernameModeEnabled
          ? this.generateEmailFromPattern(
              context.settings.usernamePattern,
              context.domainAlias ?? '',
              firstName,
              lastName,
            )
          : '');

      if (email) {
        const bucket = duplicateMap.get(email) ?? [];
        bucket.push(row.rowNumber);
        duplicateMap.set(email, bucket);
      }

      return {
        rowNumber: row.rowNumber,
        firstName,
        lastName,
        email,
        class: className,
      };
    });

    return normalizedRows.map((row) => {
      const errors: string[] = [];

      if (!row.firstName) errors.push('Chybí jméno.');
      if (!row.lastName) errors.push('Chybí příjmení.');
      if (!row.email && !context.usernameModeEnabled) {
        errors.push('Email je povinný.');
      }
      if (row.email && !this.isValidEmail(row.email)) {
        errors.push('Email nemá platný formát.');
      }
      if (!row.class) {
        errors.push('Chybí třída.');
      } else if (!context.classMap.has(this.normalizeClassName(row.class))) {
        errors.push(`Třída "${row.class}" neexistuje.`);
      }
      if (row.email && (duplicateMap.get(row.email)?.length ?? 0) > 1) {
        errors.push('Duplicitní email v importu.');
      }
      if (row.email && context.existingEmails.has(row.email)) {
        errors.push('Email už v systému existuje.');
      }

      return {
        ...row,
        status: errors.length > 0 ? 'INVALID' : 'VALID',
        errors,
      };
    });
  }

  private buildSummary(rows: ValidatedRow[]) {
    const invalidRows = rows.filter((row) => row.status === 'INVALID').length;
    return {
      totalRows: rows.length,
      validRows: rows.length - invalidRows,
      invalidRows,
    };
  }

  private parseCsv(csv: string): ParsedCsvRow[] {
    if (!csv.trim()) {
      throw new BadRequestException('CSV soubor je prázdný.');
    }

    const rows = this.tokenizeCsv(csv)
      .map((row) => row.map((cell) => cell.trim()))
      .filter((row) => row.some((cell) => cell.length > 0));

    if (!rows.length) {
      throw new BadRequestException('CSV soubor neobsahuje žádná data.');
    }

    const header = rows[0]?.map((cell) => cell.replace(/^\ufeff/, '').toLowerCase()) ?? [];
    const hasHeader =
      header.includes('firstname') ||
      header.includes('first_name') ||
      header.includes('lastname') ||
      header.includes('last_name') ||
      header.includes('email') ||
      header.includes('class');

    const dataRows = hasHeader ? rows.slice(1) : rows;
    return dataRows.map((row, index) => ({
      rowNumber: index + 1,
      firstName: this.readColumn(row, header, hasHeader, ['firstname', 'first_name'], 0),
      lastName: this.readColumn(row, header, hasHeader, ['lastname', 'last_name'], 1),
      email: this.readColumn(row, header, hasHeader, ['email', 'mail'], 2),
      className: this.readColumn(row, header, hasHeader, ['class', 'classroom', 'trida'], 3),
    }));
  }

  private tokenizeCsv(csv: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < csv.length; i += 1) {
      const char = csv[i];
      const next = csv[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          currentCell += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && char === ',') {
        currentRow.push(currentCell);
        currentCell = '';
        continue;
      }

      if (!inQuotes && (char === '\n' || char === '\r')) {
        if (char === '\r' && next === '\n') i += 1;
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        continue;
      }

      currentCell += char;
    }

    currentRow.push(currentCell);
    rows.push(currentRow);
    return rows;
  }

  private readColumn(
    row: string[],
    header: string[],
    hasHeader: boolean,
    aliases: string[],
    fallbackIndex: number,
  ): string {
    if (!hasHeader) return row[fallbackIndex] ?? '';
    const index = aliases
      .map((alias) => header.indexOf(alias))
      .find((value) => value !== -1);
    return index !== undefined && index >= 0 ? row[index] ?? '' : '';
  }

  private normalizeClassName(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private buildClassAliases(label: string): string[] {
    const normalized = this.normalizeClassName(label);
    const match = label.match(/(\d+)\s*[\.\- ]?\s*([a-zA-Z0-9]+)/);
    if (!match) return [normalized];
    const grade = match[1];
    const section = match[2];
    return [
      normalized,
      this.normalizeClassName(`${grade}.${section}`),
      this.normalizeClassName(`${grade}${section}`),
      this.normalizeClassName(`${grade} ${section}`),
    ];
  }

  private normalizeIdentifier(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private buildUsernameBase(pattern: string, firstName: string, lastName: string, email: string) {
    const rendered = this.renderPattern(pattern, firstName, lastName);
    const fallback = email.split('@')[0] || `${lastName}${firstName.slice(0, 1)}`;
    return this.normalizeIdentifier(rendered || fallback || 'student').slice(0, 32);
  }

  private async ensureUniqueUsername(
    tx: Prisma.TransactionClient,
    baseInput: string,
  ): Promise<string> {
    const base = this.normalizeIdentifier(baseInput || 'student').slice(0, 24) || 'student';
    let candidate = base;
    let suffix = 1;

    for (;;) {
      const exists = await tx.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
      candidate = `${base}${suffix++}`;
    }
  }

  private renderPattern(pattern: string, firstName: string, lastName: string): string {
    const year = new Date().getFullYear();
    const safeFirst = this.normalizeIdentifier(firstName);
    const safeLast = this.normalizeIdentifier(lastName);

    return pattern
      .replaceAll('{firstname}', safeFirst)
      .replaceAll('{name}', safeFirst)
      .replaceAll('{lastname}', safeLast)
      .replaceAll('{surname}', safeLast)
      .replaceAll('{fi}', safeFirst.slice(0, 1))
      .replaceAll('{li}', safeLast.slice(0, 1))
      .replaceAll('{yy}', String(year).slice(-2))
      .replaceAll('{yyyy}', String(year));
  }

  private generateEmailFromPattern(
    pattern: string,
    domainAlias: string,
    firstName: string,
    lastName: string,
  ): string {
    const domain = domainAlias.trim().replace(/^@/, '');
    if (!domain) return '';
    const localPart = this.buildUsernameBase(pattern, firstName, lastName, '');
    return localPart ? `${localPart}@${domain}` : '';
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private mapCommitError(error: unknown): string {
    if (error instanceof BadRequestException || error instanceof ForbiddenException) {
      const response = error.getResponse();
      if (
        response &&
        typeof response === 'object' &&
        'message' in response &&
        typeof (response as { message?: unknown }).message === 'string'
      ) {
        return (response as { message: string }).message;
      }
      return error.message;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : '';
        if (target.includes('email')) return 'Email už v systému existuje.';
        if (target.includes('username')) return 'Nepodařilo se vytvořit unikátní username.';
      }
    }
    if (error instanceof Error) return error.message;
    return 'Import řádku se nezdařil.';
  }
}
