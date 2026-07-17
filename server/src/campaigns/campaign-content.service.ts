import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchoolGrade } from '@prisma/client';
import {
  CampaignDefinition,
  campaignDefinitionSchema,
  gradeIndex,
} from './campaign-content.schema';

/**
 * Registry definic kampaní. Načítá content/campaigns/*.json při bootu,
 * validuje zod schématem a při chybě SPADNE (fail-fast) — rozbitý obsah
 * nesmí doputovat do běžícího serveru.
 *
 * Cesta se řeší pro oba boot režimy (CI past z PR #13 — dist boot):
 *  - dev (src):  cwd = server/  → server/content/campaigns
 *  - dist:       __dirname = server/dist/campaigns → ../../content/campaigns
 */
@Injectable()
export class CampaignContentService implements OnModuleInit {
  private readonly logger = new Logger(CampaignContentService.name);
  private byIdMap = new Map<string, CampaignDefinition>();

  onModuleInit() {
    this.load();
  }

  private resolveContentDir(): string {
    const candidates = [
      join(process.cwd(), 'content', 'campaigns'),
      join(__dirname, '..', '..', 'content', 'campaigns'),
      join(__dirname, '..', '..', '..', 'content', 'campaigns'),
    ];
    const found = candidates.find((c) => existsSync(c));
    if (!found) {
      throw new Error(
        `Adresář content/campaigns nenalezen. Zkoušeno: ${candidates.join(', ')}`,
      );
    }
    return found;
  }

  /** Exponováno i pro testy (reload nad jiným adresářem se nepodporuje záměrně). */
  load(): void {
    const dir = this.resolveContentDir();
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    const map = new Map<string, CampaignDefinition>();
    for (const file of files) {
      const raw = JSON.parse(readFileSync(join(dir, file), 'utf8')) as unknown;
      const parsed = campaignDefinitionSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(
          `Neplatná definice kampaně ${file}: ${parsed.error.message}`,
        );
      }
      if (map.has(parsed.data.id)) {
        throw new Error(`Duplicitní campaign id "${parsed.data.id}" (${file})`);
      }
      map.set(parsed.data.id, parsed.data);
    }
    this.byIdMap = map;
    this.logger.log(`Načteno ${map.size} kampaní z ${dir}`);
  }

  all(): CampaignDefinition[] {
    return [...this.byIdMap.values()];
  }

  byId(id: string): CampaignDefinition | undefined {
    return this.byIdMap.get(id);
  }

  /** Kampaně cílené na daný ročník (targetGrades rozsah, viz decisions R5). */
  forGrade(grade: SchoolGrade): CampaignDefinition[] {
    const gi = gradeIndex(grade);
    return this.all().filter(
      (c) =>
        gi >= gradeIndex(c.targetGrades.min) &&
        gi <= gradeIndex(c.targetGrades.max),
    );
  }
}
