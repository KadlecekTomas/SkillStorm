import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    console.log('PAYLOAD FROM JWT:', payload); // 🔍 debug

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    console.log('USER FROM DB:', user); // 🔍 debug

    if (!user) {
      return {
        userId: payload.sub,
        role: payload.role || null, // fallback na payload
      };
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role, // ✅ DŮLEŽITÉ
    };
  }
}
