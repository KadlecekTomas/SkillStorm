import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';

@Injectable()
export class MembershipsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMembershipDto) {
    // Validace existence org + user
    const [org, user] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: dto.organizationId },
      }),
      this.prisma.user.findUnique({ where: { id: dto.userId } }),
    ]);
    if (!org) throw new NotFoundException('Organizace nebyla nalezena');
    if (!user) throw new NotFoundException('Uživatel nebyl nalezen');

    // Unikátní členství v rámci organizace
    const exists = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: dto.userId,
          organizationId: dto.organizationId,
        },
      },
    });
    if (exists) {
      throw new ConflictException('Uživatel je už členem této organizace.');
    }

    return this.prisma.membership.create({ data: dto });
  }

  findByOrganization(organizationId: string) {
    return this.prisma.membership.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            preferredLang: true,
            systemRole: true,
            status: true,
            lastLoginAt: true,
            isAnonymized: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
          },
        },
        // Student part (dle Prisma schématu)
        student: {
          include: {
            enrollments: {
              include: {
                academicYear: {
                  select: { id: true, label: true, isCurrent: true },
                },
                classSection: {
                  select: {
                    id: true,
                    grade: true,
                    section: true,
                    label: true,
                  },
                },
              },
            },
            StudentClassroom: {
              include: {
                classSection: {
                  select: { id: true, grade: true, section: true, label: true },
                },
                TopicLevel: {
                  select: {
                    id: true,
                    phase: true,
                    difficulty: true,
                    subjectLevel: {
                      select: {
                        id: true,
                        grade: true,
                        subject: { select: { id: true, name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        // Teacher part (TeacherSubject + homeroomOf)
        teacher: {
          include: {
            subjects: {
              include: {
                subject: { select: { id: true, name: true } },
              },
            },
            homeroomOf: {
              select: {
                id: true,
                grade: true,
                section: true,
                label: true,
                academicYear: {
                  select: { id: true, label: true, isCurrent: true },
                },
              },
            },
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { id },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    return membership;
  }

  update(id: string, dto: UpdateMembershipDto) {
    return this.prisma.membership.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.membership.delete({ where: { id } });
  }
}
