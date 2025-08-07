import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({ where: { isAnonymized: false } });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.isAnonymized)
      throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto) {
    const hashed = await bcrypt.hash(dto.password, 10);

    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash: hashed,
          systemRole: dto.systemRole,
        },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        (error.meta?.target as string[])?.includes('email')
      ) {
        // 1. Zkus najít, jestli ten email není "anonymizovaný"
        const existing = await this.prisma.user.findUnique({
          where: { email: dto.email },
        });

        if (existing?.isAnonymized && existing.status === 'INACTIVE') {
          // 2. Odstranit starý anonymizovaný záznam
          await this.prisma.user.delete({ where: { id: existing.id } });

          // 3. Znovu vytvořit nového uživatele
          return this.prisma.user.create({
            data: {
              email: dto.email,
              name: dto.name,
              passwordHash: hashed,
              systemRole: dto.systemRole,
            },
          });
        }

        throw new BadRequestException('Email already exists and is in use');
      }

      throw error;
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    const data: any = { ...dto };
    if (dto.password) {
      const hashed = await bcrypt.hash(dto.password, 10);
      data.passwordHash = hashed;
      delete data.password;
    }

    return this.prisma.user.update({ where: { id }, data });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const anonymizedEmail = `anonymized-${uuidv4()}@deleted.local`;

    return this.prisma.user.update({
      where: { id },
      data: {
        email: anonymizedEmail,
        name: 'Deleted User',
        status: 'INACTIVE',
        isAnonymized: true,
        deletedAt: new Date(),
      },
    });
  }

  async updateLastLogin(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
      },
    });
  }
}
