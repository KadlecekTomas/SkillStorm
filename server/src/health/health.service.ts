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
  version: string;
  commitHash: string | null;
  checks: {
    process: 'ok';
    db: 'ok';
    migrations: 'ok';
    redis: 'ok' | 'disabled';
  };
  lastMigration: string | null;
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
    const lastMigration = await this.checkMigrations();
    const redis = await this.checkRedis();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: this.versionInfo.version,
      commitHash: this.versionInfo.commitHash,
      checks: {
        process: 'ok',
        db: 'ok',
        migrations: 'ok',
        redis,
      },
      lastMigration,
    };
  }

  /**
   * Migrations check: fails the health endpoint when any migration is
   * recorded as started but not finished (crashed/rolled-back deploy) —
   * uptime monitoring then alerts before users hit schema-drift errors.
   * Returns the name of the last applied migration for the payload.
   */
  private async checkMigrations(): Promise<string | null> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        { migration_name: string; finished_at: Date | null }[]
      >(
        'SELECT migration_name, finished_at FROM _prisma_migrations ' +
          'WHERE rolled_back_at IS NULL ORDER BY started_at DESC LIMIT 5',
      );
      const unfinished = rows.find((r) => r.finished_at === null);
      if (unfinished) {
        throw new ServiceUnavailableException({
          status: 'error',
          checks: { migrations: 'pending' },
          message: `Migration not finished: ${unfinished.migration_name}`,
        });
      }
      return rows[0]?.migration_name ?? null;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.warn(`Migrations health check skipped: ${error}`);
      return null;
    }
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
