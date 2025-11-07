import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule, CacheModuleOptions } from '@nestjs/cache-manager';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TeachersModule } from './teachers/teachers.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { MembershipsModule } from './memberships/memberships.module';
import { ClassroomModule } from './classroom/classroom.module';
import { SubjectsModule } from './subject/subject.module';
import { ClassSectionModule } from './class-section/class-section.module';
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

@Module({
  imports: [
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
    ClassSectionModule,
    CatalogModule,
    LearningMaterialsModule,
    TestsModule,
    StatsModule,
    AssignmentsModule,
    SubmissionsModule,
    RbacModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_INTERCEPTOR, useClass: UserScopedCacheInterceptor },
    { provide: APP_INTERCEPTOR, useClass: InvalidateInterceptor },
  ],
})
export class AppModule {}
