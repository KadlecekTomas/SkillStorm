/** Lowercase, strip Czech diacritics, trim, collapse internal whitespace. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Local part of an e-mail (before `@`), normalized; empty string if none. */
export function emailLocalPart(email: string | null | undefined): string {
  if (!email) return '';
  const local = email.split('@')[0] ?? '';
  return normalizeText(local);
}
