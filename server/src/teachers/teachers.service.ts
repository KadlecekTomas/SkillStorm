import { Injectable } from '@nestjs/common';

@Injectable()
export class TeachersService {
  getDashboard() {
    // Sem později dáme dotazy přes Prisma, např. seznam tříd a studentů
    return {
      message: 'Welcome to the Teacher Dashboard',
      stats: {
        totalStudents: 25,
        totalClasses: 3,
      },
    };
  }
}
