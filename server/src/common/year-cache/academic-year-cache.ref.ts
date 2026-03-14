import { Injectable } from '@nestjs/common';

export type CachedYearEntry = {
  yearId: string | null;
  endsAt: Date | null;
  expiresAt: number;
};

/**
 * Thin, dependency-free cache for the active academic year per org.
 *
 * Extracted from OrgContextService so that AcademicYearsService and
 * PromotionService can call invalidate() after mutations WITHOUT
 * creating a circular dependency:
 *
 *   OrgContextModule → AcademicYearsModule  (via import)
 *   AcademicYearsModule → OrgContextService (would be circular)
 *
 * Both modules instead import AcademicYearCacheModule which is @Global()
 * and has no dependencies of its own.
 */
@Injectable()
export class AcademicYearCacheRef {
  readonly map = new Map<string, CachedYearEntry>();

  get(orgId: string): CachedYearEntry | undefined {
    return this.map.get(orgId);
  }

  set(orgId: string, entry: CachedYearEntry): void {
    this.map.set(orgId, entry);
  }

  invalidate(orgId: string): void {
    this.map.delete(orgId);
  }
}
