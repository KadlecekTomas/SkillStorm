import { Module } from '@nestjs/common';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';
import { OrgContextModule } from '@/common/org-context/org-context.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [PrismaModule, AcademicYearsModule, OrgContextModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
