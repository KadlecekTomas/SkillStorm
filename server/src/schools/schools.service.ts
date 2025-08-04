import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { Role } from 'generated/prisma';

@Injectable()
export class SchoolsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateSchoolDto) {
    const director = await this.prisma.user.findUnique({
      where: { id: data.directorId },
    });

    if (!director) {
      throw new NotFoundException('Ředitel s tímto ID neexistuje.');
    }

    if (director.role !== Role.DIRECTOR) {
      throw new BadRequestException('Uživatel nemá roli DIRECTOR.');
    }

    return this.prisma.school.create({ data });
  }

  async findOne(id: string) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException('Škola nebyla nalezena');
    return school;
  }

  async update(id: string, data: UpdateSchoolDto) {
    if (data.directorId) {
      const director = await this.prisma.user.findUnique({
        where: { id: data.directorId },
      });

      if (!director) {
        throw new NotFoundException('Ředitel s tímto ID neexistuje.');
      }

      if (director.role !== Role.DIRECTOR) {
        throw new BadRequestException('Uživatel nemá roli DIRECTOR.');
      }
    }

    return this.prisma.school.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.school.delete({ where: { id } });
  }
}
