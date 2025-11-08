import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

const PACKAGE_JSON_PATH =
  process.env.NEST_PACKAGE_PATH ?? join(process.cwd(), 'package.json');

export interface HealthPayload {
  status: 'ok';
  timestamp: string;
}

export interface VersionPayload {
  version: string;
  commitHash: string | null;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly versionInfo: VersionPayload;

  constructor() {
    this.versionInfo = this.loadVersionInfo();
  }

  getHealth(): HealthPayload {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
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
}
