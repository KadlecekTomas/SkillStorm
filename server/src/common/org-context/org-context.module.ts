import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { AcademicYearsModule } from '@/academic-years/academic-years.module';
import { AcademicYearCacheModule } from '@/common/year-cache/academic-year-cache.module';
import { OrgContextService } from './org-context.service';

@Global()
@Module({
  imports: [PrismaModule, AcademicYearsModule, AcademicYearCacheModule],
  providers: [OrgContextService],
  exports: [OrgContextService],
})
export class OrgContextModule {}
