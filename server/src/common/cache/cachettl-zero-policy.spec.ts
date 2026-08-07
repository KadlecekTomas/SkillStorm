import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * SmartCacheInterceptor treats @CacheTTL(0) as a TTL value, not as an opt-out.
 * A controller that intends to bypass the HTTP response cache must therefore
 * also carry @NoHttpCache() on that handler. Without it, a successful mutation
 * can be followed by a stale GET served before the service-level versioned
 * cache is even consulted (regression originally reproduced in the library).
 */
function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return controllerFiles(path);
    return name.endsWith('.controller.ts') ? [path] : [];
  });
}

/**
 * Remove comments while preserving character/newline positions. The policy is
 * interested in decorators that are executable TypeScript, not documentation
 * such as "removed @CacheTTL(0)". Preserving positions keeps line reporting
 * accurate.
 */
function stripCommentsPreservingPositions(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) =>
      comment.replace(/[^\n\r]/g, ' '),
    )
    .replace(/\/\/[^\n\r]*/g, (comment) => ' '.repeat(comment.length));
}

describe('HTTP cache policy — @CacheTTL(0)', () => {
  it('requires @NoHttpCache() on every controller handler that uses CacheTTL(0)', () => {
    const srcDir = join(process.cwd(), 'src');
    const offenders: string[] = [];

    for (const file of controllerFiles(srcDir)) {
      const source = readFileSync(file, 'utf8');
      const code = stripCommentsPreservingPositions(source);
      const marker = '@CacheTTL(0)';
      let index = code.indexOf(marker);

      while (index !== -1) {
        // Decorators for one handler are adjacent. A small symmetric window
        // supports either decorator order without accidentally accepting a
        // distant class-level declaration.
        const window = code.slice(
          Math.max(0, index - 280),
          Math.min(code.length, index + marker.length + 280),
        );
        if (!window.includes('@NoHttpCache()')) {
          const line = source.slice(0, index).split('\n').length;
          offenders.push(`${relative(process.cwd(), file)}:${line}`);
        }
        index = code.indexOf(marker, index + marker.length);
      }
    }

    if (offenders.length > 0) {
      throw new Error(
        `@CacheTTL(0) nevypíná SmartCacheInterceptor. Přidej @NoHttpCache(): ${offenders.join(', ')}`,
      );
    }

    expect(offenders).toEqual([]);
  });
});