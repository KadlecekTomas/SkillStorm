import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateClassSectionDto } from './dto/create-classroom.dto';
import { JwtPayload } from 'src/auth/types/jwt-payload';
import { assertSameOrganization } from 'shared/access.utils';
import { UpdateClassroomDto } from './dto/update-classroom.dto';

@Injectable()
export class ClassroomService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateClassSectionDto, user: JwtPayload) {
    const year = await this.prisma.academicYear.findUnique({
      where: { id: dto.yearId },
      select: { orgId: true }, // u tebe je to orgId, ne organizationId
    });
    if (!year) throw new NotFoundException('Školní rok nebyl nalezen');

    assertSameOrganization(year.orgId, user, 'třída');

    return this.prisma.classSection.create({
      data: {
        orgId: year.orgId,
        yearId: dto.yearId,
        grade: dto.grade,
        section: dto.section,
        label: dto.label ?? null,
        teacherId: dto.teacherId ?? null,
      },
    });
  }

  async findAll(yearId: string, user: JwtPayload) {
    const year = await this.prisma.academicYear.findUnique({
      where: { id: yearId },
      select: { orgId: true },
    });
    if (!year) throw new NotFoundException('Školní rok nebyl nalezen');
    assertSameOrganization(year.orgId, user, 'třídy');

    return this.prisma.classSection.findMany({
      where: { yearId },
      include: {
        teacher: {
          include: {
            membership: {
              select: { user: { select: { name: true, email: true } } },
            },
          },
        },
        enrollments: true,
      },
    });
  }

  async findOne(id: string, user: JwtPayload) {
    const classSection = await this.prisma.classSection.findUnique({
      where: { id },
      include: {
        teacher: {
          include: {
            membership: { include: { user: true } },
          },
        },
        enrollments: true,
      },
    });

    if (!classSection) throw new NotFoundException('Třída nebyla nalezena');

    assertSameOrganization(classSection.orgId, user, 'třída');
    return classSection;
  }

  async update(id: string, dto: UpdateClassroomDto, user: JwtPayload) {
    const classSection = await this.prisma.classSection.findUnique({
      where: { id },
    });
    if (!classSection) throw new NotFoundException('Třída nebyla nalezena');

    assertSameOrganization(classSection.orgId, user, 'třída');
    return this.prisma.classSection.update({ where: { id }, data: dto });
  }

  async remove(id: string, user: JwtPayload) {
    const classSection = await this.prisma.classSection.findUnique({
      where: { id },
    });
    if (!classSection) throw new NotFoundException('Třída nebyla nalezena');

    assertSameOrganization(classSection.orgId, user, 'třída');
    return this.prisma.classSection.delete({ where: { id } });
  }
}
