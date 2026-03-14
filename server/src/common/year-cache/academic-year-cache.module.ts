import { Global, Module } from '@nestjs/common';
import { AcademicYearCacheRef } from './academic-year-cache.ref';

/**
 * Global module — exports AcademicYearCacheRef to every module in the app.
 * Has zero dependencies, so it can be safely imported by any module
 * including those that are transitively related (OrgContextModule,
 * AcademicYearsModule) without creating circular references.
 */
@Global()
@Module({
  providers: [AcademicYearCacheRef],
  exports: [AcademicYearCacheRef],
})
export class AcademicYearCacheModule {}
