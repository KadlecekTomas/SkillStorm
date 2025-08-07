import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.organization.findMany({
      where: { deletedAt: null },
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org || org.deletedAt)
      throw new NotFoundException('Organization not found');
    return org;
  }

  async create(dto: CreateOrganizationDto) {
    if (dto.name && dto.city) {
      const existing = await this.prisma.organization.findFirst({
        where: {
          name: dto.name,
          city: dto.city,
          deletedAt: null,
        },
      });

      if (existing) {
        console.warn(
          `[OrganizationsService] Organizace se stejným názvem ve městě už existuje: ${dto.name}, ${dto.city}`,
        );
      }
    }

    return this.prisma.organization.create({
      data: {
        name: dto.name,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        type: dto.type ?? 'SCHOOL',
      },
    });
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org || org.deletedAt)
      throw new NotFoundException('Organization not found');

    return this.prisma.organization.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    return this.prisma.organization.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
