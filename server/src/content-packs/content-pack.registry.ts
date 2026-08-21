import type { UniversalContentPack } from './content-pack.types';
import { grade6EncodingFoundationsPack } from './informatics/grade-6/encoding-foundations.pack';

const CONTENT_PACKS: readonly UniversalContentPack[] = [
  grade6EncodingFoundationsPack,
];

export function listContentPacks(): readonly UniversalContentPack[] {
  return CONTENT_PACKS;
}

export function requireContentPack(packId: string): UniversalContentPack {
  const normalized = packId.trim().toUpperCase();
  const pack = CONTENT_PACKS.find(
    (candidate) => candidate.packId.toUpperCase() === normalized,
  );
  if (!pack) {
    const available = CONTENT_PACKS.map((candidate) => candidate.packId).join(', ');
    throw new Error(
      `Unknown content pack ${packId}. Available packs: ${available || '(none)'}.`,
    );
  }
  return pack;
}
