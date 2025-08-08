import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  CacheModule,
  CacheModuleOptions,
  CacheInterceptor,
} from '@nestjs/cache-manager';
import { APP_INTERCEPTOR } from '@nestjs/core';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.registerAsync<CacheModuleOptions>({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (cfg: ConfigService) => {
        const url = cfg.get<string>('REDIS_URL');
        const ttlSeconds = cfg.get<number>('CACHE_TTL_SECONDS') ?? 600; // 10 min
        const ttl = ttlSeconds * 1000; // ms pro cache-manager v5

        if (url) {
          const { redisStore } = await import('cache-manager-redis-yet');
          return {
            store: await redisStore({ url }),
            ttl,
          };
        }
        return { ttl }; // in-memory fallback
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
    ClassSectionModule,
    CatalogModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: CacheInterceptor }],
})
export class AppModule {}
