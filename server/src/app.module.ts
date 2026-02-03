import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { CacheModuleOptions } from '@nestjs/cache-manager';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TeachersModule } from './teachers/teachers.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { MembershipsModule } from './memberships/memberships.module';
import { ClassroomModule } from './classroom/classroom.module';
import { SubjectsModule } from './subject/subject.module';
import { CatalogModule } from './catalog/catalog.module';

import { UserScopedCacheInterceptor } from './common/cache/user-scoped-cache.interceptor';
import { InvalidateInterceptor } from './common/cache/invalidate.interceptor';
import { StudentsModule } from './student/student.module';
import { TopicsModule } from './topic/topic.module';
import { LearningMaterialsModule } from './learning-materials/learning-materials.module';
import { TestsModule } from './tests/tests.module';
import { StatsModule } from './stats/stats.module';

import { AssignmentsModule } from './assignments/assignments.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RbacGuard } from './modules/rbac/rbac.guard';
import { RequireActiveOrganizationGuard } from './platform/require-active-organization.guard';
import { RequireOrgReadyGuard } from './platform/require-org-ready.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { GamificationModule } from './gamification/gamification.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { ResponseEnvelopeInterceptor } from './common/http/response-envelope.interceptor';
import { ScheduleModule } from '@nestjs/schedule';
import { PrivacyModule } from './privacy/privacy.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { AcademicYearsModule } from './academic-years/academic-years.module';
import { InvitesModule } from './invites/invites.module';
import { PlatformModule } from './platform/platform.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.registerAsync<CacheModuleOptions>({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (cfg: ConfigService) => {
        if (process.env.NODE_ENV === 'test') {
          return { ttl: 0 }; // in-memory, bez expirace pro testy
        }
        const url = cfg.get<string>('REDIS_URL');
        const ttlSeconds = cfg.get<number>('CACHE_TTL_SECONDS') ?? 600;
        const ttl = ttlSeconds * 1000; // cache-manager v5: TTL v ms
        if (url) {
          const { redisStore } = await import('cache-manager-redis-yet');
          return { store: await redisStore({ url }), ttl };
        }
        return { ttl }; // fallback in‑memory
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: process.env.DISABLE_THROTTLE === '1' ? 1 : 60,
        limit: process.env.DISABLE_THROTTLE === '1' ? 10000 : 20,
      },
    ]),
    PrismaModule,
    AuthModule,
    TeachersModule,
    UsersModule,
    OrganizationsModule,
    MembershipsModule,
    ClassroomModule,
    SubjectsModule,
    StudentsModule,
    TopicsModule,
    CatalogModule,
    LearningMaterialsModule,
    TestsModule,
    StatsModule,
    AssignmentsModule,
    SubmissionsModule,
    RbacModule,
    HealthModule,
    MetricsModule,
    GamificationModule,
    AnalyticsModule,
    AuditModule,
    PrivacyModule,
    EnrollmentsModule,
    AcademicYearsModule,
    InvitesModule,
    PlatformModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_GUARD, useClass: RequireActiveOrganizationGuard },
    { provide: APP_GUARD, useClass: RequireOrgReadyGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: UserScopedCacheInterceptor },
    { provide: APP_INTERCEPTOR, useClass: InvalidateInterceptor },
  ],
  controllers: [],
})
export class AppModule {}
