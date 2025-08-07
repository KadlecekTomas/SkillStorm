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

  findByOrganization(orgId: string) {
    return this.prisma.membership.findMany({
      where: { organizationId: orgId },
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
        student: {
          include: {
            classroom: {
              select: { name: true },
            },
          },
        },
        teacher: {
          include: {
            subjects: {
              include: {
                subject: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const m = await this.prisma.membership.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Membership not found');
    return m;
  }

  update(id: string, dto: UpdateMembershipDto) {
    return this.prisma.membership.update({ where: { id }, data: dto });
  }

  remove(id: string) {
    return this.prisma.membership.delete({ where: { id } });
  }
}
