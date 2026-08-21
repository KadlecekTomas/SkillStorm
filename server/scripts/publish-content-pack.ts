import { NestFactory } from '@nestjs/core';
import { ContentPackPublisherService } from '@/content-packs/content-pack-publisher.service';
import { requireContentPack } from '@/content-packs/content-pack.registry';
import { ContentPacksModule } from '@/content-packs/content-packs.module';

function valueArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseReleaseOverrides(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const arg of process.argv) {
    if (!arg.startsWith('--framework-release=')) continue;
    const raw = arg.slice('--framework-release='.length);
    const separator = raw.indexOf(':');
    if (separator <= 0 || separator === raw.length - 1) {
      throw new Error(
        `Invalid --framework-release=${raw}. Use FRAMEWORK_CODE:releaseCode.`,
      );
    }
    const frameworkCode = raw.slice(0, separator).trim().toUpperCase();
    const releaseCode = raw.slice(separator + 1).trim();
    if (result[frameworkCode] && result[frameworkCode] !== releaseCode) {
      throw new Error(`Multiple release overrides supplied for ${frameworkCode}.`);
    }
    result[frameworkCode] = releaseCode;
  }
  return result;
}

function mode() {
  const stage = hasFlag('stage');
  const publish = hasFlag('publish');
  if (stage && publish) {
    throw new Error('Choose only one of --stage or --publish.');
  }
  if (publish) return 'PUBLISH' as const;
  if (stage) return 'STAGE' as const;
  return 'DRY_RUN' as const;
}

async function main() {
  const packId = valueArg('pack') ?? 'INF_G6_ENCODING_FOUNDATIONS';
  const selectedMode = mode();
  const approveProposedMappings = hasFlag('approve-mappings');
  const actorEmail = valueArg('actor-email');
  const frameworkReleaseCodes = parseReleaseOverrides();

  if (selectedMode === 'DRY_RUN' && approveProposedMappings) {
    throw new Error('--approve-mappings has no effect in dry-run mode.');
  }

  const app = await NestFactory.createApplicationContext(ContentPacksModule, {
    logger: ['error', 'warn'],
  });
  try {
    const publisher = app.get(ContentPackPublisherService);
    const actor = await publisher.resolvePlatformActor(actorEmail);
    const pack = requireContentPack(packId);
    const report = await publisher.applyGlobalPack(pack, {
      actor,
      mode: selectedMode,
      frameworkReleaseCodes,
      approveProposedMappings,
    });

    console.log(JSON.stringify(report, null, 2));
    if (selectedMode === 'DRY_RUN') {
      console.log(
        '\nDRY-RUN only. No content was written. Use --stage to create drafts/proposals, or --publish after curriculum mappings have been explicitly reviewed.',
      );
    } else if (selectedMode === 'STAGE') {
      console.log(
        '\nContent pack staged. Drafts and SYSTEM-proposed curriculum mappings were created/reused; nothing was published.',
      );
    } else {
      console.log('\nContent pack publication workflow completed.');
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const response =
    error && typeof error === 'object' && 'getResponse' in error
      ? (error as { getResponse: () => unknown }).getResponse()
      : null;
  console.error(
    response ? JSON.stringify(response, null, 2) : error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
