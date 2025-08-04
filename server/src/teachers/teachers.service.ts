import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { Role } from 'generated/prisma';

@Injectable()
export class TeachersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTeacherDto) {
    // Ověřit, že uživatel existuje
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) throw new NotFoundException('Uživatel neexistuje.');
    if (user.role !== Role.TEACHER) {
      throw new BadRequestException('Uživatel nemá roli TEACHER.');
    }

    // Ověřit, že škola existuje
    const school = await this.prisma.school.findUnique({
      where: { id: dto.schoolId },
    });
    if (!school) throw new NotFoundException('Škola neexistuje.');

    return this.prisma.teacher.create({
      data: {
        userId: dto.userId,
        schoolId: dto.schoolId,
      },
    });
  }

  async findOne(id: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: { user: true, school: true },
    });
    if (!teacher) throw new NotFoundException('Učitel nebyl nalezen.');
    return teacher;
  }

  async update(id: string, dto: UpdateTeacherDto) {
    // Pokud se mění uživatel
    if (dto.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
      });
      if (!user) throw new NotFoundException('Uživatel neexistuje.');
      if (user.role !== Role.TEACHER) {
        throw new BadRequestException('Uživatel nemá roli TEACHER.');
      }
    }

    // Pokud se mění škola
    if (dto.schoolId) {
      const school = await this.prisma.school.findUnique({
        where: { id: dto.schoolId },
      });
      if (!school) throw new NotFoundException('Škola neexistuje.');
    }

    return this.prisma.teacher.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    return this.prisma.teacher.delete({
      where: { id },
    });
  }
}
