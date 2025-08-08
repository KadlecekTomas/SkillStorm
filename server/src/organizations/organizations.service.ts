// src/modules/organizations/organizations.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { $Enums, OrganizationType } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.organization.findMany({
      where: { deletedAt: null },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org || org.deletedAt)
      throw new NotFoundException('Organization not found');
    return org;
  }

  async userIsDirector(userId: string) {
    if (!userId) return false;
    const count = await this.prisma.membership.count({
      where: {
        userId,
        role: $Enums.OrganizationRole.DIRECTOR,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  async create(dto: CreateOrganizationDto, creatorUserId?: string) {
    if (dto.name && dto.city) {
      const existing = await this.prisma.organization.findFirst({
        where: { name: dto.name, city: dto.city, deletedAt: null },
      });
      if (existing) {
        console.warn(
          `[OrganizationsService] Organizace se stejným názvem ve městě už existuje: ${dto.name}, ${dto.city}`,
        );
      }
    }

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        type: dto.type ?? OrganizationType.SCHOOL,
      },
    });

    // Autor = ředitel nově vytvořené organizace (pokud máme userId)
    if (creatorUserId) {
      await this.prisma.membership.create({
        data: {
          userId: creatorUserId,
          organizationId: org.id,
          role: $Enums.OrganizationRole.DIRECTOR,
        },
      });
    }

    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org || org.deletedAt)
      throw new NotFoundException('Organization not found');

    return this.prisma.organization.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        address: dto.address ?? undefined,
        city: dto.city ?? undefined,
        country: dto.country ?? undefined,
        type: dto.type ?? undefined,
      },
    });
  }

  async remove(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    return this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
