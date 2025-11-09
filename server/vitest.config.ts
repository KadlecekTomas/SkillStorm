import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

function nestTsTransformPlugin() {
  return {
    name: 'nest-ts-transform',
    enforce: 'pre',
    transform(src: string, id: string) {
      if (!id.endsWith('.ts') || id.includes('node_modules')) {
        return null;
      }

      const result = ts.transpileModule(src, {
        fileName: id,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2021,
          emitDecoratorMetadata: true,
          experimentalDecorators: true,
          esModuleInterop: true,
          sourceMap: true,
        },
      });

      return {
        code: result.outputText,
        map: result.sourceMapText ?? undefined,
      };
    },
  };
}

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec}.ts'],
    environment: 'node',
    threads: false,
    isolate: false,
  },
  resolve: {
    alias: {
      src: resolve(rootDir, 'src'),
    },
  },
  plugins: [nestTsTransformPlugin()],
});
