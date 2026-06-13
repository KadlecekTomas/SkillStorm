import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '@/prisma/prisma.service';

const PACKAGE_JSON_PATH =
  process.env.NEST_PACKAGE_PATH ?? join(process.cwd(), 'package.json');

export interface HealthPayload {
  status: 'ok';
  timestamp: string;
  checks: {
    process: 'ok';
    db: 'ok';
    redis: 'ok' | 'disabled';
  };
}

export interface VersionPayload {
  version: string;
  commitHash: string | null;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly versionInfo: VersionPayload;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    this.versionInfo = this.loadVersionInfo();
  }

  async getHealth(): Promise<HealthPayload> {
    await this.checkDatabase();
    const redis = await this.checkRedis();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks: {
        process: 'ok',
        db: 'ok',
        redis,
      },
    };
  }

  getVersion(): VersionPayload {
    return this.versionInfo;
  }

  private loadVersionInfo(): VersionPayload {
    try {
      const raw = readFileSync(PACKAGE_JSON_PATH, 'utf8');
      const pkg = JSON.parse(raw);
      const version = pkg.version ?? '0.0.0';
      const commitHash =
        process.env.COMMIT_SHA ??
        process.env.VERCEL_GIT_COMMIT_SHA ??
        pkg.commitHash ??
        null;

      return { version, commitHash };
    } catch (error) {
      this.logger.warn(
        `Unable to read package.json for version endpoint: ${error}`,
      );
      return {
        version: '0.0.0',
        commitHash: process.env.COMMIT_SHA ?? null,
      };
    }
  }

  private async checkDatabase(): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error(`Database healthcheck failed: ${error}`);
      throw new ServiceUnavailableException('Database unavailable');
    }
  }

  private async checkRedis(): Promise<'ok' | 'disabled'> {
    if (!process.env.REDIS_URL?.trim()) {
      return 'disabled';
    }

    const key = `healthcheck:${Date.now()}`;
    try {
      await this.cache.set(key, 'ok', 1_000);
      const value = await this.cache.get<string>(key);
      if (value !== 'ok') {
        throw new Error('Unexpected cache probe value');
      }
      await this.cache.del(key);
      return 'ok';
    } catch (error) {
      this.logger.error(`Redis healthcheck failed: ${error}`);
      throw new ServiceUnavailableException('Redis unavailable');
    }
  }
}
