import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PrismaModule } from '@/prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthCleanupService } from './auth-cleanup.service';
import { GoogleSsoService } from './sso/google-sso.service';
import { GoogleTokenVerifier } from './sso/google-token.verifier';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GamificationModule } from '@/gamification/gamification.module';
import { AuditModule } from '@/audit/audit.module';
import { RbacModule } from '@/modules/rbac/rbac.module';
import { getJwtAccessSecret } from './jwt-secrets';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    GamificationModule,
    AuditModule,
    RbacModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const secret = getJwtAccessSecret(configService);
        return {
          secret,
          signOptions: { expiresIn: '1h' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCleanupService,
    GoogleSsoService,
    GoogleTokenVerifier,
    JwtStrategy,
    JwtAuthGuard,
  ],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
