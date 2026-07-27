import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regrese: runner stage v Dockerfile kopíroval jen package*.json, prisma,
 * node_modules, dist a entrypoint.sh. Definice kampaní leží v content/,
 * tedy mimo src/, takže je nest build nekopíruje do dist/ — v runtime image
 * chyběly a CampaignContentService při startu fail-fast spadla.
 *
 * Test je statický (nepotřebuje Docker), aby chytil odstranění COPY dřív,
 * než se to projeví až pádem kontejneru.
 */
const SERVER_ROOT = join(__dirname, '..', '..');
const DOCKERFILE = join(SERVER_ROOT, 'Dockerfile');
const CONTENT_DIR = join(SERVER_ROOT, 'content', 'campaigns');

/** Řádky runner stage — od `FROM ... AS runner` po konec souboru. */
function runnerStageLines(): string[] {
  const lines = readFileSync(DOCKERFILE, 'utf8').split('\n');
  const start = lines.findIndex((l) => /^FROM .+ AS runner\s*$/.test(l.trim()));
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = lines.slice(start + 1);
  const nextStage = rest.findIndex((l) => /^FROM /.test(l.trim()));
  return nextStage === -1 ? rest : rest.slice(0, nextStage);
}

describe('Dockerfile runner stage — runtime assets', () => {
  it('kopíruje content/ do runtime image', () => {
    const copiesContent = runnerStageLines().some((l) =>
      /^COPY\s+(--from=\S+\s+)?\S*content\s+\.\/content\s*$/.test(l.trim()),
    );
    expect(copiesContent).toBe(true);
  });

  it('content/campaigns ve zdrojovém stromu není prázdný', () => {
    expect(existsSync(CONTENT_DIR)).toBe(true);
    const jsonFiles = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json'));
    expect(jsonFiles.length).toBeGreaterThan(0);
  });

  it('.dockerignore nevylučuje content/', () => {
    const ignore = readFileSync(join(SERVER_ROOT, '.dockerignore'), 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
    const blocks = ignore.some((pattern) =>
      /^\/?content(\/.*)?$/.test(pattern.replace(/^!/, '')),
    );
    expect(blocks).toBe(false);
  });
});
