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

describe('HTTP cache policy — @CacheTTL(0)', () => {
  it('requires @NoHttpCache() on every controller handler that uses CacheTTL(0)', () => {
    const srcDir = join(process.cwd(), 'src');
    const offenders: string[] = [];

    for (const file of controllerFiles(srcDir)) {
      const source = readFileSync(file, 'utf8');
      const marker = '@CacheTTL(0)';
      let index = source.indexOf(marker);

      while (index !== -1) {
        // Decorators for one handler are adjacent. A small symmetric window
        // supports either decorator order without accidentally accepting a
        // distant class-level declaration.
        const window = source.slice(
          Math.max(0, index - 280),
          Math.min(source.length, index + marker.length + 280),
        );
        if (!window.includes('@NoHttpCache()')) {
          const line = source.slice(0, index).split('\n').length;
          offenders.push(`${relative(process.cwd(), file)}:${line}`);
        }
        index = source.indexOf(marker, index + marker.length);
      }
    }

    expect(offenders).toEqual([]);
  });
});
