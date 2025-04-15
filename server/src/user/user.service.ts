import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { $Enums } from '../../generated/prisma';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany();
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: {
    email: string;
    name: string;
    role: $Enums.Role;
    passwordHash: string;
  }) {
    try {
      return await this.prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          role: data.role,
          passwordHash: data.passwordHash,
        },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  async delete(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }
}
